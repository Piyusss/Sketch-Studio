import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { Camera, CanvasObject } from '../types';
import { getResizeHandleAtPoint, getResizeCursor, getResizeCursorRotated, getRotationHandleAtPoint, hitTest } from '../engine/hitTest';
import { ContextMenu } from './ContextMenu';
import { useCanvasStore } from '../store/canvasStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { tickCamera } from '../engine/camera';
import { cameraHandle } from '../engine/cameraControl';
import { drawGrid, drawObjects, drawSelection, setRenderRequestCallback } from '../engine/renderer';
import { spatialIndex } from '../engine/spatialIndex';
import { InteractionStateMachine } from '../interaction/stateMachine';
import { handleKeyboardShortcut } from '../interaction/shortcuts';
import { getCameraAABB } from '../utils/math';
import { measureTextBox } from '../utils/textMetrics';
import { createImageObjectFromFile } from '../utils/clipboard';
import { stripBlobUrls } from '../utils/stripBlobUrls';
import { api } from '../lib/api';
import { historyManager } from '../history/historyManager';

const CURSOR_MAP: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  rect: 'crosshair',
  ellipse: 'crosshair',
  text: 'text',
  image: 'crosshair',
  pen: 'crosshair',
  arrow: 'crosshair',
  eraser: 'none',
  laser: 'none',
  frame: 'crosshair',
};

// ── Laser rendering helpers ───────────────────────────────────────────────────

