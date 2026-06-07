// Vector SVG export. Serialises every object to SVG markup at world
// coordinates, with a viewBox tight to the content bounds. Unlike the PNG
// export this stays infinitely scalable — ideal for docs, slides and print.
import type {
  CanvasObject, RectObject, EllipseObject, DiamondObject, TextObject,
  PenObject, ArrowObject, ImageObject, GroupObject, FrameObject, StrokeStyle,
} from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { computeUnionAABB } from '../utils/math';
import { getImage } from '../engine/imageCache';

export interface SvgExportResult { ok: boolean; reason?: 'empty'; svg?: string; }

interface BuildOptions { padding?: number; background?: boolean; }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dashArray(style: StrokeStyle | undefined, width: number): string {
  if (style === 'dashed') return `stroke-dasharray="${Math.max(6, width * 3)} ${Math.max(3, width * 1.5)}"`;
  if (style === 'dotted') return `stroke-dasharray="${width} ${width + 3}" stroke-linecap="round"`;
  return '';
}

function rotAttr(o: CanvasObject): string {
  if (!o.rotation) return '';
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  return ` transform="rotate(${o.rotation} ${cx} ${cy})"`;
}

function opacityAttr(o: CanvasObject): string {
  return o.opacity < 1 ? ` opacity="${o.opacity}"` : '';
}

function strokeAttrs(stroke: string, width: number, style?: StrokeStyle): string {
  if (!stroke || stroke === 'none' || width <= 0) return 'stroke="none"';
  return `stroke="${esc(stroke)}" stroke-width="${width}" ${dashArray(style, width)}`;
}

function rectSvg(o: RectObject): string {
  const fill = o.fill && o.fill !== 'none' ? esc(o.fill) : 'none';
  const rx = o.cornerRadius ? ` rx="${o.cornerRadius}"` : '';
  return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"${rx} fill="${fill}" ${strokeAttrs(o.stroke, o.strokeWidth)}${rotAttr(o)}${opacityAttr(o)} />`;
}

function ellipseSvg(o: EllipseObject): string {
  const fill = o.fill && o.fill !== 'none' ? esc(o.fill) : 'none';
  return `<ellipse cx="${o.x + o.width / 2}" cy="${o.y + o.height / 2}" rx="${o.width / 2}" ry="${o.height / 2}" fill="${fill}" ${strokeAttrs(o.stroke, o.strokeWidth)}${rotAttr(o)}${opacityAttr(o)} />`;
}

function diamondSvg(o: DiamondObject): string {
  const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
  const pts = `${cx},${o.y} ${o.x + o.width},${cy} ${cx},${o.y + o.height} ${o.x},${cy}`;
  const fill = o.fill && o.fill !== 'none' ? esc(o.fill) : 'none';
  return `<polygon points="${pts}" fill="${fill}" ${strokeAttrs(o.stroke, o.strokeWidth)}${rotAttr(o)}${opacityAttr(o)} />`;
}

function textSvg(o: TextObject): string {
  if (!o.content) return '';
  const anchor = o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start';
  const tx = o.align === 'center' ? o.x + o.width / 2 : o.align === 'right' ? o.x + o.width : o.x;
  const lh = (o.lineHeight ?? 1.25) * o.fontSize;
  const lines = o.content.split('\n');
  const tspans = lines.map((ln, i) =>
    `<tspan x="${tx}" dy="${i === 0 ? 0 : lh}">${esc(ln) || ' '}</tspan>`,
  ).join('');
  return `<text x="${tx}" y="${o.y}" font-family="${esc(o.fontFamily)}" font-size="${o.fontSize}" font-weight="${o.fontWeight}" fill="${esc(o.color)}" text-anchor="${anchor}" dominant-baseline="hanging"${rotAttr(o)}${opacityAttr(o)}>${tspans}</text>`;
}

function penSvg(o: PenObject): string {
  const pts = o.points;
  if (pts.length < 1) return '';
  const ax = (i: number) => o.x + pts[i].x;
  const ay = (i: number) => o.y + pts[i].y;
  let d = `M ${ax(0)} ${ay(0)}`;
  if (pts.length === 2) {
    d += ` L ${ax(1)} ${ay(1)}`;
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (ax(i) + ax(i + 1)) / 2, my = (ay(i) + ay(i + 1)) / 2;
      d += ` Q ${ax(i)} ${ay(i)} ${mx} ${my}`;
    }
    d += ` L ${ax(pts.length - 1)} ${ay(pts.length - 1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${esc(o.color)}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${dashArray(o.strokeStyle, o.strokeWidth)}${opacityAttr(o)} />`;
}

function arrowHeadPolygon(tipX: number, tipY: number, angle: number, size: number, color: string): string {
  // Same glyph as the canvas renderer: (0,0)(-size,size*0.36)(-size*0.6,0)(-size,-size*0.36)
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const local = [[0, 0], [-size, size * 0.36], [-size * 0.6, 0], [-size, -size * 0.36]];
  const pts = local.map(([lx, ly]) => `${tipX + lx * cos - ly * sin},${tipY + lx * sin + ly * cos}`).join(' ');
  return `<polygon points="${pts}" fill="${esc(color)}" />`;
}

