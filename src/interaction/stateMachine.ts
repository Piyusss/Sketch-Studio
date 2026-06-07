import { nanoid } from 'nanoid';
import type {
  ArrowObject,
  Camera,
  CanvasObject,
  DiamondObject,
  EllipseObject,
  InteractionMode,
  FrameObject,
  PenObject,
  PenPoint,
  RectObject,
  ResizeHandle,
  SnapGuide,
  TextObject,
  Vec2,
} from '../types';
import type { LivePenStroke } from '../engine/renderer';
import { screenToWorld } from '../utils/math';
import { computeArrowBBox } from '../utils/math';
import { measureTextBox } from '../utils/textMetrics';
import { hitTest, getResizeHandleAtPoint, getRotationHandleAtPoint } from '../engine/hitTest';
import { spatialIndex } from '../engine/spatialIndex';
import { historyManager } from '../history/historyManager';
import { AddObjectCommand, RemoveObjectsCommand } from '../history/commands';
import { zoomTowardPoint } from '../engine/camera';
import { useCanvasStore } from '../store/canvasStore';
import { computeSnap } from '../engine/snapping';
import { defaultInkColor } from '../utils/color';

// ── Eraser helpers ────────────────────────────────────────────────────────────

function eraserCircleOverlapsBox(center: Vec2, radius: number, obj: { x: number; y: number; width: number; height: number }): boolean {
  const nearX = Math.max(obj.x, Math.min(center.x, obj.x + obj.width));
  const nearY = Math.max(obj.y, Math.min(center.y, obj.y + obj.height));
  return Math.hypot(center.x - nearX, center.y - nearY) <= radius;
}

// Eases the drag-lift elevation in/out — same exponential-decay shape as the
// camera's pan/zoom lerp (engine/camera.ts), so all "premium motion" in the
// app shares one feel. Higher K than the camera's because this is a small,
// local effect that should settle quickly rather than visibly trail the cursor.
const DRAG_LIFT_LERP_K = 22;

