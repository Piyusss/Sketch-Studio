export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// Default "ink" colors for freshly-created elements (text, shape strokes, pen
// strokes) — dark ink on light/white canvases, light ink on black/grayish ones,
// so new elements are legible against the background the moment they're drawn.
export const LIGHT_BG_INK = '#1F2937';
export const DARK_BG_INK = '#F3F4F6';

export function defaultInkColor(bgHex: string): string {
  return isLightColor(bgHex) ? LIGHT_BG_INK : DARK_BG_INK;
}
