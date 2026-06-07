import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';

interface DocsPanelProps {
  onClose: () => void;
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'stack',    label: 'Tech stack' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'features', label: 'Features' },
  { id: 'api',      label: 'API' },
  { id: 'diagrams', label: 'Diagrams' },
] as const;

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#A1A1AA', marginBottom: 8,
      }}>{kicker}</span>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#09090B', margin: 0 }}>
        {title}
      </h2>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '5px 11px', borderRadius: 6,
      background: '#F4F4F5', border: '1px solid #E4E4E7',
      fontSize: 12.5, fontWeight: 500, color: '#374151',
    }}>{children}</span>
  );
}

// Shared flowchart primitives — hand-drawn boxes/arrows in the same visual
// language as the landing page's other mockups, reused by every diagram below
// instead of pulling in a Mermaid renderer just for a few static figures.

function DiagramFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{
        padding: '10px 16px', background: '#0E0E13', borderBottom: '1px solid #26262F',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {(['#FF5F57', '#FFBD2E', '#28C840'] as const).map((c) => (
          <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 6, fontSize: 11.5, color: '#8B7CF6', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{title}</span>
      </div>
      <div style={{ padding: 28, background: '#FAFAFA' }}>{children}</div>
    </div>
  );
}

function FlowNode({ children, shape = 'rect', accent = '#E4E4E7', fg = '#374151' }:
  { children: React.ReactNode; shape?: 'rect' | 'round' | 'diamond'; accent?: string; fg?: string }) {
  if (shape === 'diamond') {
    return (
      <div style={{ width: 96, height: 96, position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 14, background: '#fff',
          border: `1.5px solid ${accent}`, transform: 'rotate(45deg)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }} />
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: fg, textAlign: 'center', padding: '0 18px', lineHeight: 1.25,
        }}>{children}</span>
      </div>
    );
  }
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${accent}`,
      borderRadius: shape === 'round' ? 999 : 8,
      padding: '9px 18px', fontSize: 12, fontWeight: 600, color: fg,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', whiteSpace: 'nowrap', flexShrink: 0,
    }}>{children}</div>
  );
}

function FlowArrow({ dir = 'right', label, color = '#D4D4D8' }: { dir?: 'right' | 'down'; label?: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: dir === 'right' ? 'column' : 'row',
      alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0,
      padding: dir === 'right' ? '0 6px' : '6px 0',
    }}>
      {label && <span style={{ fontSize: 9.5, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</span>}
      <svg width={dir === 'right' ? 30 : 14} height={dir === 'right' ? 14 : 30} viewBox={dir === 'right' ? '0 0 30 14' : '0 0 14 30'}>
        {dir === 'right' ? (
          <path d="M2 7H26M26 7L20 2M26 7L20 12" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M7 2V26M7 26L2 20M7 26L12 20" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

// ── Tech stack ───────────────────────────────────────────────────────────────

const STACK_GROUPS: { title: string; blurb: string; items: string[] }[] = [
  {
    title: 'Client',
    blurb: 'UI, state, and navigation',
    items: ['React 18', 'TypeScript', 'Vite', 'Zustand', 'React Router', 'Framer Motion'],
  },
  {
    title: 'Canvas engine',
    blurb: 'Custom 2D rendering, built from scratch',
    items: ['HTML5 Canvas (layered surfaces)', 'requestAnimationFrame loop', 'rbush R-tree spatial index'],
  },
  {
    title: 'Realtime & offline',
    blurb: 'Local-first persistence',
    items: ['Yjs (CRDT)', 'y-indexeddb'],
  },
  {
    title: 'Server',
    blurb: 'REST API and auth',
    items: ['Node.js', 'Fastify', 'JWT sessions', 'Google OAuth 2.0'],
  },
  {
    title: 'Database',
    blurb: 'Managed Postgres',
    items: ['PostgreSQL (NeonDB)'],
  },
  {
    title: 'Tooling',
    blurb: 'Export and utilities',
    items: ['jsPDF', 'nanoid', 'react-icons'],
  },
];

function StackSection() {
  const mob = useIsMobile();
  return (
    <div>
      <SectionHeading kicker="What it's built with" title="Technology stack" />
      <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 640 }}>
        A typical full-stack TypeScript setup: a React client talking to a small Fastify
        REST API, with a real Postgres database for durable storage and a CRDT layer for
        instant offline edits.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mob ? '1fr' : 'repeat(3, 1fr)',
        gap: 14,
      }}>
        {STACK_GROUPS.map((g) => (
          <div key={g.title} style={{
            border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 18px',
            background: '#FAFAFA',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#09090B', marginBottom: 2 }}>{g.title}</div>
            <div style={{ fontSize: 12.5, color: '#A1A1AA', marginBottom: 12 }}>{g.blurb}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.items.map((item) => <Pill key={item}>{item}</Pill>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workflow ─────────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { n: '01', title: 'Sign in', detail: 'Google OAuth 2.0 issues a signed JWT session.' },
  { n: '02', title: 'Pick a workspace', detail: 'Workspaces group related files, like project folders.' },
  { n: '03', title: 'Open a file', detail: 'Each file holds one canvas — its own object set & background.' },
  { n: '04', title: 'Draw & arrange', detail: 'Shapes, text, arrows, images, and freehand strokes on an infinite plane.' },
  { n: '05', title: 'Stay in sync', detail: 'Edits autosave locally instantly, and to the cloud every few seconds.' },
];

function WorkflowSection() {
  const mob = useIsMobile();
  return (
    <div>
      <SectionHeading kicker="How a session flows" title="User workflow" />
      <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 640 }}>
        From landing on the homepage to having a synced, shareable canvas — the whole
        journey is five short steps.
      </p>
      <div style={{
        display: 'flex', flexDirection: mob ? 'column' : 'row',
        border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', background: '#fff',
      }}>
        {JOURNEY_STEPS.map((s, i) => (
          <div key={s.n} style={{
            flex: 1, padding: '18px 18px',
            borderTop: mob && i > 0 ? '1px solid #F0F0F0' : undefined,
            borderLeft: !mob && i > 0 ? '1px solid #F0F0F0' : undefined,
            position: 'relative',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.06em', marginBottom: 8 }}>{s.n}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#09090B', marginBottom: 5 }}>{s.title}</div>
            <div style={{ fontSize: 12.5, color: '#71717A', lineHeight: 1.55 }}>{s.detail}</div>
            {!mob && i < JOURNEY_STEPS.length - 1 && (
              <div style={{
                position: 'absolute', top: 18, right: -7, zIndex: 1,
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', border: '1px solid #E4E4E7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1L5.5 4L1 7" stroke="#A1A1AA" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#09090B', marginBottom: 10 }}>From input to pixels</div>
        <p style={{ fontSize: 14, color: '#52525B', lineHeight: 1.7, margin: '0 0 16px', maxWidth: 640 }}>
          Drawing has to feel instant. Every pointer move only ever touches the in-memory
          store — the spatial index and renderer pick it up on the very next animation frame.
        </p>
        <DiagramFrame title="flowchart · render loop">
          <RenderLoopDiagram />
        </DiagramFrame>
      </div>
    </div>
  );
}

function RenderLoopDiagram() {
  const mob = useIsMobile();
  const dir = mob ? 'down' : 'right';
  return (
    <div style={{
      display: 'flex', flexDirection: mob ? 'column' : 'row',
      alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
    }}>
      <FlowNode accent="#3B82F6" fg="#1D4ED8">Pointer / keyboard input</FlowNode>
      <FlowArrow dir={dir} label="updates" />
      <FlowNode accent="#A1A1AA" fg="#52525B">Zustand store</FlowNode>
      <FlowArrow dir={dir} label="next frame" />
      <FlowNode accent="#8B7CF6" fg="#6D28D9">rbush index + canvas renderer</FlowNode>
      <FlowArrow dir={dir} label="~16ms" color="#4ADE80" />
      <FlowNode accent="#4ADE80" fg="#15803D" shape="round">Pixels on screen</FlowNode>
    </div>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────

const FEATURES: { icon: React.ReactNode; title: string; detail: string }[] = [
  {
    icon: <path d="M3 8a5 5 0 0110 0 5 5 0 0010 0" />,
    title: 'Infinite canvas',
    detail: 'Smooth pan, zoom, camera easing, and a live minimap.',
  },
  {
    icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><circle cx="17" cy="7" r="4" /><path d="M7 11v6a2 2 0 002 2h8" /></>,
    title: 'Rich element types',
    detail: 'Shapes, connectors, text, images, and freehand pen strokes.',
  },
  {
    icon: <><rect x="3" y="4" width="8" height="6" rx="1.5" /><rect x="13" y="14" width="8" height="6" rx="1.5" /><path d="M7 10v4a2 2 0 002 2h4" /></>,
    title: 'Mermaid → canvas',
    detail: 'Paste flowchart syntax; a Sugiyama-layout pass lays out real, editable shapes.',
  },
  {
    icon: <><path d="M7 18a4 4 0 01-1-7.9A6 6 0 0118 9a4.5 4.5 0 01-1 8.9" /><path d="M12 12v6m0-6l-2.5 2.5M12 12l2.5 2.5" /></>,
    title: 'Cloud + offline sync',
    detail: 'Postgres autosave every few seconds, Yjs/IndexedDB instant local cache.',
  },
  {
    icon: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.3 10.7l7.4-3.4M8.3 13.3l7.4 3.4" /></>,
    title: 'Shareable links',
    detail: 'Share a canvas read-only, or open it up for collaborative editing.',
  },
  {
    icon: <><path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" /></>,
    title: 'Export anywhere',
    detail: 'One-click export to PNG, SVG, or PDF.',
  },
  {
    icon: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 9h8M8 13h5" /></>,
    title: 'Command palette',
    detail: 'Keyboard-first navigation and actions, ⌘K away.',
  },
  {
    icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 000 16z" fill="#3B82F6" stroke="none" /></>,
    title: 'Light & dark themes',
    detail: 'New elements automatically pick a legible ink color for the canvas behind them.',
  },
];

function FeaturesSection() {
  const mob = useIsMobile();
  return (
    <div>
      <SectionHeading kicker="What you can do" title="Features" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: mob ? '1fr' : 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 18px', background: '#fff',
          }}>
            <div style={{
              flexShrink: 0, width: 36, height: 36, borderRadius: 9,
              background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {f.icon}
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#09090B', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#71717A', lineHeight: 1.6 }}>{f.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── API endpoints ────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { bg: string; fg: string }> = {
  GET:    { bg: '#EFF6FF', fg: '#3B82F6' },
  POST:   { bg: '#F0FDF4', fg: '#22C55E' },
  PUT:    { bg: '#FFF7ED', fg: '#F59E0B' },
  DELETE: { bg: '#FEF2F2', fg: '#EF4444' },
};

function MethodBadge({ method }: { method: string }) {
  const c = METHOD_COLORS[method] ?? { bg: '#F4F4F5', fg: '#71717A' };
  return (
    <span style={{
      display: 'inline-block', minWidth: 50, textAlign: 'center',
      padding: '3px 8px', borderRadius: 5,
      background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', fontFamily: 'ui-monospace, monospace',
    }}>{method}</span>
  );
}

const API_GROUPS: { title: string; routes: { method: string; path: string; detail: string }[] }[] = [
  {
    title: 'Auth',
    routes: [
      { method: 'GET', path: '/auth/google', detail: 'Start the Google OAuth 2.0 flow' },
      { method: 'GET', path: '/auth/google/callback', detail: 'OAuth redirect target — issues a JWT' },
    ],
  },
  {
    title: 'Workspaces',
    routes: [
      { method: 'GET', path: '/api/workspaces', detail: 'List the signed-in user’s workspaces' },
      { method: 'POST', path: '/api/workspaces', detail: 'Create (or upsert) a workspace' },
      { method: 'PUT', path: '/api/workspaces/:id', detail: 'Rename / restyle a workspace' },
      { method: 'DELETE', path: '/api/workspaces/:id', detail: 'Delete a workspace' },
    ],
  },
  {
    title: 'Files',
    routes: [
      { method: 'GET', path: '/api/workspaces/:wsId/files', detail: 'List files inside a workspace' },
      { method: 'POST', path: '/api/files', detail: 'Create (or upsert) a file' },
      { method: 'PUT', path: '/api/files/:id', detail: 'Rename a file' },
      { method: 'DELETE', path: '/api/files/:id', detail: 'Delete a file' },
    ],
  },
  {
    title: 'Canvas snapshots',
    routes: [
      { method: 'GET', path: '/api/files/:id/canvas', detail: 'Load a file’s saved objects, background & grid' },
      { method: 'PUT', path: '/api/files/:id/canvas', detail: 'Persist the current canvas snapshot' },
    ],
  },
  {
    title: 'Sharing',
    routes: [
      { method: 'GET', path: '/api/files/:id/share', detail: 'Read the current share link state (owner)' },
      { method: 'POST', path: '/api/files/:id/share', detail: 'Enable sharing in view or edit mode (owner)' },
      { method: 'DELETE', path: '/api/files/:id/share', detail: 'Revoke a share link (owner)' },
      { method: 'GET', path: '/api/share/:token', detail: 'Open a shared canvas (public, no auth)' },
      { method: 'PUT', path: '/api/share/:token/canvas', detail: 'Save edits to a shared canvas (edit-mode only)' },
    ],
  },
  {
    title: 'Health',
    routes: [
      { method: 'GET', path: '/health', detail: 'Liveness probe — returns { ok: true }' },
    ],
  },
];

function ApiSection() {
  return (
    <div>
      <SectionHeading kicker="REST surface" title="API endpoints" />
      <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 640 }}>
        A small Fastify REST API fronts everything. All <code style={{ fontFamily: 'ui-monospace, monospace', background: '#F4F4F5', padding: '1px 5px', borderRadius: 4, fontSize: 12.5 }}>/api/*</code> routes
        require a bearer JWT — except public share links, which anyone with the URL can open.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {API_GROUPS.map((group) => (
          <div key={group.title} style={{ border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0',
              fontSize: 12, fontWeight: 700, color: '#52525B', letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>{group.title}</div>
            <div>
              {group.routes.map((r, i) => (
                <div key={r.path + r.method} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px',
                  borderTop: i > 0 ? '1px solid #F4F4F5' : undefined, flexWrap: 'wrap',
                }}>
                  <MethodBadge method={r.method} />
                  <code style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12.5,
                    color: '#18181B', fontWeight: 600,
                  }}>{r.path}</code>
                  <span style={{ fontSize: 12.5, color: '#A1A1AA', marginLeft: 'auto' }}>{r.detail}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Diagrams (mermaid-style flowcharts documenting the system) ──────────────

function FlowRow({ caption, color, children }: { caption: string; color: string; children: React.ReactNode }) {
  const mob = useIsMobile();
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color, letterSpacing: '0.06em',
        textTransform: 'uppercase', marginBottom: 12, textAlign: mob ? 'left' : 'center',
      }}>{caption}</div>
      <div style={{
        display: 'flex', flexDirection: mob ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      }}>{children}</div>
    </div>
  );
}

function ArchitectureDiagram() {
  const mob = useIsMobile();
  const dir = mob ? 'down' : 'right';
  return (
    <DiagramFrame title="flowchart · two save paths, one store">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <FlowRow caption="Local path · saved instantly, works offline" color="#4ADE80">
          <FlowNode accent="#3B82F6" fg="#1D4ED8">React client</FlowNode>
          <FlowArrow dir={dir} />
          <FlowNode accent="#4ADE80" fg="#15803D">Yjs (CRDT)</FlowNode>
          <FlowArrow dir={dir} />
          <FlowNode accent="#4ADE80" fg="#15803D" shape="round">IndexedDB</FlowNode>
        </FlowRow>
        <FlowRow caption="Cloud path · synced every ~5 seconds" color="#8B7CF6">
          <FlowNode accent="#3B82F6" fg="#1D4ED8">React client</FlowNode>
          <FlowArrow dir={dir} label="JWT" />
          <FlowNode accent="#8B7CF6" fg="#6D28D9">Fastify API</FlowNode>
          <FlowArrow dir={dir} label="SQL" />
          <FlowNode accent="#22C55E" fg="#15803D" shape="round">PostgreSQL</FlowNode>
        </FlowRow>
      </div>
      <p style={{ margin: '24px 0 0', fontSize: 12.5, color: '#A1A1AA', textAlign: 'center', lineHeight: 1.6 }}>
        The cloud snapshot loads first when a file opens; the local copy then takes
        over so editing keeps working — and keeps saving — the moment the network drops.
      </p>
    </DiagramFrame>
  );
}

function MermaidFeatureDiagram() {
  const mob = useIsMobile();
  const dir = mob ? 'down' : 'right';
  return (
    <DiagramFrame title="flowchart · mermaid → canvas">
      <div style={{
        display: 'flex', flexDirection: mob ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      }}>
        <FlowNode accent="#A1A1AA" fg="#52525B">Paste Mermaid syntax</FlowNode>
        <FlowArrow dir={dir} label="parse" />
        <FlowNode shape="diamond" accent="#F59E0B" fg="#B45309">Sugiyama layered layout</FlowNode>
        <FlowArrow dir={dir} label="emit" />
        <FlowNode accent="#3B82F6" fg="#1D4ED8">Native canvas elements</FlowNode>
      </div>
      <p style={{ margin: '20px 0 0', fontSize: 12.5, color: '#A1A1AA', textAlign: 'center', lineHeight: 1.6 }}>
        The result is plain shapes, arrows and labels — selectable, movable, and
        restyleable like anything else drawn by hand.
      </p>
    </DiagramFrame>
  );
}

function DiagramsSection() {
  return (
    <div>
      <SectionHeading kicker="Visual reference" title="Diagrams" />
      <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 640 }}>
        Two flowcharts worth knowing — how a single edit ends up safe in two different
        places at once, and how a pasted Mermaid diagram turns into native shapes.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ArchitectureDiagram />
        <MermaidFeatureDiagram />
      </div>
    </div>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────

const SECTION_RENDER: Record<typeof SECTIONS[number]['id'], React.ComponentType> = {
  stack: StackSection,
  workflow: WorkflowSection,
  features: FeaturesSection,
  api: ApiSection,
  diagrams: DiagramsSection,
};

export function DocsPanel({ onClose }: DocsPanelProps) {
  const mob = useIsMobile();
  const [active, setActive] = useState<typeof SECTIONS[number]['id']>('stack');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<string, HTMLDivElement | null>>>({});

  function scrollTo(id: typeof SECTIONS[number]['id']) {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: '#fff', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif', color: '#09090B',
      }}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', gap: 16,
        padding: mob ? '0 16px' : '0 28px', borderBottom: '1px solid #F0F0F0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: '#18181B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M8 3V13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>Sketch</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.06em',
            textTransform: 'uppercase', borderLeft: '1px solid #E4E4E7', paddingLeft: 12, marginLeft: 2,
          }}>Documentation</span>
        </div>

        <button
          onClick={onClose}
          title="Close documentation"
          style={{
            marginLeft: 'auto', width: 32, height: 32, borderRadius: 8,
            border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525B',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F4F4F5'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Section tabs */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 4, overflowX: 'auto',
        padding: mob ? '10px 16px' : '12px 28px', borderBottom: '1px solid #F0F0F0',
      }}>
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                padding: '7px 14px', borderRadius: 8, whiteSpace: 'nowrap',
                border: `1px solid ${isActive ? '#18181B' : '#E4E4E7'}`,
                background: isActive ? '#18181B' : '#fff',
                color: isActive ? '#fff' : '#52525B',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
              }}
            >{s.label}</button>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: mob ? '32px 20px 80px' : '48px 28px 100px' }}>

          {/* Intro */}
          <div style={{ marginBottom: 48 }}>
            <h1 style={{ fontSize: mob ? 28 : 38, fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 12px' }}>
              How Sketch is built
            </h1>
            <p style={{ fontSize: mob ? 14.5 : 16, color: '#71717A', lineHeight: 1.7, margin: 0, maxWidth: 640 }}>
              A quick tour of the stack, the moving parts, and the API underneath —
              written for anyone curious about what's happening behind the canvas.
            </p>
          </div>

          {SECTIONS.map((s, i) => {
            const Comp = SECTION_RENDER[s.id];
            return (
              <div
                key={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                style={{
                  paddingTop: i === 0 ? 0 : 56,
                  marginTop: i === 0 ? 0 : 56,
                  borderTop: i === 0 ? undefined : '1px solid #F0F0F0',
                  scrollMarginTop: 132,
                }}
              >
                <Comp />
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function DocsPanelGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && <DocsPanel onClose={onClose} />}
    </AnimatePresence>
  );
}
