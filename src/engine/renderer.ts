import type {
  Camera,
  CanvasObject,
  RectObject,
  EllipseObject,
  DiamondObject,
  TextObject,
  GroupObject,
  ImageObject,
  PenObject,
  ArrowObject,
  FrameObject,
  Vec2,
  SnapGuide,
  StrokeStyle,
  CanvasGridStyle,
} from '../types';
import { ROTATION_HANDLE_OFFSET } from './hitTest';
import { getImage } from './imageCache';

const SELECTION_COLOR = '#2563EB';
const SELECTION_FILL = 'rgba(37,99,235,0.06)';
const SNAP_GUIDE_COLOR = 'rgba(239,68,68,0.8)';
const HANDLE_SIZE = 8;
const GRID_DOT_RADIUS = 1;
const GRID_WORLD_SIZE = 40;

// Returns relative luminance (0=black, 1=white) of a hex color
function hexLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function gridDotColor(bgColor: string): string {
  const lum = hexLuminance(bgColor);
  if (lum < 0.08) return 'rgba(255,255,255,0.10)';   // near-black bg
  if (lum < 0.20) return 'rgba(255,255,255,0.13)';   // dark bg
  if (lum < 0.40) return 'rgba(255,255,255,0.16)';   // mid-dark bg
  return 'rgba(0,0,0,0.09)';                          // light bg — was a fully-opaque solid grey, now a faint tint
}

// Expose a render-request callback so image async loads can trigger re-render
let requestRender: (() => void) | null = null;
export function setRenderRequestCallback(fn: () => void): void {
  requestRender = fn;
}

