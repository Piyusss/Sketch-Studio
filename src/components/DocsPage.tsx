import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Navigation structure ─────────────────────────────────────────────────────
// Grouped sidebar sections. Each leaf maps 1:1 to a content section rendered
// below, in order — the sidebar is a table of contents, not a separate model.

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'intro',    label: 'Introduction' },
      { id: 'stack',    label: 'Tech stack' },
      { id: 'features', label: 'Features' },
    ],
  },
  {
    label: 'Architecture',
    items: [
      { id: 'workflow', label: 'User workflow' },
      { id: 'diagrams', label: 'System diagrams' },
    ],
  },
  {
    label: 'API reference',
    items: [
      { id: 'api', label: 'Endpoints' },
    ],
  },
] as const;

type SectionId = typeof NAV_GROUPS[number]['items'][number]['id'];
const FLAT_ITEMS: { id: SectionId; label: string }[] = NAV_GROUPS.flatMap((g) => [...g.items]);

// ── Shared prose primitives ──────────────────────────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, color: '#52525B', lineHeight: 1.75, margin: '10px 0 0', maxWidth: 660 }}>
      {children}
    </p>
  );
}

type BulletItem = { lead?: string; text: string };

function BulletList({ items }: { items: BulletItem[] }) {
  return (
    <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 660 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 14, color: '#52525B', lineHeight: 1.65 }}>
          <span style={{ flexShrink: 0, marginTop: 9, width: 4, height: 4, borderRadius: '50%', background: '#A1A1AA' }} />
          <span>
            {it.lead && <strong style={{ color: '#09090B', fontWeight: 600 }}>{it.lead} — </strong>}
            {it.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Shared flowchart primitives — hand-drawn boxes/arrows in the same visual
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

// ── Section content: Introduction ────────────────────────────────────────────

function IntroductionBody() {
  return (
    <Prose>
      Sketch is an infinite-canvas drawing and diagramming tool, built end to end as a
      full-stack project — a custom 2D rendering engine, CRDT-based offline sync, and a
      cloud backend, all wired together. This reference walks through how it's put
      together, what it can do, and the API underneath, written for anyone sizing up
      the project without reading the source.
    </Prose>
  );
}

// ── Section content: Tech stack ──────────────────────────────────────────────

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

function StackBody() {
  const mob = useIsMobile();
  return (
    <>
      <Prose>
        A typical full-stack TypeScript setup: a React client talking to a small Fastify
        REST API, with a real Postgres database for durable storage and a CRDT layer for
        instant offline edits.
      </Prose>
      <div style={{
        display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(2, 1fr)',
        columnGap: 40, rowGap: 24, marginTop: 18,
      }}>
        {STACK_GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#09090B' }}>{g.title}</div>
            <div style={{ fontSize: 12.5, color: '#A1A1AA', margin: '2px 0 0' }}>{g.blurb}</div>
            <BulletList items={g.items.map((item) => ({ text: item }))} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Section content: Features ─────────────────────────────────────────────────

const FEATURES: BulletItem[] = [
  { lead: 'Infinite canvas', text: 'Smooth pan, zoom, camera easing, and a live minimap.' },
  { lead: 'Rich element types', text: 'Shapes, connectors, text, images, and freehand pen strokes.' },
  { lead: 'Mermaid → canvas', text: 'Paste flowchart syntax; a Sugiyama-layout pass lays out real, editable shapes.' },
  { lead: 'Cloud + offline sync', text: 'Postgres autosave every few seconds, Yjs/IndexedDB instant local cache.' },
  { lead: 'Shareable links', text: 'Share a canvas read-only, or open it up for collaborative editing.' },
  { lead: 'Export anywhere', text: 'One-click export to PNG, SVG, or PDF.' },
  { lead: 'Command palette', text: 'Keyboard-first navigation and actions, ⌘K away.' },
  { lead: 'Light & dark themes', text: 'New elements automatically pick a legible ink color for the canvas behind them.' },
];

function FeaturesBody() {
  return <BulletList items={FEATURES} />;
}

// ── Section content: User workflow ───────────────────────────────────────────

const JOURNEY_STEPS = [
  { n: '01', title: 'Sign in', detail: 'Google OAuth 2.0 issues a signed JWT session.' },
  { n: '02', title: 'Pick a workspace', detail: 'Workspaces group related files, like project folders.' },
  { n: '03', title: 'Open a file', detail: 'Each file holds one canvas — its own object set & background.' },
  { n: '04', title: 'Draw & arrange', detail: 'Shapes, text, arrows, images, and freehand strokes on an infinite plane.' },
  { n: '05', title: 'Stay in sync', detail: 'Edits autosave locally instantly, and to the cloud every few seconds.' },
];

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

function WorkflowBody() {
  return (
    <>
      <Prose>
        From landing on the homepage to having a synced, shareable canvas — the whole
        journey is five short steps.
      </Prose>
      <ol style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 13, maxWidth: 660 }}>
        {JOURNEY_STEPS.map((s) => (
          <li key={s.n} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <span style={{
              flexShrink: 0, marginTop: 1, width: 21, height: 21, borderRadius: '50%',
              background: '#F4F4F5', color: '#71717A', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{s.n}</span>
            <span style={{ fontSize: 14, color: '#52525B', lineHeight: 1.65 }}>
              <strong style={{ color: '#09090B', fontWeight: 600 }}>{s.title} — </strong>
              {s.detail}
            </span>
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 30 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#09090B', marginBottom: 6 }}>From input to pixels</div>
        <Prose>
          Drawing has to feel instant. Every pointer move only ever touches the in-memory
          store — the spatial index and renderer pick it up on the very next animation frame.
        </Prose>
        <div style={{ marginTop: 16 }}>
          <DiagramFrame title="flowchart · render loop">
            <RenderLoopDiagram />
          </DiagramFrame>
        </div>
      </div>
    </>
  );
}

// ── Section content: System diagrams ─────────────────────────────────────────

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

function DiagramsBody() {
  return (
    <>
      <Prose>
        Two flowcharts worth knowing — how a single edit ends up safe in two different
        places at once, and how a pasted Mermaid diagram turns into native shapes.
      </Prose>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 18 }}>
        <ArchitectureDiagram />
        <MermaidFeatureDiagram />
      </div>
    </>
  );
}

// ── Section content: API endpoints ───────────────────────────────────────────

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

function ApiBody() {
  return (
    <>
      <Prose>
        A small Fastify REST API fronts everything. All <code style={{ fontFamily: 'ui-monospace, monospace', background: '#F4F4F5', padding: '1px 5px', borderRadius: 4, fontSize: 12.5 }}>/api/*</code> routes
        require a bearer JWT — except public share links, which anyone with the URL can open.
      </Prose>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, maxWidth: 660 }}>
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
    </>
  );
}

// ── Section registry ─────────────────────────────────────────────────────────

const SECTION_META: Record<SectionId, { title: string; Body: React.ComponentType }> = {
  intro:    { title: 'Introduction',  Body: IntroductionBody },
  stack:    { title: 'Tech stack',    Body: StackBody },
  features: { title: 'Features',      Body: FeaturesBody },
  workflow: { title: 'User workflow', Body: WorkflowBody },
  diagrams: { title: 'System diagrams', Body: DiagramsBody },
  api:      { title: 'API endpoints', Body: ApiBody },
};

// ── Sidebar (desktop) ────────────────────────────────────────────────────────

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
      <path d="M2.5 4L5 6.25L7.5 4" stroke="#A1A1AA" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sidebar({ active, onNavigate, collapsedGroups, onToggleGroup }: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
  collapsedGroups: Set<string>;
  onToggleGroup: (label: string) => void;
}) {
  return (
    <nav style={{ width: 240, flexShrink: 0, borderRight: '1px solid #F0F0F0', overflowY: 'auto', padding: '24px 14px' }}>
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <button
              onClick={() => onToggleGroup(group.label)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#A1A1AA',
              }}
            >
              {group.label}
              <ChevronIcon collapsed={isCollapsed} />
            </button>
            {!isCollapsed && (
              <ul style={{ margin: '2px 0 0', padding: 0, listStyle: 'none' }}>
                {group.items.map((item) => {
                  const isActive = active === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onNavigate(item.id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 12px', margin: '1px 0', borderRadius: 6,
                          border: 'none', cursor: 'pointer',
                          background: isActive ? '#F4F4F5' : 'transparent',
                          borderLeft: `2px solid ${isActive ? '#18181B' : 'transparent'}`,
                          fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#09090B' : '#71717A',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#18181B'; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#71717A'; }}
                      >{item.label}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Mobile nav (horizontal scrollable strip) ─────────────────────────────────

function MobileNav({ active, onNavigate }: { active: SectionId; onNavigate: (id: SectionId) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 20px',
      borderBottom: '1px solid #F0F0F0', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 2, background: '#fff',
    }}>
      {FLAT_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              padding: '6px 13px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
              border: `1px solid ${isActive ? '#18181B' : '#E4E4E7'}`,
              background: isActive ? '#18181B' : '#fff',
              color: isActive ? '#fff' : '#52525B',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s, color 0.12s',
            }}
          >{item.label}</button>
        );
      })}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={{
      flexShrink: 0, height: 54, display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 24px', borderBottom: '1px solid #F0F0F0', background: '#fff',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: '#18181B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8H13M8 3V13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#09090B' }}>Sketch</span>
      </Link>
      <span style={{ fontSize: 14, color: '#D4D4D8' }}>/</span>
      <span style={{ fontSize: 14, color: '#A1A1AA', fontWeight: 500 }}>Docs</span>
    </header>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function DocsPage() {
  const mob = useIsMobile();
  const [active, setActive] = useState<SectionId>(FLAT_ITEMS[0].id);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const suppressObserver = useRef(false);
  const suppressTimer = useRef<number | undefined>(undefined);

  function navigateTo(id: SectionId) {
    setActive(id);
    suppressObserver.current = true;
    if (suppressTimer.current) window.clearTimeout(suppressTimer.current);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    suppressTimer.current = window.setTimeout(() => { suppressObserver.current = false; }, 700);
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  // Scrollspy: highlight whichever section sits closest to the top of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (suppressObserver.current) return;
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      const topMost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
      const id = topMost.target.getAttribute('data-section-id') as SectionId | null;
      if (id) setActive(id);
    }, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });

    for (const item of FLAT_ITEMS) {
      const el = sectionRefs.current[item.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: '#fff', fontFamily: 'Inter, system-ui, sans-serif', color: '#09090B',
    }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!mob && (
          <Sidebar active={active} onNavigate={navigateTo} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup} />
        )}
        <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {mob && <MobileNav active={active} onNavigate={navigateTo} />}
          <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: mob ? '32px 20px 100px' : '44px 56px 120px', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: mob ? 28 : 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
              Sketch documentation
            </h1>
            <Prose>
              A complete-enough reference to the stack, the moving parts, and the API
              underneath — written so anyone can get the gist without reading the source.
            </Prose>

            {FLAT_ITEMS.map((item, i) => {
              const { title, Body } = SECTION_META[item.id];
              return (
                <section
                  key={item.id}
                  ref={(el) => { sectionRefs.current[item.id] = el; }}
                  data-section-id={item.id}
                  style={{ scrollMarginTop: mob ? 104 : 24 }}
                >
                  {i > 0 && <hr style={{ border: 'none', borderTop: '1px solid #F0F0F0', margin: '40px 0' }} />}
                  <h2 style={{
                    fontSize: 21, fontWeight: 800, letterSpacing: '-0.015em', color: '#09090B',
                    margin: i === 0 ? '40px 0 0' : 0,
                  }}>{title}</h2>
                  <Body />
                </section>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
