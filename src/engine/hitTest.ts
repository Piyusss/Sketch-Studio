import type { Camera, CanvasObject, ArrowObject, ResizeHandle, Vec2 } from '../types';
import { screenToWorld, worldToScreen } from '../utils/math';

const HANDLE_HIT_RADIUS = 6;
const ARROW_HIT_RADIUS = 8; // screen px tolerance for clicking arrow lines
export const ROTATION_HANDLE_OFFSET = 32; // screen px above selection top
const ROTATION_HANDLE_HIT_RADIUS = 10;

export function hitTest(
  screenPoint: Vec2,
  camera: Camera,
  objects: CanvasObject[],
  includeLocked = false,
): CanvasObject | null {
  const worldPoint = screenToWorld(screenPoint, camera);
  const worldTolerance = ARROW_HIT_RADIUS / camera.zoom;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (!obj.visible) continue;
    if (!includeLocked && obj.locked) continue;
    if (containsPoint(obj, worldPoint, worldTolerance)) return obj;
  }
  return null;
}

export function containsPoint(obj: CanvasObject, p: Vec2, tolerance = 4): boolean {
  if (obj.type === 'arrow') return containsPointArrow(obj as ArrowObject, p, tolerance);
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const local = obj.rotation !== 0
    ? rotatePoint(p, { x: cx, y: cy }, -obj.rotation)
    : p;
  return (
    local.x >= obj.x && local.x <= obj.x + obj.width &&
    local.y >= obj.y && local.y <= obj.y + obj.height
  );
}

function rotatePoint(p: Vec2, around: Vec2, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return { x: around.x + dx * cos - dy * sin, y: around.y + dx * sin + dy * cos };
}

function containsPointArrow(arrow: ArrowObject, p: Vec2, tolerance: number): boolean {
  if (!arrow.curved || arrow.bendOffset === 0) {
    return distToSegment(p, { x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }) <= tolerance;
  }
  // Sample quadratic bezier
  const dx = arrow.x2 - arrow.x1;
  const dy = arrow.y2 - arrow.y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - arrow.x1, p.y - arrow.y1) <= tolerance;
  const mx = (arrow.x1 + arrow.x2) / 2;
  const my = (arrow.y1 + arrow.y2) / 2;
  const cpx = mx - (dy / len) * arrow.bendOffset;
  const cpy = my + (dx / len) * arrow.bendOffset;
  for (let t = 0; t <= 1; t += 0.05) {
    const bt = 1 - t;
    const bx = bt * bt * arrow.x1 + 2 * bt * t * cpx + t * t * arrow.x2;
    const by = bt * bt * arrow.y1 + 2 * bt * t * cpy + t * t * arrow.y2;
    if (Math.hypot(p.x - bx, p.y - by) <= tolerance) return true;
  }
  return false;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ── Handle detection ────────────────────────────────────────────────────────

export function getResizeHandleAtPoint(
  screenPoint: Vec2,
  selectedObj: CanvasObject,
  camera: Camera,
): ResizeHandle | null {
  if (selectedObj.type === 'arrow') return getArrowHandleAtPoint(screenPoint, selectedObj as ArrowObject, camera);
  const positions = getResizeHandlePositions(selectedObj, camera);
  for (const [handle, pos] of Object.entries(positions) as [ResizeHandle, Vec2][]) {
    const dx = screenPoint.x - pos.x;
    const dy = screenPoint.y - pos.y;
    if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) return handle;
  }
  return null;
}

function getArrowHandleAtPoint(screenPoint: Vec2, arrow: ArrowObject, camera: Camera): ResizeHandle | null {
  const s1 = worldToScreen({ x: arrow.x1, y: arrow.y1 }, camera);
  const s2 = worldToScreen({ x: arrow.x2, y: arrow.y2 }, camera);
  const R = HANDLE_HIT_RADIUS + 2;
  if (Math.hypot(screenPoint.x - s1.x, screenPoint.y - s1.y) <= R) return 'arrow-start';
  if (Math.hypot(screenPoint.x - s2.x, screenPoint.y - s2.y) <= R) return 'arrow-end';
  return null;
}

