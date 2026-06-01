// Mermaid flowchart → native canvas objects.
// Supports `flowchart`/`graph` with directions TB/TD/BT/LR/RL, the common node
// shapes (rect, rounded, stadium, subroutine, cylinder, circle, diamond/hexagon)
// and edge types (-->  ---  -.->  ==>) with `|label|` or `-- label -->` labels.

import { nanoid } from 'nanoid';
import type {
  CanvasObject, RectObject, EllipseObject, DiamondObject, TextObject, ArrowObject,
} from '../types';
import { computeArrowBBox } from '../utils/math';

export const DEFAULT_MERMAID = `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[Car]`;

// ── Types ──────────────────────────────────────────────────────────────────────

type ShapeKind =
  | 'rect' | 'rounded' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'diamond';

type Direction = 'TB' | 'BT' | 'LR' | 'RL';

interface MNode { id: string; label: string; shape: ShapeKind; }
interface MEdge { from: string; to: string; label?: string; arrow: boolean; }
interface ParsedGraph { direction: Direction; nodes: Map<string, MNode>; edges: MEdge[]; }

interface DiagramColors { stroke: string; fill: string; text: string; }
interface BuildOpts {
  offsetX?: number;
  offsetY?: number;
  baseZIndex?: number;
  colors?: DiagramColors;
  canvasBg?: string;   // used as label-chip background so labels never bleed into arrows
}
interface BuildResult {
  objects: CanvasObject[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  error: string | null;
}

// ── Text measurement ─────────────────────────────────────────────────────────

let _measureCtx: CanvasRenderingContext2D | null = null;
const NODE_FONT = '500 15px Inter, system-ui, sans-serif';
const LABEL_FONT = '400 13px Inter, system-ui, sans-serif';

function measureText(text: string, font: string): number {
  if (!_measureCtx) {
    const c = document.createElement('canvas');
    _measureCtx = c.getContext('2d');
  }
  if (!_measureCtx) return (text?.length ?? 0) * 8;
  _measureCtx.font = font;
  return _measureCtx.measureText(text ?? '').width;
}

// ── Parsing ────────────────────────────────────────────────────────────────────

const SKIP_RE = /^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/i;

function stripQuotes(s: string): string {
  let t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  return t.replace(/<br\s*\/?>/gi, ' ').trim();
}

function parseNodeToken(tok: string): { id: string; shape: ShapeKind | null; label: string | null } | null {
  const m = /^([A-Za-z0-9_]+)/.exec(tok.trim());
  if (!m) return null;
  const id = m[1];
  const rest = tok.trim().slice(id.length).trim();
  if (!rest) return { id, shape: null, label: null };

  const pairs: [string, string, ShapeKind][] = [
    ['((', '))', 'circle'],
    ['([', '])', 'stadium'],
    ['[[', ']]', 'subroutine'],
    ['[(', ')]', 'cylinder'],
    ['{{', '}}', 'diamond'],
    ['[', ']', 'rect'],
    ['(', ')', 'rounded'],
    ['{', '}', 'diamond'],
  ];
  for (const [open, close, shape] of pairs) {
    if (rest.length >= open.length + close.length && rest.startsWith(open) && rest.endsWith(close)) {
      return { id, shape, label: stripQuotes(rest.slice(open.length, rest.length - close.length)) };
    }
  }
  return { id, shape: null, label: null };
}

// Connector patterns, tested in order. All anchored at start of the slice.
const CONNECTORS: { re: RegExp; arrow: boolean; labelIdx?: number }[] = [
  { re: /^(-\.->|-{2,}>|={2,}>)\s*\|([^|]*)\|/, arrow: true,  labelIdx: 2 }, // arrow + |label|
  { re: /^(-\.-|-{2,}|={2,})\s*\|([^|]*)\|/,    arrow: false, labelIdx: 2 }, // line + |label|
  { re: /^-{2,}\s*([^|>][^>]*?)\s*-{2,}>/,       arrow: true,  labelIdx: 1 }, // -- label -->
  { re: /^={2,}\s*([^|>][^>]*?)\s*={2,}>/,       arrow: true,  labelIdx: 1 }, // == label ==>
  { re: /^-\.\s*([^|>][^>]*?)\s*\.->/,           arrow: true,  labelIdx: 1 }, // -. label .->
  { re: /^(-\.->|-{2,}>|={2,}>)/,                arrow: true },               // plain arrow
  { re: /^(-\.-|-{2,}|={2,})/,                   arrow: false },              // plain line
];

function matchConnector(sub: string): { len: number; arrow: boolean; label?: string } | null {
  for (const c of CONNECTORS) {
    const m = c.re.exec(sub);
    if (m) {
      const label = c.labelIdx ? (m[c.labelIdx] ?? '').trim() : undefined;
      return { len: m[0].length, arrow: c.arrow, label: label || undefined };
    }
  }
  return null;
}

function registerNode(nodes: Map<string, MNode>, p: { id: string; shape: ShapeKind | null; label: string | null }): void {
  const existing = nodes.get(p.id);
  if (!existing) {
    nodes.set(p.id, { id: p.id, shape: p.shape ?? 'rect', label: p.label ?? p.id });
  } else {
    if (p.shape) existing.shape = p.shape;
    if (p.label != null) existing.label = p.label;
  }
}

function parseStatement(stmt: string, nodes: Map<string, MNode>, edges: MEdge[]): void {
  const s = stmt.trim();
  if (!s || SKIP_RE.test(s)) return;

  // Tokenize into alternating node / connector tokens, respecting bracket + quote nesting
  type Tok = { type: 'node'; str: string } | { type: 'conn'; arrow: boolean; label?: string };
  const tokens: Tok[] = [];
  let depth = 0, inQuote = false, nodeStart = 0, i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (inQuote) { if (ch === '"') inQuote = false; i++; continue; }
    if (ch === '"') { inQuote = true; i++; continue; }
    if (ch === '[' || ch === '(' || ch === '{') { depth++; i++; continue; }
    if (ch === ']' || ch === ')' || ch === '}') { depth = Math.max(0, depth - 1); i++; continue; }
    if (depth === 0) {
      const conn = matchConnector(s.slice(i));
      if (conn) {
        tokens.push({ type: 'node', str: s.slice(nodeStart, i) });
        tokens.push({ type: 'conn', arrow: conn.arrow, label: conn.label });
        i += conn.len;
        nodeStart = i;
        continue;
      }
    }
    i++;
  }
  tokens.push({ type: 'node', str: s.slice(nodeStart) });

