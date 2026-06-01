import type { CanvasObject, SnapGuide } from '../types';

const SNAP_SCREEN_PX = 8;
const GRID_WORLD_SIZE = 40;

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

interface SnapPoints {
  x: number[];
  y: number[];
}

function getSnapPoints(obj: CanvasObject): SnapPoints {
  return {
    x: [obj.x, obj.x + obj.width / 2, obj.x + obj.width],
    y: [obj.y, obj.y + obj.height / 2, obj.y + obj.height],
  };
}

export function computeSnap(
  dragging: CanvasObject[],
  candidates: CanvasObject[],
  zoom: number,
  gridSnap: boolean,
  objectSnap: boolean,
): SnapResult {
  if (dragging.length === 0) return { dx: 0, dy: 0, guides: [] };

  const threshold = SNAP_SCREEN_PX / zoom;

  const minX = Math.min(...dragging.map((o) => o.x));
  const minY = Math.min(...dragging.map((o) => o.y));
  const maxX = Math.max(...dragging.map((o) => o.x + o.width));
  const maxY = Math.max(...dragging.map((o) => o.y + o.height));
  const ctrX = (minX + maxX) / 2;
  const ctrY = (minY + maxY) / 2;

  const dragX = [minX, ctrX, maxX];
  const dragY = [minY, ctrY, maxY];

  let bestDx = Infinity;
  let bestDy = Infinity;

  // Grid snap
  if (gridSnap) {
    for (const x of dragX) {
      const snapped = Math.round(x / GRID_WORLD_SIZE) * GRID_WORLD_SIZE;
      const d = snapped - x;
      if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestDx)) bestDx = d;
    }
    for (const y of dragY) {
      const snapped = Math.round(y / GRID_WORLD_SIZE) * GRID_WORLD_SIZE;
      const d = snapped - y;
      if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestDy)) bestDy = d;
    }
  }

  // Object snap
  if (objectSnap) {
    for (const candidate of candidates) {
      const { x: cx, y: cy } = getSnapPoints(candidate);

      for (const snap of cx) {
        for (const drag of dragX) {
          const d = snap - drag;
          if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestDx)) bestDx = d;
        }
      }
      for (const snap of cy) {
        for (const drag of dragY) {
          const d = snap - drag;
          if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestDy)) bestDy = d;
        }
      }
    }
  }

  const dx = isFinite(bestDx) ? bestDx : 0;
  const dy = isFinite(bestDy) ? bestDy : 0;
  const guides: SnapGuide[] = [];

  if (objectSnap && (dx !== 0 || dy !== 0)) {
    const snappedX = dragX.map((x) => x + dx);
    const snappedY = dragY.map((y) => y + dy);

    for (const candidate of candidates) {
      const { x: cx, y: cy } = getSnapPoints(candidate);
      for (const snap of cx) {
        if (snappedX.some((x) => Math.abs(x - snap) < 0.5)) {
          guides.push({ type: 'v', pos: snap });
        }
      }
      for (const snap of cy) {
        if (snappedY.some((y) => Math.abs(y - snap) < 0.5)) {
          guides.push({ type: 'h', pos: snap });
        }
      }
    }
  }

  return { dx, dy, guides };
}
