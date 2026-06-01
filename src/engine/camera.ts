import type { Camera } from '../types';
import { clamp } from '../utils/math';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8.0;
const LERP_K = 12;

export function tickCamera(camera: Camera, dt: number): boolean {
  const factor = 1 - Math.exp(-LERP_K * dt);

  const prevX = camera.x;
  const prevY = camera.y;
  const prevZoom = camera.zoom;

  camera.x += (camera.targetX - camera.x) * factor;
  camera.y += (camera.targetY - camera.y) * factor;
  camera.zoom += (camera.targetZoom - camera.zoom) * factor;

  if (Math.abs(camera.x - camera.targetX) < 0.01) camera.x = camera.targetX;
  if (Math.abs(camera.y - camera.targetY) < 0.01) camera.y = camera.targetY;
  if (Math.abs(camera.zoom - camera.targetZoom) < 0.0001) camera.zoom = camera.targetZoom;

  return camera.x !== prevX || camera.y !== prevY || camera.zoom !== prevZoom;
}

export function zoomTowardPoint(
  camera: Camera,
  cursorX: number,
  cursorY: number,
  delta: number,
): void {
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  const newZoom = clamp(camera.targetZoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

  const worldX = camera.targetX + cursorX / camera.targetZoom;
  const worldY = camera.targetY + cursorY / camera.targetZoom;

  camera.targetZoom = newZoom;
  camera.targetX = worldX - cursorX / newZoom;
  camera.targetY = worldY - cursorY / newZoom;
}

export function getZoomPercent(camera: Camera): number {
  return Math.round(camera.zoom * 100);
}