  // Build nodes + edges (tokens alternate node, conn, node, conn, …)
  let lastId: string | null = null;
  let pending: { arrow: boolean; label?: string } | null = null;
  for (const t of tokens) {
    if (t.type === 'node') {
      const p = parseNodeToken(t.str);
      if (!p) { pending = null; continue; }
      registerNode(nodes, p);
      if (pending && lastId) {
        edges.push({ from: lastId, to: p.id, arrow: pending.arrow, label: pending.label });
      }
      lastId = p.id;
      pending = null;
    } else {
      pending = { arrow: t.arrow, label: t.label };
    }
  }
}

export function parseMermaid(code: string): ParsedGraph {
  const nodes = new Map<string, MNode>();
  const edges: MEdge[] = [];
  let direction: Direction = 'TB';
  let headerConsumed = false;

  const lines = code.replace(/\r\n/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;

    if (!headerConsumed) {
      const hm = /^(?:flowchart|graph)\b\s*(TB|TD|BT|LR|RL)?/i.exec(line);
      if (hm) {
        headerConsumed = true;
        const d = (hm[1] || 'TB').toUpperCase();
        direction = (d === 'TD' ? 'TB' : d) as Direction;
        continue;
      }
    }
    headerConsumed = true;

    for (const st of line.split(';')) {
      if (st.trim()) parseStatement(st, nodes, edges);
    }
  }

  return { direction, nodes, edges };
}

// ── Layout (layered / Sugiyama-style) ───────────────────────────────────────────

interface Placed { cx: number; cy: number; w: number; h: number; }

