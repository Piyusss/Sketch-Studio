import type { TextObject } from '../types';

let _ctx: CanvasRenderingContext2D | null = null;

/**
 * Measures a text object's natural world-space size using the exact same
 * `ctx.font` string and per-line layout that `drawText` uses to render it —
 * so the stored bbox (and therefore the selection outline) never drifts out
 * of sync with the glyphs actually drawn on the canvas.
 */
export function measureTextBox(
  t: Pick<TextObject, 'content' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight'>,
): { width: number; height: number } {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  const lines = t.content.split('\n');
  const lh = (t.lineHeight ?? 1.25) * t.fontSize;
  let width = 1;
  if (_ctx) {
    _ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
    for (const line of lines) width = Math.max(width, _ctx.measureText(line).width);
  }
  return { width: Math.max(1, width), height: Math.max(1, lines.length * lh) };
}
