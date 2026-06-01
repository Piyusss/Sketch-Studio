import { nanoid } from 'nanoid';
import type { Camera, CanvasObject, ImageObject } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { spatialIndex } from '../engine/spatialIndex';
import { historyManager } from '../history/historyManager';
import { AddObjectCommand } from '../history/commands';

const SOURCE_KEY = 'sketch-canvas-v1';

interface ClipboardPayload {
  source: string;
  objects: CanvasObject[];
}

export async function copyToClipboard(objects: CanvasObject[]): Promise<void> {
  if (objects.length === 0) return;
  const payload: ClipboardPayload = { source: SOURCE_KEY, objects };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
  } catch {
    // Clipboard API unavailable — silently ignore
  }
}

export async function pasteFromClipboard(camera: Camera): Promise<void> {
  try {
    // Try JSON first (same-app paste)
    const text = await navigator.clipboard.readText();
    if (text) {
      try {
        const parsed = JSON.parse(text) as ClipboardPayload;
        if (parsed.source === SOURCE_KEY && Array.isArray(parsed.objects)) {
          pasteObjects(parsed.objects);
          return;
        }
      } catch {
        // Not our JSON format
      }
    }
  } catch {
    // readText failed, try image
  }

  // Try image/png
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('image/png')) {
        const blob = await item.getType('image/png');
        const file = new File([blob], 'pasted-image.png', { type: 'image/png' });
        await createImageObjectFromFile(file, {
          x: camera.x + 100,
          y: camera.y + 100,
        });
        return;
      }
    }
  } catch {
    // No clipboard image access
  }
}

function pasteObjects(originals: CanvasObject[]): void {
  const idMap = new Map<string, string>();
  originals.forEach((o) => idMap.set(o.id, nanoid()));

  const store = useCanvasStore.getState();
  const maxZ = Object.values(store.objects).reduce((m, o) => Math.max(m, o.zIndex), 0);
  const newIds: string[] = [];

  originals.forEach((obj, i) => {
    const newId = idMap.get(obj.id)!;
    const clone: CanvasObject = {
      ...obj,
      id: newId,
      x: obj.x + 20,
      y: obj.y + 20,
      zIndex: maxZ + i + 1,
      parentId: obj.parentId ? idMap.get(obj.parentId) ?? null : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as CanvasObject;
    historyManager.execute(new AddObjectCommand(clone));
    newIds.push(newId);
  });

  store.setSelectedIds(newIds);
}

/**
 * Read a File as a base64 data URL.
 *
 * We deliberately avoid URL.createObjectURL() here because blob: URLs are
 * session-local — they only exist in the browser tab that created them and
 * cannot be accessed by any other user or device.  A data URL embeds the
 * entire image as a base64 string so it round-trips through NeonDB and
 * renders correctly for every viewer, including shared / view-only links.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = reject;
    reader.readAsDataURL(file);
  });
}

export async function createImageObjectFromFile(
  file: File,
  position: { x: number; y: number },
): Promise<void> {
  // Convert to a portable data URL so the image survives across devices,
  // shared links, and page refreshes (blob: URLs are ephemeral + local-only).
  const dataUrl = await fileToDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 600;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const store = useCanvasStore.getState();
      const maxZ = Object.values(store.objects).reduce((m, o) => Math.max(m, o.zIndex), 0);
      const now = Date.now();

      const obj: ImageObject = {
        id: nanoid(), type: 'image',
        x: position.x - w / 2, y: position.y - h / 2,
        width: w, height: h,
        rotation: 0, opacity: 1,
        locked: false, visible: true,
        layerId: 'default', parentId: null,
        zIndex: maxZ + 1,
        createdAt: now, updatedAt: now,
        src: dataUrl,               // ← portable data URL, not a blob: URL
        originalWidth: img.naturalWidth,
        originalHeight: img.naturalHeight,
        cropX: 0, cropY: 0,
        cropWidth: img.naturalWidth, cropHeight: img.naturalHeight,
        objectFit: 'fill',
      };

      historyManager.execute(new AddObjectCommand(obj));
      store.setSelectedIds([obj.id]);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}