function nodeSize(shape: ShapeKind, label: string): { w: number; h: number } {
  const tw = measureText(label, NODE_FONT);
  switch (shape) {
    case 'diamond': return { w: Math.max(96, tw + 70), h: 74 };
    case 'circle':  { const d = Math.max(72, tw + 36); return { w: d, h: d }; }
    case 'stadium': return { w: Math.max(80, tw + 44), h: 46 };
    default:        return { w: Math.max(72, tw + 40), h: 46 };
  }
}

function layeredLayout(g: ParsedGraph): Map<string, Placed> {
  const ids = [...g.nodes.keys()];
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  ids.forEach((id) => { children.set(id, []); parents.set(id, []); indeg.set(id, 0); });

  for (const e of g.edges) {
    if (!g.nodes.has(e.from) || !g.nodes.has(e.to) || e.from === e.to) continue;
    children.get(e.from)!.push(e.to);
    parents.get(e.to)!.push(e.from);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }

  // Kahn topological order (cycle leftovers appended)
  const order: string[] = [];
  const indc = new Map(indeg);
  const queue = ids.filter((id) => indc.get(id) === 0);
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const c of children.get(u)!) {
      indc.set(c, indc.get(c)! - 1);
      if (indc.get(c) === 0) queue.push(c);
    }
  }
  for (const id of ids) if (!order.includes(id)) order.push(id);

  // Longest-path rank
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const u of order) {
    for (const c of children.get(u)!) {
      rank.set(c, Math.max(rank.get(c)!, rank.get(u)! + 1));
    }
  }

  const maxRank = Math.max(0, ...ids.map((id) => rank.get(id)!));
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of ids) layers[rank.get(id)!].push(id);

  const size = new Map<string, { w: number; h: number }>();
  for (const id of ids) { const n = g.nodes.get(id)!; size.set(id, nodeSize(n.shape, n.label)); }

  // Give extra room between layers when any edge carries a label
  const hasLabels = g.edges.some((e) => !!e.label);
  const VGAP = hasLabels ? 84 : 64;
  const HGAP = hasLabels ? 56 : 44;
  const rankY: number[] = [];
  let yAcc = 0;
  for (let r = 0; r < layers.length; r++) {
    const maxH = Math.max(40, ...layers[r].map((id) => size.get(id)!.h));
    rankY[r] = yAcc + maxH / 2;
    yAcc += maxH + VGAP;
  }

  // Initial sequential x within each layer
  const x = new Map<string, number>();
  for (const layer of layers) {
    let cx = 0;
    for (const id of layer) { const w = size.get(id)!.w; x.set(id, cx + w / 2); cx += w + HGAP; }
  }

  const barycenter = (id: string, nbr: Map<string, string[]>): number | null => {
    const ns = nbr.get(id)!;
    let sum = 0, cnt = 0;
    for (const n of ns) { const v = x.get(n); if (v != null) { sum += v; cnt++; } }
    return cnt ? sum / cnt : null;
  };

  const packLayer = (layer: string[]) => {
    if (!layer.length) return;
    const arr = layer.map((id) => ({ id, w: size.get(id)!.w, d: x.get(id)!, pos: 0 }));
    arr.sort((a, b) => a.d - b.d);
    let prevRight = -Infinity;
    for (const it of arr) {
      const minPos = prevRight + HGAP + it.w / 2;
      it.pos = Math.max(it.d, minPos);
      prevRight = it.pos + it.w / 2;
    }
    const avgPos = arr.reduce((s, i) => s + i.pos, 0) / arr.length;
    const avgDes = arr.reduce((s, i) => s + i.d, 0) / arr.length;
    const shift = avgDes - avgPos;
    for (const it of arr) x.set(it.id, it.pos + shift);
    layer.sort((a, b) => x.get(a)! - x.get(b)!);
  };

  for (let iter = 0; iter < 8; iter++) {
    for (let r = 1; r < layers.length; r++) {
      for (const id of layers[r]) { const b = barycenter(id, parents); if (b != null) x.set(id, b); }
      packLayer(layers[r]);
    }
    for (let r = layers.length - 2; r >= 0; r--) {
      for (const id of layers[r]) { const b = barycenter(id, children); if (b != null) x.set(id, b); }
      packLayer(layers[r]);
    }
  }

  const pos = new Map<string, Placed>();
  for (const id of ids) {
    const s = size.get(id)!;
    pos.set(id, { cx: x.get(id)!, cy: rankY[rank.get(id)!], w: s.w, h: s.h });
  }

  // Direction transforms (layout is computed as TB)
  if (g.direction === 'LR' || g.direction === 'RL') {
    for (const p of pos.values()) { const ncx = p.cy, ncy = p.cx; p.cx = ncx; p.cy = ncy; }
  }
  if (g.direction === 'BT') {
    const maxY = Math.max(...[...pos.values()].map((p) => p.cy));
    for (const p of pos.values()) p.cy = maxY - p.cy;
  }
  if (g.direction === 'RL') {
    const maxX = Math.max(...[...pos.values()].map((p) => p.cx));
    for (const p of pos.values()) p.cx = maxX - p.cx;
  }

  return pos;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function borderPoint(shape: ShapeKind, p: Placed, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - p.cx, dy = ty - p.cy;
  if (dx === 0 && dy === 0) return { x: p.cx, y: p.cy };
  const hw = p.w / 2, hh = p.h / 2;
  let s: number;
  if (shape === 'circle') {
    s = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
  } else if (shape === 'diamond') {
    s = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  } else {
    s = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  }
  return { x: p.cx + dx * s, y: p.cy + dy * s };
}