function drawLaserPath(
  ctx: CanvasRenderingContext2D,
  worldPts: { x: number; y: number }[],
  cam: { x: number; y: number; zoom: number },
  opacity: number,
  size: number,
  glow: number,
): void {
  if (worldPts.length < 2) return;
  const toSX = (x: number) => (x - cam.x) * cam.zoom;
  const toSY = (y: number) => (y - cam.y) * cam.zoom;

  const trace = () => {
    ctx.moveTo(toSX(worldPts[0].x), toSY(worldPts[0].y));
    for (let i = 1; i < worldPts.length - 1; i++) {
      const ax = toSX(worldPts[i].x), ay = toSY(worldPts[i].y);
      const bx = toSX(worldPts[i + 1].x), by = toSY(worldPts[i + 1].y);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.lineTo(toSX(worldPts[worldPts.length - 1].x), toSY(worldPts[worldPts.length - 1].y));
  };

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer bloom
  ctx.shadowColor = '#ff2222';
  ctx.shadowBlur = glow * 2;
  ctx.strokeStyle = `rgba(255,80,80,0.25)`;
  ctx.lineWidth = size * 3.5;
  ctx.beginPath(); trace(); ctx.stroke();

  // Mid glow
  ctx.shadowBlur = glow;
  ctx.strokeStyle = `rgba(255,50,50,0.65)`;
  ctx.lineWidth = size * 1.6;
  ctx.beginPath(); trace(); ctx.stroke();

  // Bright core
  ctx.shadowBlur = glow * 0.4;
  ctx.strokeStyle = `rgba(255,210,210,0.95)`;
  ctx.lineWidth = Math.max(1, size * 0.55);
  ctx.beginPath(); trace(); ctx.stroke();

  ctx.restore();
}

function drawLaserDot(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  size: number,
  glow: number,
): void {
  ctx.save();
  ctx.shadowColor = '#ff2222';
  ctx.shadowBlur = glow;
  ctx.fillStyle = 'rgba(255,100,100,0.85)';
  ctx.beginPath();
  ctx.arc(sx, sy, size * 1.1, 0, Math.PI * 2);
  ctx.fill();
  // Bright centre dot
  ctx.shadowBlur = glow * 0.3;
  ctx.fillStyle = 'rgba(255,220,220,1)';
  ctx.beginPath();
  ctx.arc(sx, sy, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const canvasSM = { ref: null as InteractionStateMachine | null };

export function Canvas({ readOnly = false }: { readOnly?: boolean } = {}) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const objRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropOverlayRef = useRef<HTMLDivElement>(null);

  const cameraRef = useRef<Camera>({
    x: -200, y: -150, zoom: 1,
    targetX: -200, targetY: -150, targetZoom: 1,
  });

  const smRef = useRef<InteractionStateMachine>(
    new InteractionStateMachine(cameraRef.current),
  );
  canvasSM.ref = smRef.current;
  smRef.current.readOnly = readOnly;
  // Share the live camera with sibling UI (ZoomControls, Minimap)
  cameraHandle.current = cameraRef.current;

  const rafRef = useRef<number>(0);
  const needsRenderRef = useRef(false);

  // Pinch-to-zoom: track all active pointer positions
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [rotateBadge, setRotateBadge] = useState<{ x: number; y: number; deg: number } | null>(null);

  // Laser pointer — stored in refs, never in Zustand store
  const laserStrokesRef = useRef<Array<{ pts: { x: number; y: number }[]; ts: number }>>([]);
  const laserCurrentRef = useRef<{ pts: { x: number; y: number }[] } | null>(null);
  const laserCursorSXRef = useRef<{ x: number; y: number } | null>(null); // screen coords

  // Inline text editor
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const textIsNewRef = useRef(false);           // true when created by text tool (provisional)
  const textOriginalRef = useRef('');            // content snapshot for cancel on existing text

  // When a text edit session starts, record whether it's new and auto-focus the textarea
  useEffect(() => {
    if (!editingTextId) return;
    const obj = useCanvasStore.getState().objects[editingTextId];
    textIsNewRef.current = (obj as import('../types').TextObject)?.content === '';
    textOriginalRef.current = (obj as import('../types').TextObject)?.content ?? '';
    // Focus after the DOM has rendered the textarea
    requestAnimationFrame(() => {
      if (textEditorRef.current) {
        textEditorRef.current.focus();
        const len = textEditorRef.current.value.length;
        textEditorRef.current.setSelectionRange(len, len);
        autoResizeTextarea(textEditorRef.current);
      }
    });
  }, [editingTextId]);

  // Register render-request callback so async image loads trigger a redraw
  useEffect(() => {
    setRenderRequestCallback(() => { needsRenderRef.current = true; });
    return () => setRenderRequestCallback(() => {});
  }, []);

  // Subscribe to object + bg changes
  useEffect(() => {
    let prevObjects = useCanvasStore.getState().objects;
    let prevBg   = useCanvasStore.getState().canvasBg;
    let prevGrid = useCanvasStore.getState().canvasGrid;
    const unsub = useCanvasStore.subscribe((state) => {
      if (state.objects !== prevObjects) {
        prevObjects = state.objects;
        // No spatialIndex.rebuild here: every mutation path (move, resize,
        // rotate, add/remove, group/ungroup, paste, undo/redo, property edits,
        // bulk load via loadObjects, ...) already keeps the index in sync with
        // surgical insert()/remove()/rebuild() calls at its own call site. A
        // reference-equality check on `objects` is true on *every* edit — so a
        // rebuild here would mean a full O(n log n) tree rebuild on every
        // single drag tick, which was the single biggest source of stutter.
        needsRenderRef.current = true;
      }
      if (state.canvasBg !== prevBg) {
        prevBg = state.canvasBg;
        needsRenderRef.current = true;
      }
      if (state.canvasGrid !== prevGrid) {
        prevGrid = state.canvasGrid;
        needsRenderRef.current = true;
      }
    });
    spatialIndex.rebuild(useCanvasStore.getState().objects);
    return unsub;
  }, []);

  // Autosave canvas to NeonDB — debounced 5 s after last change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveCanvas = useCallback(() => {
    const fileId = useWorkspaceStore.getState().activeFileId;
    if (!fileId) return;
    const store = useCanvasStore.getState();

    api.canvas.save(fileId, {
      objects:    stripBlobUrls(store.objects),
      bg_color:   store.canvasBg,
      grid_style: store.canvasGrid,
    }).catch(() => { /* silent — offline */ });
  }, []);

  useEffect(() => {
    const unsub = useCanvasStore.subscribe(() => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveCanvas, 5000);
    });
    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Final save on unmount
      const fileId = useWorkspaceStore.getState().activeFileId;
      if (fileId) {
        const s = useCanvasStore.getState();
        api.canvas.save(fileId, {
          objects:    stripBlobUrls(s.objects),
          bg_color:   s.canvasBg,
          grid_style: s.canvasGrid,
        }).catch(() => {});
      }
    };
  }, [saveCanvas]);

  // Keep canvasBg in sync for the CSS background (prevents flash when canvas briefly clears)
  const canvasBgRef = useRef(useCanvasStore.getState().canvasBg);
  const [canvasBgCss, setCanvasBgCss] = useState(canvasBgRef.current);
  useEffect(() => {
    return useCanvasStore.subscribe((s) => {
      if (s.canvasBg !== canvasBgRef.current) {
        canvasBgRef.current = s.canvasBg;
        setCanvasBgCss(s.canvasBg);
      }
    });
  }, []);

  const resize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Skip if nothing changed — setting canvas.width clears the canvas even for same value
    if (gridRef.current?.width === w && gridRef.current?.height === h) return;
    for (const r of [gridRef, objRef, selRef]) {
      if (r.current) { r.current.width = w; r.current.height = h; }
    }
    needsRenderRef.current = true;
  }, []);

  // Prevent browser-level page zoom on Ctrl+Scroll — must be non-passive to call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const cam = cameraRef.current;
      const moved = tickCamera(cam, dt);
      const lifting = smRef.current.tickDragLift(dt);
      if (moved || lifting) needsRenderRef.current = true;

      if (needsRenderRef.current) {
        needsRenderRef.current = false;
        const container = containerRef.current;
        if (container) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          const store = useCanvasStore.getState();

          // Grid
          const gCtx = gridRef.current?.getContext('2d');
          if (gCtx) drawGrid(gCtx, cam, w, h, store.canvasBg, store.canvasGrid);

          // Objects (all objects including group children via group renderer)
          const aabb = getCameraAABB(cam, w, h);
          const visibleIds = spatialIndex.search(aabb).filter((id) => !store.objects[id]?.parentId);
          const visible = visibleIds
            .map((id) => store.objects[id])
            .filter(Boolean)
            .sort((a, b) => a.zIndex - b.zIndex);

          const oCtx = objRef.current?.getContext('2d');
          if (oCtx) {
            const sm = smRef.current;
            const liftedIds = sm.dragLift > 0.001 ? sm.liftedIds : null;
            drawObjects(oCtx, visible, cam, w, h, store.objects, store.editingTextId, liftedIds, sm.dragLift);
          }

          // Keep the inline text editor aligned with the world when panning/zooming
          if (textEditorRef.current && store.editingTextId) {
            const editObj = store.objects[store.editingTextId] as import('../types').TextObject | undefined;
            if (editObj && editObj.type === 'text') {
              const esx = (editObj.x - cam.x) * cam.zoom;
              const esy = (editObj.y - cam.y) * cam.zoom;
              textEditorRef.current.style.left   = `${esx}px`;
              textEditorRef.current.style.top    = `${esy}px`;
              textEditorRef.current.style.fontSize = `${editObj.fontSize * cam.zoom}px`;
              textEditorRef.current.style.lineHeight = String(editObj.lineHeight ?? 1.25);
            }
          }

          // Selection + snap guides
          const sCtx = selRef.current?.getContext('2d');
          if (sCtx) {
            const sel = store.selectedIds.map((id) => store.objects[id]).filter(Boolean);
            drawSelection(sCtx, sel, cam, w, h, smRef.current.selectionRect, smRef.current.snapGuides, smRef.current.currentPenStroke);

            // ── Laser overlay (not saved, not exported) ─────────────────────
            const now = Date.now();
            const { laserSize, laserGlow } = store;

            // Expire old strokes
            laserStrokesRef.current = laserStrokesRef.current.filter((s) => now - s.ts < 3000);

            // Render fading completed strokes
            for (const stroke of laserStrokesRef.current) {
              const age = now - stroke.ts;
              const opacity = age < 2000 ? 1 : 1 - (age - 2000) / 1000;
              drawLaserPath(sCtx, stroke.pts, cam, opacity, laserSize, laserGlow);
            }

            // Render active (in-progress) stroke
            if (laserCurrentRef.current && laserCurrentRef.current.pts.length >= 2) {
              drawLaserPath(sCtx, laserCurrentRef.current.pts, cam, 1, laserSize, laserGlow);
            }

            // Render cursor dot
            if (store.activeTool === 'laser' && laserCursorSXRef.current) {
              drawLaserDot(sCtx, laserCursorSXRef.current.x, laserCursorSXRef.current.y, laserSize, laserGlow);
            }

            // Keep animating while strokes are live
            if (laserStrokesRef.current.length > 0 || laserCurrentRef.current) {
              needsRenderRef.current = true;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [resize]);

  // Keyboard (disabled in read-only shared view)
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      smRef.current.handleKeyDown(e);
      handleKeyboardShortcut(e, cameraRef.current);
    };
    const onKeyUp = (e: KeyboardEvent) => smRef.current.handleKeyUp(e);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [readOnly]);

  const getRect = useCallback(
    () => containerRef.current?.getBoundingClientRect() ?? new DOMRect(),
    [],
  );

  const setCursor = useCallback((cursor: string) => {
    if (containerRef.current) containerRef.current.style.cursor = cursor;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Track all active pointers for pinch-to-zoom detection
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (readOnly) {
      smRef.current.updateCamera(cameraRef.current);
      smRef.current.handlePointerDown(e.nativeEvent, getRect()); // always pans
      setCursor('grabbing');
      needsRenderRef.current = true;
      return;
    }

    const tool = useCanvasStore.getState().activeTool;

    if (tool === 'laser') {
      const rect = getRect();
      const cam = cameraRef.current;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = cam.x + sx / cam.zoom;
      const wy = cam.y + sy / cam.zoom;
      laserCurrentRef.current = { pts: [{ x: wx, y: wy }] };
      needsRenderRef.current = true;
      return;
    }

    smRef.current.updateCamera(cameraRef.current);
    smRef.current.handlePointerDown(e.nativeEvent, getRect());
    if (smRef.current.mode === 'panning') setCursor('grabbing');
    needsRenderRef.current = true;
  }, [getRect, setCursor, readOnly]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // ── Pinch-to-zoom (two-finger gesture) ───────────────────────────────────
    if (activePointersRef.current.size === 2 && activePointersRef.current.has(e.pointerId)) {
      const prevPos = activePointersRef.current.get(e.pointerId)!;
      // Find the other pointer
      let otherPos: { x: number; y: number } | null = null;
      activePointersRef.current.forEach((pos, id) => {
        if (id !== e.pointerId) otherPos = pos as { x: number; y: number };
      });
      if (otherPos != null) {
        const op = otherPos as { x: number; y: number };
        const prevDist = Math.hypot(prevPos.x - op.x, prevPos.y - op.y);
        const newDist  = Math.hypot(e.clientX - op.x, e.clientY - op.y);
        if (prevDist > 0 && newDist > 0 && Math.abs(newDist - prevDist) > 0.5) {
          const rect  = getRect();
          const cx    = ((e.clientX + op.x) / 2) - rect.left;
          const cy    = ((e.clientY + op.y) / 2) - rect.top;
          // Map pinch scale to a wheel-like delta (positive = zoom out, negative = zoom in)
          const delta = (prevDist - newDist) * 2.5;
          smRef.current.updateCamera(cameraRef.current);
          smRef.current.handleWheel(
            new WheelEvent('wheel', { deltaY: delta, clientX: cx + rect.left, clientY: cy + rect.top, ctrlKey: true }),
            rect,
          );
          needsRenderRef.current = true;
        }
      }
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return; // don't pass pinch moves to the state machine
    }

    // Track single-finger position
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (readOnly) {
      smRef.current.updateCamera(cameraRef.current);
      smRef.current.handlePointerMove(e.nativeEvent, getRect());
      needsRenderRef.current = true;
      return;
    }

    const tool = useCanvasStore.getState().activeTool;
    const rect = getRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (tool === 'laser') {
      const cam = cameraRef.current;
      const wx = cam.x + sx / cam.zoom;
      const wy = cam.y + sy / cam.zoom;
      laserCursorSXRef.current = { x: sx, y: sy };
      if (laserCurrentRef.current) {
        laserCurrentRef.current.pts.push({ x: wx, y: wy });
      }
      needsRenderRef.current = true;
      setEraserPos(null);
      return;
    }

    smRef.current.updateCamera(cameraRef.current);
    smRef.current.handlePointerMove(e.nativeEvent, rect);
    needsRenderRef.current = true;

    // ── Cursor feedback ───────────────────────────────────────────────────
    const mode = smRef.current.mode;
    if (mode === 'panning') {
      setCursor('grabbing');
    } else if (mode === 'resizing') {
      const h = smRef.current.activeResizeHandle;
      if (h) {
        const store2 = useCanvasStore.getState();
        const resizeObj = store2.selectedIds.length === 1 ? store2.getObject(store2.selectedIds[0]) : null;
        setCursor(resizeObj ? getResizeCursorRotated(h, resizeObj.rotation) : getResizeCursor(h));
      }
    } else if (mode === 'rotating') {
      setCursor('grabbing');
      // Update angle badge
      const deg = smRef.current.currentRotateAngle;
      if (deg !== null) {
        setRotateBadge({ x: sx + 16, y: sy - 16, deg: Math.round(deg * 10) / 10 });
      }
    } else if (mode === 'drawing-pen') {
      setCursor('crosshair');
    } else if (mode === 'moving') {
      setCursor('grabbing');
    } else if (tool === 'select' && mode === 'idle') {
      const store = useCanvasStore.getState();
      const sp2 = { x: sx, y: sy };
      let hoverCursor = 'default';

      if (store.selectedIds.length === 1) {
        const sel = store.getObject(store.selectedIds[0]);
        if (sel && !sel.locked) {
          // Check rotation handle first
          if (getRotationHandleAtPoint(sp2, sel, cameraRef.current)) {
            hoverCursor = 'grab';
          } else {
            const h = getResizeHandleAtPoint(sp2, sel, cameraRef.current);
            if (h) hoverCursor = getResizeCursorRotated(h, sel.rotation);
          }
        }
      } else if (store.selectedIds.length > 1) {
        const objs = store.selectedIds
          .map((id) => store.getObject(id))
          .filter((o): o is CanvasObject => !!o);
        if (objs.length > 0) {
          const minX = Math.min(...objs.map((o) => o.x));
          const minY = Math.min(...objs.map((o) => o.y));
          const maxX = Math.max(...objs.map((o) => o.x + o.width));
          const maxY = Math.max(...objs.map((o) => o.y + o.height));
          const union = { id: '__union__', type: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY } as CanvasObject;
          const h = getResizeHandleAtPoint(sp2, union, cameraRef.current);
          if (h) hoverCursor = getResizeCursor(h);
        }
      }

      setCursor(hoverCursor);
    } else {
      setCursor(CURSOR_MAP[tool] ?? 'default');
    }

    if (tool === 'eraser') {
      setEraserPos({ x: sx, y: sy });
    } else {
      setEraserPos(null);
    }
  }, [getRect, setCursor, readOnly]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);

    if (readOnly) {
      smRef.current.updateCamera(cameraRef.current);
      smRef.current.handlePointerUp(e.nativeEvent, getRect());
      setCursor('grab');
      needsRenderRef.current = true;
      return;
    }

    const tool = useCanvasStore.getState().activeTool;
    if (tool === 'laser') {
      if (laserCurrentRef.current && laserCurrentRef.current.pts.length >= 2) {
        laserStrokesRef.current.push({ pts: laserCurrentRef.current.pts, ts: Date.now() });
      }
      laserCurrentRef.current = null;
      needsRenderRef.current = true;
      return;
    }

    smRef.current.updateCamera(cameraRef.current);
    smRef.current.handlePointerUp(e.nativeEvent, getRect());
    const activeTool2 = useCanvasStore.getState().activeTool;
    setCursor(CURSOR_MAP[activeTool2] ?? 'default');
    needsRenderRef.current = true;
    setRotateBadge(null);
  }, [getRect, setCursor, readOnly]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    smRef.current.updateCamera(cameraRef.current);
    smRef.current.handleWheel(e.nativeEvent, getRect());
    needsRenderRef.current = true;
  }, [getRect]);

  const onPointerLeave = useCallback(() => {
    setEraserPos(null);
    laserCursorSXRef.current = null;
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (readOnly) return; // no editing menu in shared view
    const rect = getRect();
    const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const store = useCanvasStore.getState();
    const visibleObjs = Object.values(store.objects)
      .filter((o) => !o.parentId && o.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
    // Hit-test including locked objects so right-click always works
    const hit = hitTest(sp, cameraRef.current, visibleObjs, true);
    if (hit) {
      // Select the clicked object if not already in selection
      if (!store.selectedIds.includes(hit.id)) {
        store.setSelectedIds([hit.id]);
      }
      setCtxMenu({ x: e.clientX, y: e.clientY });
    }
  }, [getRect, readOnly]);

  // ── Image drag & drop ────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dropOverlayRef.current) dropOverlayRef.current.style.opacity = '1';
  }, [readOnly]);

  const onDragLeave = useCallback(() => {
    if (dropOverlayRef.current) dropOverlayRef.current.style.opacity = '0';
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    if (dropOverlayRef.current) dropOverlayRef.current.style.opacity = '0';

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length === 0) return;

    const rect = getRect();
    const cam = cameraRef.current;

    for (const file of files) {
      const dropX = cam.x + (e.clientX - rect.left) / cam.zoom;
      const dropY = cam.y + (e.clientY - rect.top) / cam.zoom;
      await createImageObjectFromFile(file, { x: dropX, y: dropY });
    }
  }, [getRect, readOnly]);

  // ── Inline text editor helpers ─────────────────────────────────────────────

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = '1px';
    el.style.height = `${el.scrollHeight}px`;
    el.style.width = '1px';
    el.style.width = `${Math.max(40, el.scrollWidth)}px`;
  }

  function commitTextEdit() {
    const id = useCanvasStore.getState().editingTextId;
    if (!id || !textEditorRef.current) return;

    const content = textEditorRef.current.value;
    const obj = useCanvasStore.getState().objects[id] as import('../types').TextObject | undefined;
    if (!obj || obj.type !== 'text') return;

    // Measure world-space size the same way `drawText` lays out glyphs, so the
    // stored bbox (and selection outline) always matches what's rendered —
    // the textarea's DOM layout (with its enforced min-width) doesn't.
    const { width: worldW, height: worldH } = measureTextBox({ ...obj, content });

    if (textIsNewRef.current) {
      if (!content.trim()) {
        // Empty new text — remove without history
        useCanvasStore.getState().removeObject(id);
        spatialIndex.remove(id);
        useCanvasStore.getState().removeFromSelection(id);
      } else {
        // Finalize new text + add to undo history
        useCanvasStore.getState().updateObject(id, { content, width: worldW, height: worldH });
        const finalObj = { ...obj, content, width: worldW, height: worldH };
        spatialIndex.insert(finalObj);
        // Sync text defaults so next text uses same style
        const store2 = useCanvasStore.getState();
        store2.setTextFontFamily(obj.fontFamily);
        store2.setTextFontSize(obj.fontSize);
        store2.setTextFontWeight(obj.fontWeight);
        store2.setTextColor(obj.color);
        store2.setTextAlign(obj.align);
        historyManager.push({
          description: 'Add text',
          execute: () => { useCanvasStore.getState().addObject(finalObj); spatialIndex.insert(finalObj); },
          undo: () => {
            useCanvasStore.getState().removeObject(id);
            spatialIndex.remove(id);
            useCanvasStore.getState().removeFromSelection(id);
          },
        });
      }
    } else if (content !== textOriginalRef.current) {
      // Existing text, content changed
      const prevContent = textOriginalRef.current;
      const prevDims = { width: obj.width, height: obj.height };
      useCanvasStore.getState().updateObject(id, { content, width: worldW, height: worldH });
      const updatedObj = useCanvasStore.getState().getObject(id)!;
      spatialIndex.insert(updatedObj);
      historyManager.push({
        description: 'Edit text',
        execute: () => { useCanvasStore.getState().updateObject(id, { content, width: worldW, height: worldH }); },
        undo: () => { useCanvasStore.getState().updateObject(id, { content: prevContent, ...prevDims }); },
      });
    }

    useCanvasStore.getState().setEditingTextId(null);
    useCanvasStore.getState().setActiveTool('select');
    smRef.current.mode = 'idle';
  }

  function cancelTextEdit() {
    const id = useCanvasStore.getState().editingTextId;
    if (!id) return;
    if (textIsNewRef.current) {
      useCanvasStore.getState().removeObject(id);
      spatialIndex.remove(id);
      useCanvasStore.getState().removeFromSelection(id);
    } else {
      // Restore original content
      useCanvasStore.getState().updateObject(id, { content: textOriginalRef.current });
      const restored = useCanvasStore.getState().getObject(id);
      if (restored) spatialIndex.insert(restored);
    }
    useCanvasStore.getState().setEditingTextId(null);
    useCanvasStore.getState().setActiveTool('select');
    smRef.current.mode = 'idle';
  }

  // Update cursor when active tool changes (read-only view always shows a grab cursor)
  const activeTool = useCanvasStore((s) => s.activeTool);
  useEffect(() => {
    setCursor(readOnly ? 'grab' : (CURSOR_MAP[activeTool] ?? 'default'));
  }, [activeTool, setCursor, readOnly]);

  return (
    <div
      ref={containerRef}
      className="canvas-touch-surface"
      style={{
        position: 'relative', width: '100%', height: '100%',
        overflow: 'hidden',
        // CSS background matches canvasBg so the gap between canvas.clearRect and
        // the next RAF draw never shows a black/white flash
        background: canvasBgCss,
        cursor: readOnly ? 'grab' : (CURSOR_MAP[activeTool] ?? 'default'),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={gridRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={objRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={selRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* ── Inline text editor ─────────────────────────────────────────────── */}
      {editingTextId && (() => {
        const editObj = useCanvasStore.getState().objects[editingTextId] as import('../types').TextObject | undefined;
        if (!editObj || editObj.type !== 'text') return null;
        const cam = cameraRef.current;
        const sx = (editObj.x - cam.x) * cam.zoom;
        const sy = (editObj.y - cam.y) * cam.zoom;
        return (
          <textarea
            ref={textEditorRef}
            defaultValue={editObj.content}
            onInput={(e) => autoResizeTextarea(e.currentTarget as HTMLTextAreaElement)}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelTextEdit(); }
              if (e.key === 'Tab')    { e.preventDefault(); commitTextEdit(); }
              // Ctrl+Enter / Shift+Enter: commit
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitTextEdit(); }
            }}
            style={{
              position: 'absolute',
              left: sx, top: sy,
              minWidth: 40,
              fontFamily: editObj.fontFamily,
              fontSize: editObj.fontSize * cam.zoom,
              fontWeight: editObj.fontWeight,
              color: editObj.color,
              textAlign: editObj.align,
              lineHeight: editObj.lineHeight ?? 1.25,
              opacity: editObj.opacity,
              background: 'transparent',
              border: 'none',
              outline: '1.5px solid rgba(99,102,241,0.55)',
              outlineOffset: 4,
              borderRadius: 2,
              resize: 'none',
              overflow: 'hidden',
              padding: 0, margin: 0,
              whiteSpace: 'pre',
              zIndex: 100,
              cursor: 'text',
              caretColor: editObj.color,
            }}
          />
        );
      })()}

      {/* Rotation angle badge */}
      {rotateBadge && (
        <div style={{
          position: 'absolute',
          left: rotateBadge.x, top: rotateBadge.y,
          background: '#18181B', color: '#fff',
          fontSize: 12, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif',
          padding: '3px 8px', borderRadius: 6,
          pointerEvents: 'none', zIndex: 60,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>
          {rotateBadge.deg}°
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Eraser indicator */}
      {eraserPos && (
        <div style={{
          position: 'absolute',
          left: eraserPos.x - 14, top: eraserPos.y - 14,
          width: 28, height: 28,
          border: '2px solid #EF4444',
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.08)',
          pointerEvents: 'none',
          zIndex: 60,
        }} />
      )}

      {/* Drop overlay */}
      <div
        ref={dropOverlayRef}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(37,99,235,0.08)',
          border: '2px dashed #2563EB',
          borderRadius: 4,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.1s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600, color: '#2563EB', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Drop image here
        </span>
      </div>
    </div>
  );
}
