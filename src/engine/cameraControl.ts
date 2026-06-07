// Shared handle to the live camera that Canvas owns in a useRef. Sibling UI
// (ZoomControls, Minimap) reads/mutates the same object so zoom/pan stay in
// sync without routing the camera through React state (which would stall the
// RAF render loop). Mutating targetX/Y/Zoom is enough — the RAF tick lerps
// toward the target and flags a redraw automatically.
import type { Camera, CanvasObject } from '../types';
import { clamp } from '../utils/math';
import { MIN_ZOOM, MAX_ZOOM } from './camera';
import { computeUnionAABB } from '../utils/math';

export const cameraHandle: { current: Camera | null } = { current: null };

function viewportSize(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
}

/** Multiply zoom by `factor`, keeping the viewport centre fixed in world space. */
export function zoomBy(factor: number): void {
  const cam = cameraHandle.current;
  if (!cam) return;
  const { w, h } = viewportSize();
  zoomTowardScreenPoint(cam, w / 2, h / 2, factor);
}

/** Set absolute zoom level, keeping the viewport centre fixed. */
export function setZoomLevel(z: number): void {
  const cam = cameraHandle.current;
  if (!cam) return;
  const { w, h } = viewportSize();
  const factor = clamp(z, MIN_ZOOM, MAX_ZOOM) / cam.targetZoom;
  zoomTowardScreenPoint(cam, w / 2, h / 2, factor);
}

function zoomTowardScreenPoint(cam: Camera, sx: number, sy: number, factor: number): void {
  const newZoom = clamp(cam.targetZoom * factor, MIN_ZOOM, MAX_ZOOM);
  const worldX = cam.targetX + sx / cam.targetZoom;
  const worldY = cam.targetY + sy / cam.targetZoom;
  cam.targetZoom = newZoom;
  cam.targetX = worldX - sx / newZoom;
  cam.targetY = worldY - sy / newZoom;
}

/** Reset to 100% and the default origin. */
export function resetZoom(): void {
  const cam = cameraHandle.current;
  if (!cam) return;
  cam.targetZoom = 1;
}

/** Centre the camera on a world point (used by minimap navigation). */
export function centerOnWorld(wx: number, wy: number): void {
  const cam = cameraHandle.current;
  if (!cam) return;
  const { w, h } = viewportSize();
  cam.targetX = wx - w / 2 / cam.targetZoom;
  cam.targetY = wy - h / 2 / cam.targetZoom;
}

/** Zoom + pan so all objects fit within the viewport with padding. */
export function zoomToFit(objects: CanvasObject[], padding = 80): void {
  const cam = cameraHandle.current;
  if (!cam) return;
  const top = objects.filter((o) => !o.parentId);
  if (top.length === 0) return;
  const bbox = computeUnionAABB(top);
  if (bbox.width <= 0 || bbox.height <= 0) return;
  const { w, h } = viewportSize();
  const zoom = clamp(
    Math.min((w - padding * 2) / bbox.width, (h - padding * 2) / bbox.height),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  cam.targetZoom = zoom;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  cam.targetX = cx - w / 2 / zoom;
  cam.targetY = cy - h / 2 / zoom;
}