// ── Object builders ──────────────────────────────────────────────────────────

function makeShape(
  shape: ShapeKind, x: number, y: number, w: number, h: number, z: number,
  colors: DiagramColors, now: number,
): CanvasObject {
  const baseShape = {
    id: nanoid(), x, y, width: w, height: h,
    rotation: 0, opacity: 1, locked: false, visible: true,
    layerId: 'default', parentId: null as string | null, zIndex: z,
    createdAt: now, updatedAt: now,
    fill: colors.fill, stroke: colors.stroke, strokeWidth: 2,
  };
  if (shape === 'circle') return { ...baseShape, type: 'ellipse' } as EllipseObject;
  if (shape === 'diamond') return { ...baseShape, type: 'diamond' } as DiamondObject;
  let cornerRadius = 0;
  if (shape === 'rounded' || shape === 'subroutine' || shape === 'cylinder') cornerRadius = 10;
  if (shape === 'stadium') cornerRadius = h / 2;
  return { ...baseShape, type: 'rect', cornerRadius } as RectObject;
}

function makeText(
  label: string, leftX: number, centerY: number, width: number, z: number,
  colors: DiagramColors, now: number, fontSize: number,
): TextObject {
  return {
    id: nanoid(), type: 'text',
    x: leftX, y: centerY - fontSize * 0.62, width, height: fontSize * 1.4,
    rotation: 0, opacity: 1, locked: false, visible: true,
    layerId: 'default', parentId: null, zIndex: z, createdAt: now, updatedAt: now,
    content: label, fontFamily: 'Inter, system-ui, sans-serif',
    fontSize, fontWeight: fontSize >= 15 ? 500 : 400, color: colors.text, align: 'center',
  };
}