// ─── Grid ──────────────────────────────────────────────────────────────────

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  bgColor = '#F7F7F8',
  gridStyle: CanvasGridStyle = 'dots',
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (gridStyle === 'none') return;

  let gridSize = GRID_WORLD_SIZE;
  if (camera.zoom < 0.3) gridSize = GRID_WORLD_SIZE * 8;
  else if (camera.zoom < 0.6) gridSize = GRID_WORLD_SIZE * 4;
  else if (camera.zoom < 1.0) gridSize = GRID_WORLD_SIZE * 2;

  const screenGridSize = gridSize * camera.zoom;
  if (screenGridSize < 6) return;

  const worldRight  = camera.x + width  / camera.zoom;
  const worldBottom = camera.y + height / camera.zoom;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;
  const color = gridDotColor(bgColor);

  if (gridStyle === 'dots') {
    ctx.fillStyle = color;
    for (let wx = startX; wx <= worldRight; wx += gridSize) {
      for (let wy = startY; wy <= worldBottom; wy += gridSize) {
        const sx = (wx - camera.x) * camera.zoom;
        const sy = (wy - camera.y) * camera.zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, GRID_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // 'grid' — horizontal + vertical lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let wx = startX; wx <= worldRight; wx += gridSize) {
      const sx = Math.round((wx - camera.x) * camera.zoom) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let wy = startY; wy <= worldBottom; wy += gridSize) {
      const sy = Math.round((wy - camera.y) * camera.zoom) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }
}

// ─── Objects ───────────────────────────────────────────────────────────────

export function drawObjects(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  camera: Camera,
  width: number,
  height: number,
  allObjects: Record<string, CanvasObject>,
  editingTextId?: string | null,
  liftedIds?: ReadonlySet<string> | null,
  dragLift?: number,
): void {
  ctx.clearRect(0, 0, width, height);
  const lift = dragLift ?? 0;
  for (const obj of objects) {
    if (!obj.visible) continue;
    if (editingTextId && obj.id === editingTextId) continue; // textarea overlay shows instead
    drawObject(ctx, obj, camera, allObjects, liftedIds?.has(obj.id) ? lift : 0);
  }
}

/**
 * Render objects for PNG export. Unlike drawObjects (which clears to transparent),
 * this optionally fills a solid background first, then paints objects on top
 * without clearing — so the exported image keeps the canvas background colour.
 * The grid is intentionally omitted from exports.
 */
export function renderForExport(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  allObjects: Record<string, CanvasObject>,
  camera: Camera,
  width: number,
  height: number,
  bgColor?: string,
): void {
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
  for (const obj of objects) {
    if (!obj.visible) continue;
    drawObject(ctx, obj, camera, allObjects);
  }
}

/**
 * Soft elevation shadow applied to objects actively being dragged. `lift`
 * ranges 0..1 (eased in the state machine — see tickDragLift) so the shadow
 * grows in on pickup and melts away on drop rather than snapping on/off.
 * Shadow properties persist through translate/rotate and apply uniformly to
 * fills, strokes and images, so one switch covers every object type.
 */
function applyDragLift(ctx: CanvasRenderingContext2D, lift: number): void {
  ctx.shadowColor = `rgba(15, 23, 42, ${(0.28 * lift).toFixed(3)})`;
  ctx.shadowBlur = 22 * lift;
  ctx.shadowOffsetY = 7 * lift;
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  camera: Camera,
  allObjects: Record<string, CanvasObject>,
  lift = 0,
): void {
  // Arrows use absolute world coordinates — no bbox transform needed
  if (obj.type === 'arrow') {
    ctx.save();
    ctx.globalAlpha = obj.opacity;
    if (lift > 0.001) applyDragLift(ctx, lift);
    drawArrow(ctx, obj as ArrowObject, camera);
    ctx.restore();
    return;
  }

  const sx = (obj.x - camera.x) * camera.zoom;
  const sy = (obj.y - camera.y) * camera.zoom;
  const sw = obj.width * camera.zoom;
  const sh = obj.height * camera.zoom;

  ctx.save();
  ctx.globalAlpha = obj.opacity;
  if (lift > 0.001) applyDragLift(ctx, lift);

  if (obj.rotation !== 0) {
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    ctx.translate(cx, cy);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (obj.type) {
    case 'rect':
      drawRect(ctx, obj as RectObject, sx, sy, sw, sh);
      break;
    case 'ellipse':
      drawEllipse(ctx, obj as EllipseObject, sx, sy, sw, sh);
      break;
    case 'diamond':
      drawDiamond(ctx, obj as DiamondObject, sx, sy, sw, sh);
      break;
    case 'text':
      drawText(ctx, obj as TextObject, sx, sy, sw, sh, camera.zoom);
      break;
    case 'image':
      drawImage(ctx, obj as ImageObject, sx, sy, sw, sh);
      break;
    case 'pen':
      drawPen(ctx, obj as PenObject, sx, sy, camera.zoom);
      break;
    case 'group':
      drawGroup(ctx, obj as GroupObject, camera, allObjects);
      break;
    case 'frame':
      drawFrame(ctx, obj as FrameObject, sx, sy, sw, sh, camera.zoom);
      break;
  }

  ctx.restore();
}

const FRAME_STROKE = '#9CA3AF';

function drawFrame(
  ctx: CanvasRenderingContext2D,
  obj: FrameObject,
  sx: number, sy: number, sw: number, sh: number,
  zoom: number,
): void {
  // Subtle background fill
  if (obj.fill && obj.fill !== 'none') {
    ctx.fillStyle = obj.fill;
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.fill();
  }
  // Border
  ctx.strokeStyle = obj.stroke && obj.stroke !== 'none' ? obj.stroke : FRAME_STROKE;
  ctx.lineWidth = (obj.strokeWidth || 1) * zoom;
  ctx.setLineDash([]);
  ctx.strokeRect(sx, sy, sw, sh);

  // Title label above the top-left corner
  const fontSize = Math.max(11, 13 * zoom);
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = obj.stroke && obj.stroke !== 'none' ? obj.stroke : '#6B7280';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const label = obj.name || 'Frame';
  // Clip the label to the frame width so long names don't overflow wildly
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy - fontSize - 8 * zoom, Math.max(sw, 60), fontSize + 8 * zoom);
  ctx.clip();
  ctx.fillText(label, sx + 1, sy - 4 * zoom);
  ctx.restore();
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  obj: RectObject,
  sx: number, sy: number, sw: number, sh: number,
): void {
  ctx.beginPath();
  const r = Math.min((obj.cornerRadius ?? 0) * (sw / obj.width), sw / 2, sh / 2);
  if (r > 0) {
    ctx.roundRect(sx, sy, sw, sh, r);
  } else {
    ctx.rect(sx, sy, sw, sh);
  }
  if (obj.fill && obj.fill !== 'none') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }
  if (obj.stroke && obj.stroke !== 'none' && obj.strokeWidth > 0) {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  obj: EllipseObject,
  sx: number, sy: number, sw: number, sh: number,
): void {
  ctx.beginPath();
  ctx.ellipse(sx + sw / 2, sy + sh / 2, Math.max(sw / 2, 0.1), Math.max(sh / 2, 0.1), 0, 0, Math.PI * 2);
  if (obj.fill && obj.fill !== 'none') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }
  if (obj.stroke && obj.stroke !== 'none' && obj.strokeWidth > 0) {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  obj: DiamondObject,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  ctx.beginPath();
  ctx.moveTo(cx, sy);
  ctx.lineTo(sx + sw, cy);
  ctx.lineTo(cx, sy + sh);
  ctx.lineTo(sx, cy);
  ctx.closePath();
  if (obj.fill && obj.fill !== 'none') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }
  if (obj.stroke && obj.stroke !== 'none' && obj.strokeWidth > 0) {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  obj: TextObject,
  sx: number, sy: number, sw: number, _sh: number,
  zoom: number,
): void {
  if (!obj.content) return;
  const fontSize = Math.max(obj.fontSize * zoom, 1);
  const lh = (obj.lineHeight ?? 1.25) * fontSize;
  ctx.font = `${obj.fontWeight} ${fontSize}px ${obj.fontFamily}`;
  ctx.fillStyle = obj.color;
  ctx.textAlign = obj.align as CanvasTextAlign;
  ctx.textBaseline = 'top';
  const textX =
    obj.align === 'center' ? sx + sw / 2 : obj.align === 'right' ? sx + sw : sx;
  const lines = obj.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, sy + i * lh);
  }
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  obj: ImageObject,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const img = getImage(obj.src, () => requestRender?.());

  if (!img) {
    // Placeholder
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, sh);
    // Image icon
    const iconSize = Math.min(sw, sh) * 0.3;
    const icx = sx + sw / 2, icy = sy + sh / 2;
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(icx - iconSize / 2, icy - iconSize / 2, iconSize, iconSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(icx - iconSize * 0.15, icy - iconSize * 0.15, iconSize * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  ctx.drawImage(
    img,
    obj.cropX, obj.cropY, obj.cropWidth, obj.cropHeight,
    sx, sy, sw, sh,
  );
  ctx.restore();
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D, style: StrokeStyle | undefined, zoom: number, width: number): void {
  if (style === 'dashed') {
    ctx.setLineDash([Math.max(6, width * 3) * zoom, Math.max(3, width * 1.5) * zoom]);
  } else if (style === 'dotted') {
    ctx.setLineDash([width * zoom, (width + 3) * zoom]);
    ctx.lineCap = 'round';
  } else {
    ctx.setLineDash([]);
  }
}

function drawPen(
  ctx: CanvasRenderingContext2D,
  obj: PenObject,
  sx: number, sy: number,
  zoom: number,
): void {
  const pts = obj.points;
  if (pts.length < 1) return;

  ctx.save();
  ctx.strokeStyle = obj.color;
  ctx.lineWidth = obj.strokeWidth * zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyStrokeStyle(ctx, obj.strokeStyle, zoom, obj.strokeWidth);
  ctx.beginPath();

  const x0 = sx + pts[0].x * zoom;
  const y0 = sy + pts[0].y * zoom;
  ctx.moveTo(x0, y0);

  if (pts.length === 1) {
    ctx.arc(x0, y0, (obj.strokeWidth * zoom) / 2, 0, Math.PI * 2);
    ctx.fillStyle = obj.color;
    ctx.fill();
  } else if (pts.length === 2) {
    ctx.lineTo(sx + pts[1].x * zoom, sy + pts[1].y * zoom);
    ctx.stroke();
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const ax = sx + pts[i].x * zoom;
      const ay = sy + pts[i].y * zoom;
      const bx = sx + pts[i + 1].x * zoom;
      const by = sy + pts[i + 1].y * zoom;
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(sx + last.x * zoom, sy + last.y * zoom);
    ctx.stroke();
  }
  ctx.restore();
}

// Helper used by both drawPen and live pen rendering
function tracePenPath(
  ctx: CanvasRenderingContext2D,
  worldPts: Array<{ x: number; y: number }>,
  camera: Camera,
): void {
  if (worldPts.length < 2) return;
  const toSX = (x: number) => (x - camera.x) * camera.zoom;
  const toSY = (y: number) => (y - camera.y) * camera.zoom;
  ctx.moveTo(toSX(worldPts[0].x), toSY(worldPts[0].y));
  if (worldPts.length === 2) {
    ctx.lineTo(toSX(worldPts[1].x), toSY(worldPts[1].y));
  } else {
    for (let i = 1; i < worldPts.length - 1; i++) {
      const ax = toSX(worldPts[i].x), ay = toSY(worldPts[i].y);
      const bx = toSX(worldPts[i + 1].x), by = toSY(worldPts[i + 1].y);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    const last = worldPts[worldPts.length - 1];
    ctx.lineTo(toSX(last.x), toSY(last.y));
  }
}

function drawGroup(
  ctx: CanvasRenderingContext2D,
  group: GroupObject,
  camera: Camera,
  allObjects: Record<string, CanvasObject>,
): void {
  // Children are stored in group-local space — shift camera origin by group position
  const childCamera: Camera = {
    ...camera,
    x: camera.x - group.x,
    y: camera.y - group.y,
    targetX: camera.targetX - group.x,
    targetY: camera.targetY - group.y,
  };

  const children = group.childIds
    .map((id) => allObjects[id])
    .filter((o): o is CanvasObject => !!o && o.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  ctx.save();
  ctx.globalAlpha = group.opacity;
  for (const child of children) {
    drawObject(ctx, child, childCamera, allObjects);
  }
  ctx.restore();
}

// ─── Arrow ─────────────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, obj: ArrowObject, camera: Camera): void {
  const toSX = (wx: number) => (wx - camera.x) * camera.zoom;
  const toSY = (wy: number) => (wy - camera.y) * camera.zoom;

  const sx1 = toSX(obj.x1), sy1 = toSY(obj.y1);
  const sx2 = toSX(obj.x2), sy2 = toSY(obj.y2);

  const lineW = obj.strokeWidth * camera.zoom;
  const headSize = Math.max(14, lineW * 5);

  // Compute control point and end tangents
  let cpx = 0, cpy = 0;
  let startAngle: number, endAngle: number;

  if (obj.curved && obj.bendOffset !== 0) {
    const mx = (obj.x1 + obj.x2) / 2, my = (obj.y1 + obj.y2) / 2;
    const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      cpx = toSX(mx - (dy / len) * obj.bendOffset);
      cpy = toSY(my + (dx / len) * obj.bendOffset);
    } else { cpx = sx1; cpy = sy1; }
    startAngle = Math.atan2(cpy - sy1, cpx - sx1);
    endAngle   = Math.atan2(sy2 - cpy, sx2 - cpx);
  } else {
    startAngle = endAngle = Math.atan2(sy2 - sy1, sx2 - sx1);
  }

  // Shorten endpoints to sit behind arrowheads
  const endOff   = obj.endHead   !== 'none' ? headSize * 0.78 : 0;
  const startOff = obj.startHead !== 'none' ? headSize * 0.78 : 0;
  const lx1 = sx1 + Math.cos(startAngle) * startOff;
  const ly1 = sy1 + Math.sin(startAngle) * startOff;
  const lx2 = sx2 - Math.cos(endAngle)   * endOff;
  const ly2 = sy2 - Math.sin(endAngle)   * endOff;

  ctx.save();
  ctx.strokeStyle = obj.stroke;
  ctx.fillStyle   = obj.stroke;
  ctx.lineWidth   = lineW;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.setLineDash([]);

  ctx.beginPath();
  if (obj.curved && obj.bendOffset !== 0) {
    ctx.moveTo(lx1, ly1);
    ctx.quadraticCurveTo(cpx, cpy, lx2, ly2);
  } else {
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
  }
  ctx.stroke();

  if (obj.endHead   === 'arrow') drawArrowhead(ctx, sx2, sy2, endAngle,                headSize);
  if (obj.endHead   === 'dot')   { ctx.beginPath(); ctx.arc(sx2, sy2, headSize * 0.38, 0, Math.PI * 2); ctx.fill(); }
  if (obj.startHead === 'arrow') drawArrowhead(ctx, sx1, sy1, startAngle + Math.PI,    headSize);
  if (obj.startHead === 'dot')   { ctx.beginPath(); ctx.arc(sx1, sy1, headSize * 0.38, 0, Math.PI * 2); ctx.fill(); }

  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size * 0.5);
  ctx.lineTo(-size, -size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Selection overlay ─────────────────────────────────────────────────────

export interface LivePenStroke {
  worldPoints: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  selectedObjects: CanvasObject[],
  camera: Camera,
  width: number,
  height: number,
  selectionRect: { x: number; y: number; width: number; height: number } | null,
  snapGuides: SnapGuide[],
  livePen?: LivePenStroke | null,
): void {
  ctx.clearRect(0, 0, width, height);

  // Snap guides
  if (snapGuides.length > 0) {
    ctx.strokeStyle = SNAP_GUIDE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const guide of snapGuides) {
      if (guide.type === 'v') {
        const sx = (guide.pos - camera.x) * camera.zoom;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
      } else {
        const sy = (guide.pos - camera.y) * camera.zoom;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
      }
    }
  }

  for (const obj of selectedObjects) {
    if (obj.type === 'arrow') {
      drawArrowSelection(ctx, obj as ArrowObject, camera);
    } else {
      drawSelectionOutline(ctx, obj, camera);
      if (selectedObjects.length === 1) drawResizeHandles(ctx, obj, camera);
    }
  }

  // Multi-selection union box
  if (selectedObjects.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of selectedObjects) {
      minX = Math.min(minX, obj.x); minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width); maxY = Math.max(maxY, obj.y + obj.height);
    }
    const sx = (minX - camera.x) * camera.zoom;
    const sy = (minY - camera.y) * camera.zoom;
    const sw = (maxX - minX) * camera.zoom;
    const sh = (maxY - minY) * camera.zoom;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
    drawResizeHandlesFromBounds(ctx, sx, sy, sw, sh);
  }

  // Rubber-band rect
  if (selectionRect) {
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    ctx.fillStyle = SELECTION_FILL;
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    ctx.setLineDash([]);
  }

  // Live pen stroke (drawn while stylus/cursor is held down)
  if (livePen && livePen.worldPoints.length >= 2) {
    ctx.save();
    ctx.globalAlpha = livePen.opacity;
    ctx.strokeStyle = livePen.color;
    ctx.lineWidth = livePen.strokeWidth * camera.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyStrokeStyle(ctx, livePen.strokeStyle, camera.zoom, livePen.strokeWidth);
    ctx.beginPath();
    tracePenPath(ctx, livePen.worldPoints, camera);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  camera: Camera,
): void {
  const sx = (obj.x - camera.x) * camera.zoom;
  const sy = (obj.y - camera.y) * camera.zoom;
  const sw = obj.width * camera.zoom;
  const sh = obj.height * camera.zoom;

  const locked = obj.locked;
  const borderColor = locked ? '#F59E0B' : SELECTION_COLOR;

  ctx.save();
  if (obj.rotation !== 0) {
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.translate(cx, cy);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(locked ? [5, 3] : []);
  ctx.strokeRect(sx - 0.5, sy - 0.5, sw + 1, sh + 1);
  ctx.setLineDash([]);

  // Lock badge at top-right corner
  if (locked) {
    const bx = sx + sw - 1;
    const by = sy - 1;
    const r = 8;
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    // Mini lock body
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(bx - 3, by - 1, 6, 4.5);
    // Shackle
    ctx.beginPath();
    ctx.arc(bx, by - 1, 2.2, Math.PI, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  camera: Camera,
): void {
  const sx = (obj.x - camera.x) * camera.zoom;
  const sy = (obj.y - camera.y) * camera.zoom;
  const sw = obj.width * camera.zoom;
  const sh = obj.height * camera.zoom;

  ctx.save();
  // Apply the same rotation that the object uses so handles track its orientation
  if (obj.rotation !== 0) {
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    ctx.translate(cx, cy);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  drawResizeHandlesFromBounds(ctx, sx, sy, sw, sh);
  if (obj.type !== 'arrow' && !obj.locked) {
    drawRotationHandle(ctx, sx, sy, sw);
  }
  ctx.restore();
}

function drawRotationHandle(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number,
): void {
  const hx = sx + sw / 2;
  const hy = sy - ROTATION_HANDLE_OFFSET;

  // Dashed stem
  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(hx, sy);
  ctx.lineTo(hx, hy + 6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Handle circle
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Curved-arrow glyph inside the circle
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx, hy, 2.8, (-Math.PI * 3) / 4, Math.PI / 4);
  ctx.stroke();
  // Arrowhead tip
  const tipAngle = Math.PI / 4;
  const tx = hx + 2.8 * Math.cos(tipAngle);
  const ty = hy + 2.8 * Math.sin(tipAngle);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 2.4, ty + 0.6);
  ctx.lineTo(tx + 0.4, ty + 2.4);
  ctx.stroke();

  ctx.restore();
}

function drawResizeHandlesFromBounds(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const cx = sx + sw / 2, cy = sy + sh / 2;
  const handles: Vec2[] = [
    { x: sx, y: sy }, { x: cx, y: sy }, { x: sx + sw, y: sy },
    { x: sx + sw, y: cy },
    { x: sx + sw, y: sy + sh }, { x: cx, y: sy + sh }, { x: sx, y: sy + sh },
    { x: sx, y: cy },
  ];
  const half = HANDLE_SIZE / 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  for (const h of handles) {
    ctx.fillRect(h.x - half, h.y - half, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(h.x - half, h.y - half, HANDLE_SIZE, HANDLE_SIZE);
  }
}

function drawArrowSelection(ctx: CanvasRenderingContext2D, obj: ArrowObject, camera: Camera): void {
  const toSX = (wx: number) => (wx - camera.x) * camera.zoom;
  const toSY = (wy: number) => (wy - camera.y) * camera.zoom;
  const sx1 = toSX(obj.x1), sy1 = toSY(obj.y1);
  const sx2 = toSX(obj.x2), sy2 = toSY(obj.y2);

  // Highlight path
  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = obj.strokeWidth * camera.zoom + 6;
  ctx.globalAlpha = 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (obj.curved && obj.bendOffset !== 0) {
    const mx = (obj.x1 + obj.x2) / 2, my = (obj.y1 + obj.y2) / 2;
    const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const cpx = toSX((obj.x1 + obj.x2) / 2 - (dy / len) * obj.bendOffset);
      const cpy = toSY((obj.y1 + obj.y2) / 2 + (dx / len) * obj.bendOffset);
      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(cpx, cpy, sx2, sy2);
    }
  } else {
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
  }
  ctx.stroke();
  ctx.restore();

  // Endpoint handles (circles)
  const R = HANDLE_SIZE / 2 + 1;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  for (const [px, py] of [[sx1, sy1], [sx2, sy2]]) {
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  void obj; void camera;
}
