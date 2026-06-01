import type { CanvasObject } from '../types';

/**
 * Return a copy of the objects map with every ImageObject whose src is a
 * session-local blob: URL replaced by an empty string.
 *
 * Blob URLs (created by URL.createObjectURL) only exist in the browser session
 * that created them.  Storing them in the database would make images invisible
 * for every other viewer.  New images use portable data: URLs (see clipboard.ts);
 * this guard is a safety net for any legacy objects still in a live session.
 */
export function stripBlobUrls(
  objects: Record<string, CanvasObject>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, obj] of Object.entries(objects)) {
    const o = obj as { type?: string; src?: string };
    if (o.type === 'image' && typeof o.src === 'string' && o.src.startsWith('blob:')) {
      result[id] = { ...obj, src: '' };
    } else {
      result[id] = obj;
    }
  }
  return result;
}