export function buildDiagramObjects(code: string, opts: BuildOpts = {}): BuildResult {
  let g: ParsedGraph;
  try {
    g = parseMermaid(code);
  } catch (e) {
    return { objects: [], bbox: null, error: e instanceof Error ? e.message : String(e) };
  }
  if (g.nodes.size === 0) {
    return { objects: [], bbox: null, error: null };
  }

  const pos = layeredLayout(g);
  const colors = opts.colors ?? { stroke: '#1e1e1e', fill: '#ffffff', text: '#1e1e1e' };
  const dx = opts.offsetX ?? 0, dy = opts.offsetY ?? 0;
  const now = Date.now();
  let z = opts.baseZIndex ?? 0;

  const arrows: CanvasObject[] = [];
  const shapes: CanvasObject[] = [];
  const texts: CanvasObject[] = [];
  const labels: CanvasObject[] = [];

  // Background fill for edge-label chips (matches the canvas so they "interrupt" the arrow cleanly)
  const labelChipBg = opts.canvasBg ?? '#ffffff';

  // Edges → arrows (+ optional label chips)
  for (const e of g.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const start = borderPoint(g.nodes.get(e.from)!.shape, a, b.cx, b.cy);
    const end   = borderPoint(g.nodes.get(e.to)!.shape, b, a.cx, a.cy);
    const x1 = start.x + dx, y1 = start.y + dy, x2 = end.x + dx, y2 = end.y + dy;
    const bb = computeArrowBBox(x1, y1, x2, y2, false, 0);
    arrows.push({
      id: nanoid(), type: 'arrow',
      x: bb.x, y: bb.y, width: bb.width, height: bb.height,
      rotation: 0, opacity: 1, locked: false, visible: true,
      layerId: 'default', parentId: null, zIndex: z++, createdAt: now, updatedAt: now,
      x1, y1, x2, y2, curved: false, bendOffset: 0,
      startHead: 'none', endHead: e.arrow ? 'arrow' : 'none',
      stroke: colors.stroke, strokeWidth: 2,
    } as ArrowObject);

    if (e.label) {
      // Mid-point of the visible line segment
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Unit vector along the edge
      const edgeDX = x2 - x1, edgeDY = y2 - y1;
      const edgeLen = Math.hypot(edgeDX, edgeDY);

      // Right-perpendicular offset so the chip lifts off the arrow line.
      // For TB arrows (pointing down) this is rightward; for LR (pointing right) it is upward.
      const PERP = 12;
      const perpX = edgeLen > 0.1 ? (edgeDY / edgeLen) * PERP : 0;
      const perpY = edgeLen > 0.1 ? (-edgeDX / edgeLen) * PERP : -PERP;

      const chipCX = midX + perpX;
      const chipCY = midY + perpY;

      const tw  = measureText(e.label, LABEL_FONT);
      const pH  = 6, pV = 4;           // horizontal / vertical padding inside chip
      const cw  = tw + pH * 2;
      const ch  = 13 + pV * 2;         // font-size + vertical padding

      // Background rectangle ("chip") — same colour as canvas so it masks the arrow
      labels.push({
        id: nanoid(), type: 'rect',
        x: chipCX - cw / 2, y: chipCY - ch / 2, width: cw, height: ch,
        rotation: 0, opacity: 1, locked: false, visible: true,
        layerId: 'default', parentId: null as string | null, zIndex: 0,
        createdAt: now, updatedAt: now,
        fill: labelChipBg, stroke: colors.stroke, strokeWidth: 1, cornerRadius: 4,
      } as RectObject);

      // Label text on top of the chip
      labels.push(makeText(e.label, chipCX - cw / 2, chipCY, cw, 0, colors, now, 13));
    }
  }

  // Nodes → shapes + centered text
  for (const [id, p] of pos) {
    const n = g.nodes.get(id)!;
    const left = p.cx - p.w / 2 + dx;
    const top = p.cy - p.h / 2 + dy;
    shapes.push(makeShape(n.shape, left, top, p.w, p.h, z++, colors, now));
    texts.push(makeText(n.label, left, p.cy + dy, p.w, z++, colors, now, 15));
  }

  // Re-stack: arrows (bottom) → shapes → node text → edge labels (top)
  const ordered = [...arrows, ...shapes, ...texts, ...labels];
  ordered.forEach((o, i) => { o.zIndex = (opts.baseZIndex ?? 0) + i; });

  // Bounding box over shapes (node boxes)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.cx - p.w / 2 + dx);
    minY = Math.min(minY, p.cy - p.h / 2 + dy);
    maxX = Math.max(maxX, p.cx + p.w / 2 + dx);
    maxY = Math.max(maxY, p.cy + p.h / 2 + dy);
  }

  return { objects: ordered, bbox: { minX, minY, maxX, maxY }, error: null };
}