function segDistWorld(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export class InteractionStateMachine {
  mode: InteractionMode = 'idle';
  selectionRect: { x: number; y: number; width: number; height: number } | null = null;
  snapGuides: SnapGuide[] = [];

  // When true (shared view-only), all pointer drags pan; nothing can be edited.
  readOnly = false;

  private spaceHeld = false;
  private camera: Camera;

  // Pan
  private panStartWorld: Vec2 = { x: 0, y: 0 };
  private velBuffer: Vec2[] = [];
  private inertiaId: number | null = null;

  // Move
  private moveStartPositions = new Map<string, { x: number; y: number; x1?: number; y1?: number; x2?: number; y2?: number }>();
  private moveLastWorld: Vec2 = { x: 0, y: 0 };
  // Objects captured inside a frame being moved — they travel with the frame.
  private frameChildStart = new Map<string, { x: number; y: number; x1?: number; y1?: number; x2?: number; y2?: number }>();
  // Non-selected top-level objects eligible as snap targets — captured once when
  // the drag starts instead of being rebuilt from the full object map every tick.
  private moveCandidates: CanvasObject[] = [];
  // RAF-coalesced input: every pointermove stashes the latest screen point here:
  // the actual snap computation + store commit runs at most once per animation
  // frame, using the freshest sample, so bursts of input between frames collapse
  // into a single state update instead of N redundant ones.
  private pendingMoveSp: Vec2 | null = null;
  private moveRafId: number | null = null;

  // Soft "lift": eases in while an object is actively being dragged and back out
  // after it's dropped, using the same exponential-decay lerp as the camera
  // (engine/camera.ts) so the motion reads as one consistent idiom app-wide.
  // Purely a visual cue (drives a soft elevation shadow in the renderer) — it
  // never touches committed positions, so precision is unaffected.
  liftedIds: Set<string> = new Set();
  dragLift = 0;
  private dragLiftTarget = 0;

  // Resize
  private resizeHandle: ResizeHandle | null = null;
  private resizeObjId: string | null = null;
  private resizeStartBounds: { x: number; y: number; width: number; height: number } | null = null;
  private resizeStartFontSize: number | null = null;
  private resizeStartWorld: Vec2 = { x: 0, y: 0 };
  private arrowResizeStart: { x1: number; y1: number; x2: number; y2: number } | null = null;

  // Selection
  private selStartWorld: Vec2 = { x: 0, y: 0 };

  // Draw
  private drawStartWorld: Vec2 = { x: 0, y: 0 };
  private drawObjId: string | null = null;

  // Pen
  currentPenStroke: LivePenStroke | null = null;
  private penWorldPoints: Array<{ x: number; y: number }> = [];

  // Double-click detection (for entering text edit mode on existing text)
  private dblClickTime = 0;
  private dblClickId: string | null = null;

  // Rotation
  currentRotateAngle: number | null = null;  // degrees, for overlay display
  private rotateObjId: string | null = null;
  private rotateCenter: { x: number; y: number } = { x: 0, y: 0 };
  private rotateStartPointerAngle = 0;  // radians
  private rotateStartObjAngle = 0;      // degrees

  // Eraser
  // Maps original object ID → its state before this drag started
  private eraseBeforeMap = new Map<string, CanvasObject>();
  // IDs of new pen sub-strokes created by splitting during this drag
  private eraseAddedIds = new Set<string>();

  // Snap settings
  gridSnap = true;
  objectSnap = true;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  updateCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Eases `dragLift` toward its target (1 while dragging, 0 once dropped) using
   * the same frame-rate-independent exponential decay as `tickCamera`. Called
   * once per animation frame from Canvas.tsx; returns true while still
   * animating so the caller knows to keep redrawing.
   */
  tickDragLift(dt: number): boolean {
    if (this.dragLift === this.dragLiftTarget) return false;
    const factor = 1 - Math.exp(-DRAG_LIFT_LERP_K * dt);
    this.dragLift += (this.dragLiftTarget - this.dragLift) * factor;
    if (Math.abs(this.dragLift - this.dragLiftTarget) < 0.003) {
      this.dragLift = this.dragLiftTarget;
      if (this.dragLift === 0) this.liftedIds.clear();
    }
    return true;
  }

  get activeResizeHandle(): ResizeHandle | null { return this.resizeHandle; }
  get currentCamera(): Camera { return this.camera; }

  // ── Public event handlers ──────────────────────────────────────────────────

  handlePointerDown(e: PointerEvent, rect: DOMRect): void {
    const sp = this.sp(e, rect);
    // Read-only (shared view): every drag pans, nothing is editable.
    if (this.readOnly) { this.startPan(sp); return; }
    // If a text editor is open, let the textarea's onBlur handle the commit.
    // Do nothing here so we don't accidentally start a new interaction.
    if (this.mode === 'editing-text') return;
    const store = useCanvasStore.getState();

    // ── Double-click detection for entering text edit mode ─────────────────
    const now = performance.now();
    const visible2 = this.getVisibleObjects(rect);
    const hitForDbl = hitTest(sp, this.camera, visible2, true);
    if (hitForDbl && hitForDbl.id === this.dblClickId && now - this.dblClickTime < 400 && hitForDbl.type === 'text' && !hitForDbl.locked) {
      store.setEditingTextId(hitForDbl.id);
      store.setSelectedIds([hitForDbl.id]);
      this.mode = 'editing-text';
      this.dblClickTime = 0;
      this.dblClickId = null;
      return;
    }
    this.dblClickTime = now;
    this.dblClickId = hitForDbl?.id ?? null;
    const isPan = this.spaceHeld || e.button === 1 || store.activeTool === 'pan';

    if (isPan) { this.startPan(sp); return; }

    if (store.activeTool === 'select') {
      if (store.selectedIds.length === 1) {
        const sel = store.getObject(store.selectedIds[0]);
        if (sel && !sel.locked) {
          // Rotation handle takes priority over resize handles
          if (getRotationHandleAtPoint(sp, sel, this.camera)) {
            this.startRotate(sel, sp); return;
          }
          const h = getResizeHandleAtPoint(sp, sel, this.camera);
          if (h) { this.startResize(h, sel, sp); return; }
        }
      }
      if (store.selectedIds.length > 1) {
        const sels = store.selectedIds.map((id) => store.getObject(id)).filter((o): o is CanvasObject => !!o);
        const fakeUnion = this.unionAsObj(sels);
        if (fakeUnion) {
          const h = getResizeHandleAtPoint(sp, fakeUnion, this.camera);
          if (h) { this.startResize(h, fakeUnion, sp); return; }

          // Click anywhere inside the union bounding box → move all selected objects.
          // This handles clicks on empty space between elements in a multi-selection.
          const wp = screenToWorld(sp, this.camera);
          const inBox =
            wp.x >= fakeUnion.x && wp.x <= fakeUnion.x + fakeUnion.width &&
            wp.y >= fakeUnion.y && wp.y <= fakeUnion.y + fakeUnion.height;
          if (inBox) {
            const movable = sels.filter((o) => !o.locked);
            if (movable.length > 0) { this.startMove(sp, movable); return; }
          }
        }
      }

      const visible = this.getVisibleObjects(rect);
      // Pass includeLocked=true so users can click locked objects to select them
      const hit = hitTest(sp, this.camera, visible, true);

      if (hit && hit.locked) {
        // Select-only: locked objects can't be moved/resized
        if (e.shiftKey) {
          store.selectedIds.includes(hit.id)
            ? store.removeFromSelection(hit.id)
            : store.addToSelection(hit.id);
        } else {
          store.setSelectedIds([hit.id]);
        }
        return; // do NOT start move
      }

      if (hit) {
        if (e.shiftKey) {
          if (store.selectedIds.includes(hit.id)) {
            store.removeFromSelection(hit.id);
            return;
          } else {
            store.addToSelection(hit.id);
          }
        } else {
          if (!store.selectedIds.includes(hit.id)) store.setSelectedIds([hit.id]);
        }
        const selected = store.selectedIds
          .map((id) => store.getObject(id))
          .filter((o): o is CanvasObject => !!o && !o.locked);
        this.startMove(sp, selected);
      } else {
        if (!e.shiftKey) store.clearSelection();
        this.startSelecting(sp);
      }
    } else if (store.activeTool === 'rect' || store.activeTool === 'ellipse' || store.activeTool === 'diamond' || store.activeTool === 'frame') {
      this.startDraw(sp, store.activeTool);
    } else if (store.activeTool === 'text') {
      this.placeText(sp);
    } else if (store.activeTool === 'pen') {
      this.startPen(sp);
    } else if (store.activeTool === 'arrow' || store.activeTool === 'line') {
      this.startArrow(sp);
    } else if (store.activeTool === 'eraser') {
      this.startErase(sp, rect);
    }
  }

  handlePointerMove(e: PointerEvent, rect: DOMRect): void {
    const sp = this.sp(e, rect);
    this.velBuffer.push({ ...sp });
    if (this.velBuffer.length > 6) this.velBuffer.shift();

    switch (this.mode) {
      case 'panning':       this.updatePan(sp); break;
      case 'moving':        this.scheduleMoveUpdate(sp); break;
      case 'resizing':      this.updateResize(sp); break;
      case 'selecting':     this.updateSelecting(sp); break;
      case 'drawing':       this.updateDraw(sp); break;
      case 'drawing-pen':   this.updatePen(sp); break;
      case 'drawing-arrow': this.updateArrow(sp); break;
      case 'erasing':       this.updateErase(sp, rect); break;
      case 'rotating':      this.updateRotate(sp, e.shiftKey); break;
    }
  }

  handlePointerUp(e: PointerEvent, rect: DOMRect): void {
    switch (this.mode) {
      case 'panning':       this.endPan(); break;
      case 'moving':        this.endMove(); break;
      case 'resizing':      this.endResize(); break;
      case 'selecting':     this.endSelecting(); break;
      case 'drawing':       this.endDraw(); break;
      case 'drawing-pen':   this.endPen(); break;
      case 'drawing-arrow': this.endArrow(); break;
      case 'erasing':       this.endErase(); break;
      case 'rotating':      this.endRotate(); break;
    }
    this.snapGuides = [];
    if (this.mode !== 'editing-text') this.mode = 'idle';
    void rect; void e;
  }

  handleWheel(e: WheelEvent, rect: DOMRect): void {
    e.preventDefault();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Zoom only when Ctrl/Meta is held (covers trackpad pinch — the OS injects
    // ctrlKey for that gesture — and Ctrl+mouse-wheel). A plain wheel/trackpad
    // scroll always pans, so users can scroll the canvas without it hijacking
    // into a zoom.
    const isZoom = e.ctrlKey || e.metaKey;

    if (isZoom) {
      zoomTowardPoint(this.camera, cx, cy, e.deltaY);
    } else {
      // Plain scroll: pan. Vertical wheel motion moves the canvas up/down;
      // trackpad two-finger horizontal motion (deltaX) pans sideways too.
      this.camera.targetX += e.deltaX / this.camera.zoom;
      this.camera.targetY += e.deltaY / this.camera.zoom;
    }
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (this.readOnly) return;
    if (this.mode === 'editing-text') return; // textarea owns all key events while editing
    if (e.code === 'Space' && !e.repeat) { this.spaceHeld = true; e.preventDefault(); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      const delta = e.shiftKey ? 10 : 1;
      const store = useCanvasStore.getState();
      store.selectedIds.forEach((id) => {
        const obj = store.getObject(id);
        if (!obj || obj.locked) return;
        const dx = e.code === 'ArrowLeft' ? -delta : e.code === 'ArrowRight' ? delta : 0;
        const dy = e.code === 'ArrowUp' ? -delta : e.code === 'ArrowDown' ? delta : 0;
        if (obj.type === 'arrow') {
          const a = obj as ArrowObject;
          store.updateObject(id, { x: obj.x + dx, y: obj.y + dy, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy } as Partial<CanvasObject>);
        } else {
          store.updateObject(id, { x: obj.x + dx, y: obj.y + dy });
        }
        const updated = useCanvasStore.getState().getObject(id);
        if (updated) spatialIndex.insert(updated);
      });
    }
  }

  handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') this.spaceHeld = false;
  }

  // ── Pan ───────────────────────────────────────────────────────────────────

  private startPan(sp: Vec2): void {
    this.mode = 'panning';
    this.panStartWorld = screenToWorld(sp, this.camera);
    this.velBuffer = [];
    if (this.inertiaId !== null) { cancelAnimationFrame(this.inertiaId); this.inertiaId = null; }
  }

  private updatePan(sp: Vec2): void {
    this.camera.targetX = this.panStartWorld.x - sp.x / this.camera.zoom;
    this.camera.targetY = this.panStartWorld.y - sp.y / this.camera.zoom;
  }

  private endPan(): void {
    if (this.velBuffer.length >= 2) {
      const last = this.velBuffer[this.velBuffer.length - 1];
      const first = this.velBuffer[0];
      const n = this.velBuffer.length - 1;
      let vx = (last.x - first.x) / n;
      let vy = (last.y - first.y) / n;
      const applyInertia = () => {
        vx *= 0.92; vy *= 0.92;
        this.camera.targetX -= vx / this.camera.zoom;
        this.camera.targetY -= vy / this.camera.zoom;
        if (Math.abs(vx) > 0.3 || Math.abs(vy) > 0.3) {
          this.inertiaId = requestAnimationFrame(applyInertia);
        } else this.inertiaId = null;
      };
      applyInertia();
    }
  }

  // ── Move ──────────────────────────────────────────────────────────────────

  private startMove(sp: Vec2, objects: CanvasObject[]): void {
    this.mode = 'moving';
    this.moveLastWorld = screenToWorld(sp, this.camera);
    this.moveStartPositions.clear();
    const store = useCanvasStore.getState();
    const selSet = new Set(store.selectedIds);
    this.moveCandidates = Object.values(store.objects).filter((o) => !selSet.has(o.id) && !o.parentId);
    objects.forEach((obj) => {
      if (obj.type === 'arrow') {
        const a = obj as ArrowObject;
        this.moveStartPositions.set(obj.id, { x: obj.x, y: obj.y, x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 });
      } else {
        this.moveStartPositions.set(obj.id, { x: obj.x, y: obj.y });
      }
    });
    this.captureFrameChildren(objects);

    // Kick off the lift — the renderer eases toward this target every frame.
    this.liftedIds = new Set(objects.map((o) => o.id));
    this.dragLiftTarget = 1;
  }

  /**
   * When a frame is dragged, every top-level object whose centre lies inside it
   * (and isn't itself selected) is captured so it travels with the frame —
   * giving the "section" container behaviour.
   */
  private captureFrameChildren(moving: CanvasObject[]): void {
    this.frameChildStart.clear();
    const frames = moving.filter((o) => o.type === 'frame') as FrameObject[];
    if (frames.length === 0) return;
    const store = useCanvasStore.getState();
    const selSet = new Set(store.selectedIds);
    for (const other of Object.values(store.objects)) {
      if (other.parentId || other.type === 'frame' || other.locked) continue;
      if (selSet.has(other.id)) continue;
      const cx = other.x + other.width / 2;
      const cy = other.y + other.height / 2;
      const inside = frames.some((f) => cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height);
      if (!inside) continue;
      if (other.type === 'arrow') {
        const a = other as ArrowObject;
        this.frameChildStart.set(other.id, { x: other.x, y: other.y, x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 });
      } else {
        this.frameChildStart.set(other.id, { x: other.x, y: other.y });
      }
    }
  }

  /**
   * Entry point from handlePointerMove while dragging. Raw pointer events can
   * fire far more often than the screen repaints — sampling them is cheap, but
   * the snap search + store commit below is not. Stash the latest point and do
   * the real work at most once per animation frame (the freshest sample wins),
   * so the cursor always feels tightly tracked while the heavy lifting never
   * piles up between frames.
   */
  private scheduleMoveUpdate(sp: Vec2): void {
    this.pendingMoveSp = sp;
    if (this.moveRafId !== null) return;
    this.moveRafId = requestAnimationFrame(() => {
      this.moveRafId = null;
      const next = this.pendingMoveSp;
      this.pendingMoveSp = null;
      if (next && this.mode === 'moving') this.commitMove(next);
    });
  }

  /** Run any coalesced move synchronously — called right before drop so the final position lands exactly under the cursor with no one-frame lag. */
  private flushPendingMove(): void {
    if (this.moveRafId !== null) {
      cancelAnimationFrame(this.moveRafId);
      this.moveRafId = null;
    }
    const next = this.pendingMoveSp;
    this.pendingMoveSp = null;
    if (next) this.commitMove(next);
  }

  private commitMove(sp: Vec2): void {
    const wp = screenToWorld(sp, this.camera);
    let dx = wp.x - this.moveLastWorld.x;
    let dy = wp.y - this.moveLastWorld.y;
    if (dx === 0 && dy === 0) return;

    const store = useCanvasStore.getState();
    const dragging = store.selectedIds
      .map((id) => store.getObject(id))
      .filter((o): o is CanvasObject => !!o);
    if (dragging.length === 0) return;

    const tentative = dragging.map((obj) => ({ ...obj, x: obj.x + dx, y: obj.y + dy }));
    const snap = computeSnap(tentative, this.moveCandidates, this.camera.zoom, this.gridSnap, this.objectSnap);
    dx += snap.dx; dy += snap.dy;
    this.snapGuides = snap.guides;
    this.moveLastWorld = { x: wp.x + snap.dx, y: wp.y + snap.dy };

    // Batch every patch from this tick (selection + carried frame children)
    // into a single store commit — one notification instead of N, which is
    // what made multi-object drags feel like they were stuttering.
    const patches: { id: string; updates: Partial<CanvasObject> }[] = [];

    dragging.forEach((obj) => {
      const newX = obj.x + dx;
      const newY = obj.y + dy;
      if (obj.type === 'arrow') {
        const a = obj as ArrowObject;
        const updates = { x: newX, y: newY, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
        patches.push({ id: obj.id, updates: updates as Partial<CanvasObject> });
        spatialIndex.insert({ ...obj, ...updates });
      } else {
        patches.push({ id: obj.id, updates: { x: newX, y: newY } });
        spatialIndex.insert({ ...obj, x: newX, y: newY });
      }
    });

    // Carry captured frame contents along by the same delta
    if (this.frameChildStart.size > 0) {
      this.frameChildStart.forEach((_start, id) => {
        const obj = store.getObject(id);
        if (!obj) return;
        if (obj.type === 'arrow') {
          const a = obj as ArrowObject;
          const updates = { x: obj.x + dx, y: obj.y + dy, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
          patches.push({ id, updates: updates as Partial<CanvasObject> });
          spatialIndex.insert({ ...obj, ...updates });
        } else {
          patches.push({ id, updates: { x: obj.x + dx, y: obj.y + dy } });
          spatialIndex.insert({ ...obj, x: obj.x + dx, y: obj.y + dy });
        }
      });
    }

    store.updateObjects(patches);
  }

  private endMove(): void {
    // Commit any sample still waiting on a coalesced RAF so the drop lands
    // exactly under the cursor — otherwise the object would visibly settle
    // back to a one-frame-stale position the instant the pointer is released.
    this.flushPendingMove();
    this.dragLiftTarget = 0;

    const store = useCanvasStore.getState();
    // Combine the selected objects with any captured frame children
    const movedIds = [...store.selectedIds, ...this.frameChildStart.keys()];
    const startOf = (id: string) => this.moveStartPositions.get(id) ?? this.frameChildStart.get(id);
    const moves = movedIds
      .map((id) => {
        const obj = store.getObject(id);
        const start = startOf(id);
        if (!obj || !start) return null;
        const from = start;
        const to: typeof start = { x: obj.x, y: obj.y };
        if (obj.type === 'arrow') {
          const a = obj as ArrowObject;
          to.x1 = a.x1; to.y1 = a.y1; to.x2 = a.x2; to.y2 = a.y2;
        }
        return { id, from, to };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .filter((m) => m.from.x !== m.to.x || m.from.y !== m.to.y);
    this.frameChildStart.clear();

    if (moves.length > 0) {
      const applyMoves = (key: 'to' | 'from') => {
        const s = useCanvasStore.getState();
        s.updateObjects(moves.map((m) => ({ id: m.id, updates: m[key] as Partial<CanvasObject> })));
        moves.forEach(({ id }) => {
          const o = s.getObject(id);
          if (o) spatialIndex.insert(o);
        });
      };
      historyManager.push({
        description: 'Move objects',
        execute: () => applyMoves('to'),
        undo: () => applyMoves('from'),
      });
    }
    this.snapGuides = [];
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private startResize(handle: ResizeHandle, obj: CanvasObject, sp: Vec2): void {
    this.mode = 'resizing';
    this.resizeHandle = handle;
    this.resizeObjId = obj.id;
    this.resizeStartBounds = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    this.resizeStartFontSize = obj.type === 'text' ? (obj as TextObject).fontSize : null;
    this.resizeStartWorld = screenToWorld(sp, this.camera);
    if (obj.type === 'arrow') {
      const a = obj as ArrowObject;
      this.arrowResizeStart = { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
    }
  }

  private updateResize(sp: Vec2): void {
    if (!this.resizeHandle || !this.resizeObjId || !this.resizeStartBounds) return;
    const store = useCanvasStore.getState();
    const obj = store.getObject(this.resizeObjId);
    if (!obj) return;

    const wp = screenToWorld(sp, this.camera);

    // Arrow endpoint dragging (no rotation involved)
    if ((this.resizeHandle === 'arrow-start' || this.resizeHandle === 'arrow-end') && obj.type === 'arrow') {
      const a = obj as ArrowObject;
      const nx1 = this.resizeHandle === 'arrow-start' ? wp.x : a.x1;
      const ny1 = this.resizeHandle === 'arrow-start' ? wp.y : a.y1;
      const nx2 = this.resizeHandle === 'arrow-end'   ? wp.x : a.x2;
      const ny2 = this.resizeHandle === 'arrow-end'   ? wp.y : a.y2;
      const bbox = computeArrowBBox(nx1, ny1, nx2, ny2, a.curved, a.bendOffset);
      store.updateObject(this.resizeObjId, { x1: nx1, y1: ny1, x2: nx2, y2: ny2, ...bbox } as Partial<CanvasObject>);
      spatialIndex.insert({ ...obj, ...bbox });
      return;
    }

    const worldDX = wp.x - this.resizeStartWorld.x;
    const worldDY = wp.y - this.resizeStartWorld.y;
    const { x, y, width, height } = this.resizeStartBounds;
    const h = this.resizeHandle;
    const rotation = obj.rotation;

    if (rotation === 0) {
      // Text scales its font size with the drag instead of stretching into an
      // arbitrary box — the bbox is then re-measured so it always hugs the glyphs.
      if (obj.type === 'text') {
        this.updateTextResize(obj as TextObject, h, worldDX, worldDY);
        return;
      }

      // Fast path: no rotation, simple bounding-box resize
      let nx = x, ny = y, nw = width, nh = height;
      if (h.includes('e')) nw = Math.max(2, width + worldDX);
      if (h.includes('s')) nh = Math.max(2, height + worldDY);
      if (h.includes('w')) { nx = x + worldDX; nw = Math.max(2, width - worldDX); }
      if (h.includes('n')) { ny = y + worldDY; nh = Math.max(2, height - worldDY); }
      store.updateObject(this.resizeObjId, { x: nx, y: ny, width: nw, height: nh });
      spatialIndex.insert({ ...obj, x: nx, y: ny, width: nw, height: nh });
      return;
    }

    // Rotation-aware resize: project world delta onto the object's LOCAL axes
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Local-space delta: project world movement onto object axes
    const lDX = worldDX * cos + worldDY * sin;   // along object's X axis
    const lDY = -worldDX * sin + worldDY * cos;  // along object's Y axis

    // Compute new local dimensions, keeping the OPPOSITE edge pinned
    let newW = width, newH = height;
    let csX = 0, csY = 0; // centre-shift in local space

    if (h.includes('e')) { newW = Math.max(2, width + lDX);  csX += (newW - width) / 2; }
    if (h.includes('w')) { newW = Math.max(2, width - lDX);  csX += lDX / 2; }
    if (h.includes('s')) { newH = Math.max(2, height + lDY); csY += (newH - height) / 2; }
    if (h.includes('n')) { newH = Math.max(2, height - lDY); csY += lDY / 2; }

    // Convert local centre-shift back to world space
    const oldCX = x + width / 2;
    const oldCY = y + height / 2;
    const newCX = oldCX + csX * cos - csY * sin;
    const newCY = oldCY + csX * sin + csY * cos;

    const nx = newCX - newW / 2;
    const ny = newCY - newH / 2;
    store.updateObject(this.resizeObjId, { x: nx, y: ny, width: newW, height: newH });
    spatialIndex.insert({ ...obj, x: nx, y: ny, width: newW, height: newH });
  }

  // Dragging a text handle scales its font size uniformly (like resizing an
  // image) rather than stretching a free-form box — the bbox is then
  // re-measured from the new font so the selection outline always hugs the
  // glyphs, with the corner/edge opposite the dragged handle staying anchored.
  private updateTextResize(obj: TextObject, h: ResizeHandle, worldDX: number, worldDY: number): void {
    const store = useCanvasStore.getState();
    if (!this.resizeStartBounds || this.resizeStartFontSize == null) return;
    const { x, y, width, height } = this.resizeStartBounds;
    const startFontSize = this.resizeStartFontSize;

    const dragsW = h.includes('e') || h.includes('w');
    const dragsH = h.includes('n') || h.includes('s');
    const rawW = dragsW ? Math.max(2, width  + (h.includes('w') ? -worldDX : worldDX)) : width;
    const rawH = dragsH ? Math.max(2, height + (h.includes('n') ? -worldDY : worldDY)) : height;
    const scale = dragsW && dragsH ? (rawW / width + rawH / height) / 2 : dragsW ? rawW / width : rawH / height;

    const newFontSize = Math.max(1, startFontSize * scale);
    const { width: mw, height: mh } = measureTextBox({ ...obj, fontSize: newFontSize });

    const anchorX = h.includes('w') ? x + width  : x;
    const anchorY = h.includes('n') ? y + height : y;
    const nx = h.includes('w') ? anchorX - mw : anchorX;
    const ny = h.includes('n') ? anchorY - mh : anchorY;

    store.updateObject(this.resizeObjId!, { x: nx, y: ny, width: mw, height: mh, fontSize: newFontSize });
    spatialIndex.insert({ ...obj, x: nx, y: ny, width: mw, height: mh, fontSize: newFontSize });
  }

  private endResize(): void {
    if (!this.resizeObjId || !this.resizeStartBounds) return;
    const store = useCanvasStore.getState();
    const obj = store.getObject(this.resizeObjId);
    if (!obj) return;

    if (obj.type === 'arrow' && this.arrowResizeStart) {
      const a = obj as ArrowObject;
      const from = this.arrowResizeStart;
      const to = { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
      if (from.x1 !== to.x1 || from.y1 !== to.y1 || from.x2 !== to.x2 || from.y2 !== to.y2) {
        const id = this.resizeObjId;
        historyManager.push({
          description: 'Move arrow endpoint',
          execute: () => {
            const ar = useCanvasStore.getState().getObject(id) as ArrowObject | undefined;
            if (ar) {
              const bbox = computeArrowBBox(to.x1, to.y1, to.x2, to.y2, ar.curved, ar.bendOffset);
              useCanvasStore.getState().updateObject(id, { ...to, ...bbox } as Partial<CanvasObject>);
            }
          },
          undo: () => {
            const ar = useCanvasStore.getState().getObject(id) as ArrowObject | undefined;
            if (ar) {
              const bbox = computeArrowBBox(from.x1, from.y1, from.x2, from.y2, ar.curved, ar.bendOffset);
              useCanvasStore.getState().updateObject(id, { ...from, ...bbox } as Partial<CanvasObject>);
            }
          },
        });
      }
      this.arrowResizeStart = null;
    } else {
      const from: Partial<CanvasObject> = { ...this.resizeStartBounds };
      const to: Partial<CanvasObject> = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
      if (obj.type === 'text' && this.resizeStartFontSize != null) {
        (from as Partial<TextObject>).fontSize = this.resizeStartFontSize;
        (to as Partial<TextObject>).fontSize = (obj as TextObject).fontSize;
      }
      const changed = (Object.keys(to) as (keyof CanvasObject)[]).some((k) => from[k] !== to[k]);
      if (changed) {
        const id = this.resizeObjId;
        historyManager.push({
          description: 'Resize',
          execute: () => { useCanvasStore.getState().updateObject(id, to); },
          undo: () => { useCanvasStore.getState().updateObject(id, from); },
        });
      }
    }

    this.resizeHandle = null;
    this.resizeObjId = null;
    this.resizeStartBounds = null;
    this.resizeStartFontSize = null;
  }

  // ── Selection rect ────────────────────────────────────────────────────────

  private startSelecting(sp: Vec2): void {
    this.mode = 'selecting';
    this.selStartWorld = screenToWorld(sp, this.camera);
    this.selectionRect = { x: sp.x, y: sp.y, width: 0, height: 0 };
  }

  private updateSelecting(sp: Vec2): void {
    const startSX = (this.selStartWorld.x - this.camera.x) * this.camera.zoom;
    const startSY = (this.selStartWorld.y - this.camera.y) * this.camera.zoom;
    this.selectionRect = {
      x: Math.min(startSX, sp.x), y: Math.min(startSY, sp.y),
      width: Math.abs(sp.x - startSX), height: Math.abs(sp.y - startSY),
    };
    const wp = screenToWorld(sp, this.camera);
    const worldRect = {
      minX: Math.min(this.selStartWorld.x, wp.x), minY: Math.min(this.selStartWorld.y, wp.y),
      maxX: Math.max(this.selStartWorld.x, wp.x), maxY: Math.max(this.selStartWorld.y, wp.y),
    };
    if (worldRect.maxX - worldRect.minX > 1 || worldRect.maxY - worldRect.minY > 1) {
      const ids = spatialIndex.search(worldRect).filter((id) => {
        const obj = useCanvasStore.getState().objects[id];
        return obj && !obj.parentId;
      });
      useCanvasStore.getState().setSelectedIds(ids);
    }
  }

  private endSelecting(): void {
    this.selectionRect = null;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private startDraw(sp: Vec2, tool: 'rect' | 'ellipse' | 'diamond' | 'frame'): void {
    this.mode = 'drawing';
    this.drawStartWorld = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const id = nanoid();
    this.drawObjId = id;
    const now = Date.now();
    const ink = defaultInkColor(store.canvasBg);
    const base = {
      id, x: this.drawStartWorld.x, y: this.drawStartWorld.y,
      width: 1, height: 1, rotation: 0, opacity: 1,
      locked: false, visible: true, layerId: 'default', parentId: null,
      zIndex: Object.keys(store.objects).length, createdAt: now, updatedAt: now,
    };
    let obj: CanvasObject;
    if (tool === 'ellipse') {
      obj = { ...base, type: 'ellipse', fill: 'none', stroke: ink, strokeWidth: 1.5 } as EllipseObject;
    } else if (tool === 'diamond') {
      obj = { ...base, type: 'diamond', fill: 'none', stroke: ink, strokeWidth: 1.5 } as DiamondObject;
    } else if (tool === 'frame') {
      // Frames sit behind everything so their contents render on top.
      const minZ = Object.values(store.objects).reduce((m, o) => Math.min(m, o.zIndex), 0);
      const n = store.objects ? Object.values(store.objects).filter((o) => o.type === 'frame').length : 0;
      obj = {
        ...base, type: 'frame', zIndex: minZ - 1,
        name: `Frame ${n + 1}`, fill: 'none', stroke: '#9CA3AF', strokeWidth: 1.5,
      } as FrameObject;
    } else {
      obj = { ...base, type: 'rect', fill: 'none', stroke: ink, strokeWidth: 1.5, cornerRadius: 0 } as RectObject;
    }
    store.addObject(obj);
    store.setSelectedIds([id]);
    spatialIndex.insert(obj);
  }

  private updateDraw(sp: Vec2): void {
    if (!this.drawObjId) return;
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const x = Math.min(this.drawStartWorld.x, wp.x);
    const y = Math.min(this.drawStartWorld.y, wp.y);
    const w = Math.max(1, Math.abs(wp.x - this.drawStartWorld.x));
    const h = Math.max(1, Math.abs(wp.y - this.drawStartWorld.y));
    store.updateObject(this.drawObjId, { x, y, width: w, height: h });
    const obj = store.getObject(this.drawObjId);
    if (obj) spatialIndex.insert({ ...obj, x, y, width: w, height: h });
  }

  private endDraw(): void {
    if (!this.drawObjId) return;
    const store = useCanvasStore.getState();
    let obj = store.getObject(this.drawObjId);
    if (!obj) { this.drawObjId = null; return; }
    if (obj.width < 4 || obj.height < 4) {
      const dw = 120, dh = 80;
      store.updateObject(this.drawObjId, { width: dw, height: dh });
      spatialIndex.insert({ ...obj, width: dw, height: dh });
      obj = store.getObject(this.drawObjId)!;
    }
    const finalObj = { ...obj };
    historyManager.push({
      description: 'Add object',
      execute: () => { useCanvasStore.getState().addObject(finalObj); spatialIndex.insert(finalObj); },
      undo: () => {
        useCanvasStore.getState().removeObject(finalObj.id);
        spatialIndex.remove(finalObj.id);
        useCanvasStore.getState().removeFromSelection(finalObj.id);
      },
    });
    this.drawObjId = null;
    store.setActiveTool('select');
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  private placeText(sp: Vec2): void {
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const id = nanoid();
    const now = Date.now();
    // Create the object provisionally (no history yet — added on commit, deleted on cancel)
    const obj: TextObject = {
      id, type: 'text', x: wp.x, y: wp.y, width: 4, height: 20,
      rotation: 0, opacity: 1, locked: false, visible: true,
      layerId: 'default', parentId: null,
      zIndex: Object.keys(store.objects).length, createdAt: now, updatedAt: now,
      content: '', fontFamily: store.textFontFamily ?? 'Inter, system-ui, sans-serif',
      fontSize: store.textFontSize ?? 20, fontWeight: store.textFontWeight ?? 400,
      color: store.textColor ?? defaultInkColor(store.canvasBg), align: store.textAlign ?? 'left',
    };
    store.addObject(obj);
    spatialIndex.insert(obj);
    store.setSelectedIds([id]);
    store.setEditingTextId(id);
    this.mode = 'editing-text';
  }

  // ── Pen ───────────────────────────────────────────────────────────────────

  private startPen(sp: Vec2): void {
    this.mode = 'drawing-pen';
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    this.penWorldPoints = [wp];
    this.currentPenStroke = {
      worldPoints: this.penWorldPoints,
      color: store.penColor,
      strokeWidth: store.penWidth,
      strokeStyle: store.penStyle,
      opacity: 1,
    };
  }

  private updatePen(sp: Vec2): void {
    const wp = screenToWorld(sp, this.camera);
    const pts = this.penWorldPoints;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      if (Math.hypot(wp.x - last.x, wp.y - last.y) < 3 / this.camera.zoom) return;
    }
    this.penWorldPoints.push(wp);
    this.currentPenStroke = {
      worldPoints: [...this.penWorldPoints],
      color: this.currentPenStroke!.color,
      strokeWidth: this.currentPenStroke!.strokeWidth,
      strokeStyle: this.currentPenStroke!.strokeStyle,
      opacity: 1,
    };
  }

  private endPen(): void {
    const pts = this.penWorldPoints;
    if (pts.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
      if (maxX - minX < 1) maxX = minX + 1;
      if (maxY - minY < 1) maxY = minY + 1;
      const relPoints: PenPoint[] = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      const store = useCanvasStore.getState();
      const now = Date.now();
      const penObj: PenObject = {
        id: nanoid(), type: 'pen',
        x: minX, y: minY, width: maxX - minX, height: maxY - minY,
        rotation: 0, opacity: 1, locked: false, visible: true,
        layerId: 'default', parentId: null,
        zIndex: Object.keys(store.objects).length, createdAt: now, updatedAt: now,
        points: relPoints,
        color: store.penColor,
        strokeWidth: store.penWidth,
        strokeStyle: store.penStyle,
      };
      store.addRecentPenColor(store.penColor);
      store.addObject(penObj);
      spatialIndex.insert(penObj);
      historyManager.push({
        description: 'Pen stroke',
        execute: () => { useCanvasStore.getState().addObject(penObj); spatialIndex.insert(penObj); },
        undo: () => {
          useCanvasStore.getState().removeObject(penObj.id);
          spatialIndex.remove(penObj.id);
          useCanvasStore.getState().removeFromSelection(penObj.id);
        },
      });
      store.setSelectedIds([penObj.id]);
    }
    this.currentPenStroke = null;
    this.penWorldPoints = [];
  }

  // ── Arrow ─────────────────────────────────────────────────────────────────

  private startArrow(sp: Vec2): void {
    this.mode = 'drawing-arrow';
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const id = nanoid();
    this.drawObjId = id;
    const bbox = computeArrowBBox(wp.x, wp.y, wp.x, wp.y, false, 0);
    const now = Date.now();
    const obj: ArrowObject = {
      id, type: 'arrow',
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
      x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y,
      rotation: 0, opacity: 1, locked: false, visible: true,
      layerId: 'default', parentId: null,
      zIndex: Object.keys(store.objects).length, createdAt: now, updatedAt: now,
      curved: false, bendOffset: 0,
      startHead: 'none',
      endHead: useCanvasStore.getState().activeTool === 'line' ? 'none' : 'arrow',
      stroke: defaultInkColor(store.canvasBg), strokeWidth: 1.5,
    };
    store.addObject(obj);
    store.setSelectedIds([id]);
    spatialIndex.insert(obj);
  }

  private updateArrow(sp: Vec2): void {
    if (!this.drawObjId) return;
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const obj = store.getObject(this.drawObjId) as ArrowObject | undefined;
    if (!obj || obj.type !== 'arrow') return;
    const bbox = computeArrowBBox(obj.x1, obj.y1, wp.x, wp.y, false, 0);
    store.updateObject(this.drawObjId, { x2: wp.x, y2: wp.y, ...bbox } as Partial<CanvasObject>);
    const updated = store.getObject(this.drawObjId)!;
    spatialIndex.insert(updated);
  }

  private endArrow(): void {
    if (!this.drawObjId) return;
    const store = useCanvasStore.getState();
    const obj = store.getObject(this.drawObjId);
    if (!obj || obj.type !== 'arrow') { this.drawObjId = null; return; }

    const a = obj as ArrowObject;
    const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);

    if (len < 5 / this.camera.zoom) {
      store.removeObject(this.drawObjId);
      spatialIndex.remove(this.drawObjId);
      store.clearSelection();
    } else {
      const finalObj = { ...obj };
      historyManager.push({
        description: 'Add arrow',
        execute: () => { useCanvasStore.getState().addObject(finalObj); spatialIndex.insert(finalObj); },
        undo: () => {
          useCanvasStore.getState().removeObject(finalObj.id);
          spatialIndex.remove(finalObj.id);
          useCanvasStore.getState().removeFromSelection(finalObj.id);
        },
      });
      store.setActiveTool('select');
    }
    this.drawObjId = null;
  }

  // ── Rotation ──────────────────────────────────────────────────────────────

  private startRotate(obj: CanvasObject, sp: Vec2): void {
    this.mode = 'rotating';
    this.rotateObjId = obj.id;
    this.rotateCenter = {
      x: obj.x + obj.width / 2,
      y: obj.y + obj.height / 2,
    };
    const wp = screenToWorld(sp, this.camera);
    this.rotateStartPointerAngle = Math.atan2(
      wp.y - this.rotateCenter.y,
      wp.x - this.rotateCenter.x,
    );
    this.rotateStartObjAngle = obj.rotation;
    this.currentRotateAngle = obj.rotation;
  }

  private updateRotate(sp: Vec2, snap: boolean): void {
    if (!this.rotateObjId) return;
    const wp = screenToWorld(sp, this.camera);
    const pointerAngle = Math.atan2(
      wp.y - this.rotateCenter.y,
      wp.x - this.rotateCenter.x,
    );
    const delta = pointerAngle - this.rotateStartPointerAngle;
    let deg = this.rotateStartObjAngle + (delta * 180) / Math.PI;

    // Snap to 15° steps when Shift is held
    if (snap) deg = Math.round(deg / 15) * 15;

    // Normalise to [0, 360)
    deg = ((deg % 360) + 360) % 360;

    const store = useCanvasStore.getState();
    store.updateObject(this.rotateObjId, { rotation: deg });
    const updated = store.getObject(this.rotateObjId);
    if (updated) spatialIndex.insert(updated);
    this.currentRotateAngle = deg;
  }

  private endRotate(): void {
    if (!this.rotateObjId) return;
    const store = useCanvasStore.getState();
    const obj = store.getObject(this.rotateObjId);
    if (!obj) return;

    const from = this.rotateStartObjAngle;
    const to = obj.rotation;

    if (Math.abs(from - to) > 0.01) {
      const id = this.rotateObjId;
      historyManager.push({
        description: 'Rotate',
        execute: () => { useCanvasStore.getState().updateObject(id, { rotation: to }); },
        undo: () => { useCanvasStore.getState().updateObject(id, { rotation: from }); },
      });
    }

    this.rotateObjId = null;
    this.currentRotateAngle = null;
  }

  // ── Eraser ────────────────────────────────────────────────────────────────

  private startErase(sp: Vec2, rect: DOMRect): void {
    this.mode = 'erasing';
    this.eraseBeforeMap.clear();
    this.eraseAddedIds.clear();
    this.eraseAt(sp, rect);
  }

  private updateErase(sp: Vec2, rect: DOMRect): void {
    this.eraseAt(sp, rect);
  }

  private eraseAt(sp: Vec2, rect: DOMRect): void {
    const eraserRadius = 14 / this.camera.zoom;
    const wp = screenToWorld(sp, this.camera);
    const store = useCanvasStore.getState();
    const visible = this.getVisibleObjects(rect);

    for (const obj of visible) {
      if (obj.locked) continue;
      if (obj.type === 'pen') {
        this.eraseFromPen(obj as PenObject, wp, eraserRadius);
      } else {
        if (eraserCircleOverlapsBox(wp, eraserRadius, obj)) {
          if (!this.eraseBeforeMap.has(obj.id) && !this.eraseAddedIds.has(obj.id)) {
            this.eraseBeforeMap.set(obj.id, { ...obj });
          }
          this.eraseAddedIds.delete(obj.id);
          store.removeObject(obj.id);
          spatialIndex.remove(obj.id);
          store.removeFromSelection(obj.id);
        }
      }
    }
  }

  private eraseFromPen(stroke: PenObject, eraserWorld: Vec2, eraserRadius: number): void {
    // Fast reject
    if (!eraserCircleOverlapsBox(eraserWorld, eraserRadius, stroke)) return;

    const worldPts = stroke.points.map((p) => ({ x: stroke.x + p.x, y: stroke.y + p.y }));

    // Mark points that are inside the eraser circle or on an erased segment
    const erased = worldPts.map((wp, i) => {
      if (Math.hypot(wp.x - eraserWorld.x, wp.y - eraserWorld.y) <= eraserRadius) return true;
      if (i < worldPts.length - 1 &&
          segDistWorld(eraserWorld, wp, worldPts[i + 1]) <= eraserRadius) return true;
      return false;
    });

    if (!erased.some(Boolean)) return;

    // Record original before first modification
    if (!this.eraseAddedIds.has(stroke.id) && !this.eraseBeforeMap.has(stroke.id)) {
      this.eraseBeforeMap.set(stroke.id, { ...stroke, points: [...stroke.points] } as PenObject);
    }

    this.eraseAddedIds.delete(stroke.id);
    const store = useCanvasStore.getState();
    store.removeObject(stroke.id);
    spatialIndex.remove(stroke.id);
    store.removeFromSelection(stroke.id);

    // Build groups of consecutive surviving (non-erased) points
    const groups: number[][] = [];
    let cur: number[] = [];
    for (let i = 0; i < erased.length; i++) {
      if (!erased[i]) {
        cur.push(i);
      } else if (cur.length) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length) groups.push(cur);

    const now = Date.now();
    for (const indices of groups) {
      if (indices.length < 2) continue;
      const pts = indices.map((i) => worldPts[i]);
      const minX = Math.min(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxX = Math.max(...pts.map((p) => p.x));
      const maxY = Math.max(...pts.map((p) => p.y));
      const sub: PenObject = {
        ...stroke,
        id: nanoid(),
        x: minX, y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })),
        updatedAt: now,
      };
      this.eraseAddedIds.add(sub.id);
      store.addObject(sub);
      spatialIndex.insert(sub);
    }
  }

  private endErase(): void {
    if (this.eraseBeforeMap.size === 0 && this.eraseAddedIds.size === 0) return;

    const beforeObjects = Array.from(this.eraseBeforeMap.values());
    const afterObjects: CanvasObject[] = [];
    this.eraseAddedIds.forEach((id) => {
      const o = useCanvasStore.getState().getObject(id);
      if (o) afterObjects.push({ ...o });
    });

    historyManager.push({
      description: 'Erase',
      execute: () => {
        beforeObjects.forEach((obj) => {
          useCanvasStore.getState().removeObject(obj.id);
          spatialIndex.remove(obj.id);
          useCanvasStore.getState().removeFromSelection(obj.id);
        });
        afterObjects.forEach((obj) => {
          useCanvasStore.getState().addObject(obj);
          spatialIndex.insert(obj);
        });
      },
      undo: () => {
        afterObjects.forEach((obj) => {
          useCanvasStore.getState().removeObject(obj.id);
          spatialIndex.remove(obj.id);
        });
        beforeObjects.forEach((obj) => {
          useCanvasStore.getState().addObject(obj);
          spatialIndex.insert(obj);
        });
      },
    });

    this.eraseBeforeMap.clear();
    this.eraseAddedIds.clear();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteSelected(): void {
    const store = useCanvasStore.getState();
    if (store.selectedIds.length === 0) return;
    historyManager.execute(new RemoveObjectsCommand(store.selectedIds));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sp(e: PointerEvent | WheelEvent, rect: DOMRect): Vec2 {
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private getVisibleObjects(rect: DOMRect): CanvasObject[] {
    const aabb = {
      minX: this.camera.x, minY: this.camera.y,
      maxX: this.camera.x + rect.width / this.camera.zoom,
      maxY: this.camera.y + rect.height / this.camera.zoom,
    };
    const ids = spatialIndex.search(aabb);
    const store = useCanvasStore.getState();
    return ids
      .map((id) => store.getObject(id))
      .filter((o): o is CanvasObject => !!o && !o.parentId)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  private unionAsObj(objects: CanvasObject[]): CanvasObject | null {
    if (objects.length === 0) return null;
    const minX = Math.min(...objects.map((o) => o.x));
    const minY = Math.min(...objects.map((o) => o.y));
    const maxX = Math.max(...objects.map((o) => o.x + o.width));
    const maxY = Math.max(...objects.map((o) => o.y + o.height));
    return { id: '__union__', type: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 } as CanvasObject;
  }
}