function arrowSvg(o: ArrowObject): string {
  const headSize = Math.max(13, o.strokeWidth * 5);
  let cpx = 0, cpy = 0, startAngle: number, endAngle: number;
  if (o.curved && o.bendOffset !== 0) {
    const mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2;
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
    const len = Math.hypot(dx, dy) || 1;
    cpx = mx - (dy / len) * o.bendOffset;
    cpy = my + (dx / len) * o.bendOffset;
    startAngle = Math.atan2(cpy - o.y1, cpx - o.x1);
    endAngle = Math.atan2(o.y2 - cpy, o.x2 - cpx);
  } else {
    startAngle = endAngle = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
  }
  const endOff = o.endHead !== 'none' ? headSize * 0.78 : 0;
  const startOff = o.startHead !== 'none' ? headSize * 0.78 : 0;
  const lx1 = o.x1 + Math.cos(startAngle) * startOff;
  const ly1 = o.y1 + Math.sin(startAngle) * startOff;
  const lx2 = o.x2 - Math.cos(endAngle) * endOff;
  const ly2 = o.y2 - Math.sin(endAngle) * endOff;

  const path = o.curved && o.bendOffset !== 0
    ? `M ${lx1} ${ly1} Q ${cpx} ${cpy} ${lx2} ${ly2}`
    : `M ${lx1} ${ly1} L ${lx2} ${ly2}`;

  const parts = [
    `<path d="${path}" fill="none" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`,
  ];
  if (o.endHead === 'arrow') parts.push(arrowHeadPolygon(o.x2, o.y2, endAngle, headSize, o.stroke));
  if (o.endHead === 'dot') parts.push(`<circle cx="${o.x2}" cy="${o.y2}" r="${headSize * 0.38}" fill="${esc(o.stroke)}" />`);
  if (o.startHead === 'arrow') parts.push(arrowHeadPolygon(o.x1, o.y1, startAngle + Math.PI, headSize, o.stroke));
  if (o.startHead === 'dot') parts.push(`<circle cx="${o.x1}" cy="${o.y1}" r="${headSize * 0.38}" fill="${esc(o.stroke)}" />`);

  return `<g${opacityAttr(o)}>${parts.join('')}</g>`;
}

function imageSvg(o: ImageObject): string {
  const img = getImage(o.src, () => {});
  if (!img) return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#E5E7EB" stroke="#9CA3AF" />`;
  try {
    // Bake the crop region into a data URL so the SVG is self-contained.
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(o.cropWidth));
    c.height = Math.max(1, Math.round(o.cropHeight));
    const cx = c.getContext('2d');
    if (!cx) throw new Error('no ctx');
    cx.drawImage(img, o.cropX, o.cropY, o.cropWidth, o.cropHeight, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    return `<image href="${url}" x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" preserveAspectRatio="none"${rotAttr(o)}${opacityAttr(o)} />`;
  } catch {
    return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#E5E7EB" />`;
  }
}

function groupSvg(o: GroupObject, all: Record<string, CanvasObject>): string {
  const children = o.childIds
    .map((id) => all[id])
    .filter((c): c is CanvasObject => !!c && c.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((c) => objectSvg(c, all))
    .join('');
  const rot = o.rotation ? ` rotate(${o.rotation} ${o.x + o.width / 2} ${o.y + o.height / 2})` : '';
  return `<g transform="translate(${o.x} ${o.y})${rot}"${opacityAttr(o)}>${children}</g>`;
}

function frameSvg(o: FrameObject): string {
  const stroke = o.stroke && o.stroke !== 'none' ? o.stroke : '#9CA3AF';
  const fill = o.fill && o.fill !== 'none' ? esc(o.fill) : 'none';
  const title = `<text x="${o.x + 1}" y="${o.y - 5}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="${esc(stroke)}">${esc(o.name || 'Frame')}</text>`;
  const rect = `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="${fill}" stroke="${esc(stroke)}" stroke-width="${o.strokeWidth || 1}" />`;
  return `<g${opacityAttr(o)}>${rect}${title}</g>`;
}

function objectSvg(o: CanvasObject, all: Record<string, CanvasObject>): string {
  switch (o.type) {
    case 'rect': return rectSvg(o as RectObject);
    case 'ellipse': return ellipseSvg(o as EllipseObject);
    case 'diamond': return diamondSvg(o as DiamondObject);
    case 'text': return textSvg(o as TextObject);
    case 'pen': return penSvg(o as PenObject);
    case 'arrow': return arrowSvg(o as ArrowObject);
    case 'image': return imageSvg(o as ImageObject);
    case 'group': return groupSvg(o as GroupObject, all);
    case 'frame': return frameSvg(o as FrameObject);
    default: return '';
  }
}

/** Build the SVG document string for the current canvas. */
export function buildSvg(opts: BuildOptions = {}): SvgExportResult {
  const { padding = 40, background = true } = opts;
  const store = useCanvasStore.getState();
  const all = store.objects;
  const top = Object.values(all)
    .filter((o) => o.visible && !o.parentId)
    .sort((a, b) => a.zIndex - b.zIndex);
  if (top.length === 0) return { ok: false, reason: 'empty' };

  const bbox = computeUnionAABB(top);
  const x = bbox.x - padding, y = bbox.y - padding;
  const w = bbox.width + padding * 2, h = bbox.height + padding * 2;

  const body = top.map((o) => objectSvg(o, all)).join('\n  ');
  const bg = background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(store.canvasBg)}" />\n  ` : '';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" ` +
    `viewBox="${x} ${y} ${w} ${h}">\n  ${bg}${body}\n</svg>`;
  return { ok: true, svg };
}

export async function exportCanvasToSvg(filename = 'sketch', opts: BuildOptions = {}): Promise<SvgExportResult> {
  const res = buildSvg(opts);
  if (!res.ok || !res.svg) return res;
  const blob = new Blob([res.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return res;
}