export function getResizeHandlePositions(
  obj: CanvasObject,
  camera: Camera,
): Record<ResizeHandle, Vec2> {
  if (obj.type === 'arrow') {
    const arrow = obj as ArrowObject;
    const s1 = worldToScreen({ x: arrow.x1, y: arrow.y1 }, camera);
    const s2 = worldToScreen({ x: arrow.x2, y: arrow.y2 }, camera);
    const dummy = { x: -9999, y: -9999 };
    return { 'arrow-start': s1, 'arrow-end': s2, nw: dummy, n: dummy, ne: dummy, e: dummy, se: dummy, s: dummy, sw: dummy, w: dummy };
  }
  const tl = worldToScreen({ x: obj.x, y: obj.y }, camera);
  const br = worldToScreen({ x: obj.x + obj.width, y: obj.y + obj.height }, camera);
  const cx = (tl.x + br.x) / 2;
  const cy = (tl.y + br.y) / 2;

  const raw: Record<ResizeHandle, Vec2> = {
    nw: { x: tl.x, y: tl.y }, n: { x: cx, y: tl.y }, ne: { x: br.x, y: tl.y },
    e: { x: br.x, y: cy }, se: { x: br.x, y: br.y }, s: { x: cx, y: br.y },
    sw: { x: tl.x, y: br.y }, w: { x: tl.x, y: cy },
    'arrow-start': { x: -9999, y: -9999 }, 'arrow-end': { x: -9999, y: -9999 },
  };

  if (obj.rotation === 0) return raw;

  // Rotate every handle position around the object's screen-space centre
  const rad = (obj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const result = {} as Record<ResizeHandle, Vec2>;
  for (const [key, pos] of Object.entries(raw) as [ResizeHandle, Vec2][]) {
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    result[key] = {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  }
  return result;
}

/** Returns true if screenPoint is over the rotation handle of obj. Arrows don't have one. */
export function getRotationHandleAtPoint(
  screenPoint: Vec2,
  obj: CanvasObject,
  camera: Camera,
): boolean {
  if (obj.type === 'arrow') return false;
  const { x, y } = getRotationHandleScreenPos(obj, camera);
  const dx = screenPoint.x - x;
  const dy = screenPoint.y - y;
  return dx * dx + dy * dy <= ROTATION_HANDLE_HIT_RADIUS * ROTATION_HANDLE_HIT_RADIUS;
}

export function getRotationHandleScreenPos(obj: CanvasObject, camera: Camera): Vec2 {
  const sx = (obj.x - camera.x) * camera.zoom;
  const sy = (obj.y - camera.y) * camera.zoom;
  const sw = obj.width * camera.zoom;
  const sh = obj.height * camera.zoom;
  // Unrotated position: directly above the top-centre
  const hx = sx + sw / 2;
  const hy = sy - ROTATION_HANDLE_OFFSET;
  if (obj.rotation === 0) return { x: hx, y: hy };
  // Rotate around the object's screen-space centre
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const rad = (obj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = hx - cx;
  const dy = hy - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function getResizeCursor(handle: ResizeHandle): string {
  const cursors: Record<ResizeHandle, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
    se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
    'arrow-start': 'crosshair', 'arrow-end': 'crosshair',
  };
  return cursors[handle];
}

/** Returns the correct resize cursor accounting for the object's current rotation. */
export function getResizeCursorRotated(handle: ResizeHandle, rotationDeg: number): string {
  if (handle === 'arrow-start' || handle === 'arrow-end') return 'crosshair';
  if (rotationDeg === 0) return getResizeCursor(handle);

  // Base direction angle for each handle (degrees, 0 = east, clockwise)
  const BASE: Partial<Record<ResizeHandle, number>> = {
    e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315,
  };
  const base = BASE[handle];
  if (base === undefined) return 'default';

  // Actual visual direction after applying the object's rotation
  const actual = ((base + rotationDeg) % 360 + 360) % 360;

  // Round to nearest 45° bucket → one of 4 bidirectional resize cursors
  const bucket = Math.round(actual / 45) % 4; // 0=ew, 1=nwse, 2=ns, 3=nesw
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][bucket];
}
