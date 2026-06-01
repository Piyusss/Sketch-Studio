import type { Camera, Vec2, AABB, CanvasObject } from '../types';

export function screenToWorld(p: Vec2, camera: Camera): Vec2 {
  return {
    x: camera.x + p.x / camera.zoom,
    y: camera.y + p.y / camera.zoom,
  };
}

export function worldToScreen(p: Vec2, camera: Camera): Vec2 {
  return {
    x: (p.x - camera.x) * camera.zoom,
    y: (p.y - camera.y) * camera.zoom,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function rotatePoint(p: Vec2, around: Vec2, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return {
    x: around.x + dx * cos - dy * sin,
    y: around.y + dx * sin + dy * cos,
  };
}

export function getCameraAABB(camera: Camera, width: number, height: number): AABB {
  return {
    minX: camera.x,
    minY: camera.y,
    maxX: camera.x + width / camera.zoom,
    maxY: camera.y + height / camera.zoom,
  };
}

export function getObjectAABB(obj: CanvasObject): AABB {
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + obj.width,
    maxY: obj.y + obj.height,
  };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function computeArrowBBox(
  x1: number, y1: number, x2: number, y2: number,
  curved: boolean, bendOffset: number,
): { x: number; y: number; width: number; height: number } {
  const PAD = 16;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (!curved || bendOffset === 0 || len === 0) {
    return {
      x: Math.min(x1, x2) - PAD,
      y: Math.min(y1, y2) - PAD,
      width: Math.abs(dx) + 2 * PAD,
      height: Math.abs(dy) + 2 * PAD,
    };
  }

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx - (dy / len) * bendOffset;
  const cy = my + (dx / len) * bendOffset;
  return {
    x: Math.min(x1, x2, cx) - PAD,
    y: Math.min(y1, y2, cy) - PAD,
    width: Math.max(x1, x2, cx) - Math.min(x1, x2, cx) + 2 * PAD,
    height: Math.max(y1, y2, cy) - Math.min(y1, y2, cy) + 2 * PAD,
  };
}

export function computeUnionAABB(objects: CanvasObject[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of objects) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
