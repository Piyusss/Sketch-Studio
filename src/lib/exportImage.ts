// Export the current canvas to a PNG at its native (zoom-independent) resolution.
import type { Camera, CanvasObject, ImageObject, GroupObject } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { renderForExport } from '../engine/renderer';
import { computeUnionAABB } from '../utils/math';
import { getImage } from '../engine/imageCache';

export interface ExportResult { ok: boolean; reason?: 'empty' | 'no-context' | 'blob-failed' | 'tainted'; }

export interface ExportOptions {
  filename?: string;   // without extension; ".png" is appended if missing
  scale?: number;      // pixel density multiplier (geometry stays 1:1). Default 2 for crisp output.
  padding?: number;    // world-unit margin around content. Default 40.
  background?: boolean; // fill the canvas background colour. Default true.
}

// Collect every image source referenced by the objects (including group children).
function collectImageSrcs(objs: CanvasObject[], all: Record<string, CanvasObject>): string[] {
  const srcs = new Set<string>();
  const visit = (o: CanvasObject) => {
    if (o.type === 'image') {
      const src = (o as ImageObject).src;
      if (src) srcs.add(src);
    } else if (o.type === 'group') {
      (o as GroupObject).childIds.forEach((cid) => {
        const c = all[cid];
        if (c) visit(c);
      });
    }
  };
  objs.forEach(visit);
  return [...srcs];
}

// Ensure all images are decoded before we rasterise, so they don't export blank.
async function ensureImagesLoaded(srcs: string[], timeoutMs = 4000): Promise<void> {
  if (srcs.length === 0) return;
  await Promise.race([
    Promise.all(
      srcs.map(
        (src) =>
          new Promise<void>((resolve) => {
            const cached = getImage(src, () => resolve());
            if (cached) resolve();
          }),
      ),
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function exportCanvasToPng(options: ExportOptions = {}): Promise<ExportResult> {
  const { filename = 'sketch', scale = 2, padding = 40, background = true } = options;

  const store = useCanvasStore.getState();
  const all = store.objects;

  // Top-level, visible objects (group children are painted via their group)
  const top = Object.values(all)
    .filter((o) => o.visible && !o.parentId)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (top.length === 0) return { ok: false, reason: 'empty' };

  await ensureImagesLoaded(collectImageSrcs(Object.values(all), all));

  const bbox = computeUnionAABB(top);
  const W = Math.max(1, Math.ceil((bbox.width + padding * 2) * scale));
  const H = Math.max(1, Math.ceil((bbox.height + padding * 2) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, reason: 'no-context' };

  // Camera maps world → pixels: zoom = scale, origin offset by padding.
  const cam: Camera = {
    x: bbox.x - padding,
    y: bbox.y - padding,
    zoom: scale,
    targetX: bbox.x - padding,
    targetY: bbox.y - padding,
    targetZoom: scale,
  };

  renderForExport(ctx, top, all, cam, W, H, background ? store.canvasBg : undefined);

  return new Promise<ExportResult>((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve({ ok: false, reason: 'blob-failed' });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve({ ok: true });
      }, 'image/png');
    } catch {
      // Canvas tainted by a cross-origin image without CORS headers
      resolve({ ok: false, reason: 'tainted' });
    }
  });
}
