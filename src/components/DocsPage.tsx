import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Navigation structure ─────────────────────────────────────────────────────
// Grouped sidebar sections. Each leaf maps 1:1 to a content section rendered
// below, in order — the sidebar is a table of contents, not a separate model.

const NAV_GROUPS = [
  {
    label: 'Project overview',
    items: [
      { id: 'intro',    label: 'Introduction' },
      { id: 'goals',    label: 'Problem & goals' },
      { id: 'stack',    label: 'Tech stack' },
      { id: 'features', label: 'Feature tour' },
    ],
  },
  {
    label: 'System architecture',
    items: [
      { id: 'architecture', label: 'High-level overview' },
      { id: 'rendering',    label: 'Rendering engine' },
      { id: 'state',        label: 'State & data model' },
      { id: 'interaction',  label: 'Interaction model' },
      { id: 'spatial',      label: 'Spatial index' },
      { id: 'history',      label: 'Undo / redo' },
    ],
  },
  {
    label: 'Data & sync',
    items: [
      { id: 'persistence', label: 'Persistence model' },
      { id: 'schema',      label: 'Database schema' },
      { id: 'auth',        label: 'Authentication' },
      { id: 'sharing',     label: 'Sharing' },
    ],
  },
  {
    label: 'Feature deep-dives',
    items: [
      { id: 'tools',         label: 'Tools & elements' },
      { id: 'navigation',    label: 'Canvas navigation' },
      { id: 'mermaidfeature', label: 'Mermaid → canvas' },
      { id: 'export',        label: 'Export' },
      { id: 'shortcuts',     label: 'Keyboard shortcuts' },
    ],
  },
  {
    label: 'API reference',
    items: [
      { id: 'api', label: 'REST endpoints' },
    ],
  },
  {
    label: 'Engineering notes',
    items: [
      { id: 'decisions', label: 'Design decisions' },
    ],
  },
] as const;

type SectionId = typeof NAV_GROUPS[number]['items'][number]['id'];
const FLAT_ITEMS: { id: SectionId; label: string }[] = NAV_GROUPS.flatMap((g) => [...g.items]);

// ── Prose primitives ─────────────────────────────────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, color: '#52525B', lineHeight: 1.75, margin: '12px 0 0', maxWidth: 680 }}>
      {children}
    </p>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18181B', letterSpacing: '-0.01em', margin: '30px 0 0' }}>
      {children}
    </h3>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.86em',
      background: '#F4F4F5', border: '1px solid #ECECEE', padding: '1px 5px', borderRadius: 4, color: '#3F3F46',
    }}>{children}</code>
  );
}

type BulletItem = { lead?: string; text: React.ReactNode };

function BulletList({ items }: { items: BulletItem[] }) {
  return (
    <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 680 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 14, color: '#52525B', lineHeight: 1.65 }}>
          <span style={{ flexShrink: 0, marginTop: 9, width: 4, height: 4, borderRadius: '50%', background: '#A1A1AA' }} />
          <span>
            {it.lead && <strong style={{ color: '#09090B', fontWeight: 600 }}>{it.lead}{typeof it.text === 'string' && it.text ? ' — ' : ''}</strong>}
            {it.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ children, tone = 'note' }: { children: React.ReactNode; tone?: 'note' | 'tip' }) {
  const c = tone === 'tip'
    ? { bar: '#22C55E', bg: '#F0FDF4', label: 'Why it matters' }
    : { bar: '#3B82F6', bg: '#EFF6FF', label: 'Note' };
  return (
    <div style={{
      margin: '18px 0 0', maxWidth: 680, background: c.bg, borderLeft: `3px solid ${c.bar}`,
      borderRadius: '0 8px 8px 0', padding: '12px 16px',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.bar, marginBottom: 4 }}>{c.label}</div>
      <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────

function DataTable({ columns, rows, mono }: { columns: string[]; rows: React.ReactNode[][]; mono?: boolean }) {
  return (
    <div style={{ margin: '18px 0 0', maxWidth: 680, border: '1px solid #E4E4E7', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFAFA' }}>
              {columns.map((c, i) => (
                <th key={i} style={{
                  textAlign: 'left', padding: '9px 14px', fontWeight: 700, color: '#52525B',
                  fontSize: 11.5, letterSpacing: '0.03em', textTransform: 'uppercase',
                  borderBottom: '1px solid #E4E4E7', whiteSpace: 'nowrap',
                }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: ri > 0 ? '1px solid #F4F4F5' : undefined }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '9px 14px', color: ci === 0 ? '#18181B' : '#52525B', verticalAlign: 'top',
                    lineHeight: 1.55,
                    fontFamily: mono && ci === 0 ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                    fontWeight: ci === 0 ? 600 : 400,
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Diagram frame (window chrome) ──────────────────────────────────────────────

function DiagramFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '18px 0 0', maxWidth: 680, border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{
        padding: '10px 16px', background: '#0E0E13', borderBottom: '1px solid #26262F',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {(['#FF5F57', '#FFBD2E', '#28C840'] as const).map((c) => (
          <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 6, fontSize: 11.5, color: '#8B7CF6', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{title}</span>
      </div>
      <div style={{ padding: 24, background: '#FAFAFA' }}>{children}</div>
    </div>
  );
}

// ── Mermaid renderer (lazy-loaded) ─────────────────────────────────────────────
// `mermaid` is a heavy dependency, so it is dynamically imported the first time a
// diagram mounts and then cached. The whole docs route is its own bundle chunk,
// so the main canvas app never pays for it. Renders are serialised through a
// promise chain to sidestep mermaid's historical concurrent-render quirks.

type MermaidApi = typeof import('mermaid')['default'];
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        fontFamily: 'Inter, system-ui, sans-serif',
        themeVariables: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          background: '#FAFAFA',
          primaryColor: '#EFF6FF',
          primaryBorderColor: '#3B82F6',
          primaryTextColor: '#1E3A8A',
          secondaryColor: '#F5F3FF',
          secondaryBorderColor: '#8B7CF6',
          secondaryTextColor: '#5B21B6',
          tertiaryColor: '#F4F4F5',
          tertiaryBorderColor: '#D4D4D8',
          lineColor: '#94A3B8',
          textColor: '#3F3F46',
          noteBkgColor: '#FEF9C3',
          noteBorderColor: '#FDE047',
          noteTextColor: '#713F12',
        },
        flowchart: { curve: 'basis', padding: 14, useMaxWidth: true },
        sequence: { useMaxWidth: true, mirrorActors: false },
        er: { useMaxWidth: true },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

let renderChain: Promise<unknown> = Promise.resolve();

function MermaidDiagram({ title, code }: { title: string; code: string }) {
  const safeId = 'mmd' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const holderRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    renderChain = renderChain
      .then(async () => {
        if (cancelled) return;
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(safeId, code.trim());
        if (cancelled) return;
        if (holderRef.current) holderRef.current.innerHTML = svg;
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setErrMsg(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [code, safeId]);

  return (
    <DiagramFrame title={title}>
      {status === 'loading' && (
        <div style={{
          minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, color: '#A1A1AA', fontSize: 13,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid #E4E4E7', borderTopColor: '#8B7CF6',
            animation: 'docs-spin 0.8s linear infinite', display: 'inline-block',
          }} />
          Rendering diagram…
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 12.5, color: '#B45309', lineHeight: 1.6, fontFamily: 'ui-monospace, monospace' }}>
          Couldn’t render this diagram: {errMsg}
        </div>
      )}
      <div
        ref={holderRef}
        style={{ display: status === 'ready' ? 'flex' : 'none', justifyContent: 'center', overflowX: 'auto' }}
      />
      <style>{'@keyframes docs-spin { to { transform: rotate(360deg); } }'}</style>
    </DiagramFrame>
  );
}

// ── Mermaid diagram sources (real, accurate to the codebase) ────────────────────

const DIAG_ARCHITECTURE = `
flowchart TB
  subgraph Client["Browser · React SPA"]
    UI["UI layer<br/>Toolbar · Panels · Routes"]
    SM["Interaction<br/>state machine"]
    Store["Zustand store<br/>objects · camera · selection"]
    Engine["Canvas engine<br/>renderer · rbush · camera"]
    Y["Yjs doc<br/>+ y-indexeddb"]
  end
  subgraph Server["Fastify API · Node.js"]
    REST["REST routes<br/>/api/*"]
    JWT["JWT verify<br/>+ Google OAuth"]
  end
  DB[("PostgreSQL<br/>NeonDB")]

  UI --> SM --> Store --> Engine --> Screen["Pixels"]
  Store <--> Y --> IDB[("IndexedDB")]
  UI -->|"fetch · Bearer JWT"| REST
  REST --> JWT
  REST --> DB
`;

const DIAG_RENDER_LOOP = `
flowchart LR
  In["Pointer /<br/>keyboard"] --> SM["State<br/>machine"]
  SM -->|"mutate"| St["Zustand<br/>store"]
  St -->|"set dirty flag"| RAF{{"requestAnimationFrame<br/>loop"}}
  RAF --> Cam["tickCamera<br/>(ease)"]
  RAF --> Cull["rbush<br/>viewport cull"]
  Cull --> Draw["draw: grid ·<br/>objects · selection"]
  Cam --> Draw
  Draw --> Px["Pixels<br/>(~16 ms)"]
`;

const DIAG_INTERACTION = `
stateDiagram-v2
  [*] --> idle
  idle --> panning: space / middle-drag / pan tool
  idle --> selecting: drag empty space
  idle --> moving: drag an object
  idle --> resizing: drag a resize handle
  idle --> rotating: drag the rotate handle
  idle --> drawing: rect / ellipse / diamond / frame
  idle --> drawing_pen: pen tool
  idle --> drawing_arrow: arrow / line tool
  idle --> erasing: eraser tool
  idle --> editing_text: text tool / double-click
  panning --> idle: pointer up (+ inertia)
  selecting --> idle: pointer up
  moving --> idle: commit move
  resizing --> idle: commit resize
  rotating --> idle: commit rotation
  drawing --> idle: commit shape
  drawing_pen --> idle: commit stroke
  drawing_arrow --> idle: commit arrow
  erasing --> idle: commit erase
  editing_text --> idle: commit / cancel
`;

const DIAG_PERSISTENCE = `
flowchart LR
  Edit["Canvas edit"] --> Store["Zustand store"]
  Store -->|"store.subscribe<br/>(synchronous)"| Yj["Yjs transaction"]
  Yj --> IDB[("IndexedDB<br/>instant · offline")]
  Store -->|"debounced ~5 s"| Save["api.canvas.save()"]
  Save -->|"PUT /files/:id/canvas<br/>Bearer JWT"| API["Fastify API"]
  API --> PG[("PostgreSQL<br/>JSONB snapshot")]
`;

const DIAG_SCHEMA = `
erDiagram
  users ||--o{ workspaces : owns
  users ||--o{ files : owns
  workspaces ||--o{ files : contains
  files ||--|| canvas_snapshots : has
  users {
    text id PK
    text email
    timestamptz created_at
  }
  workspaces {
    text id PK
    text user_id FK
    text name
    text emoji
    text color
  }
  files {
    text id PK
    text workspace_id FK
    text user_id FK
    text name
    text share_token
    text share_mode
  }
  canvas_snapshots {
    text file_id PK
    jsonb objects
    text bg_color
    text grid_style
    bigint updated_at
  }
`;

const DIAG_AUTH = `
sequenceDiagram
  autonumber
  participant U as User
  participant C as React client
  participant A as Fastify API
  participant G as Google
  U->>C: Click "Sign in"
  C->>A: GET /auth/google
  A->>G: 302 redirect to consent
  U->>G: Approve access
  G->>A: GET /auth/google/callback?code
  A->>G: Exchange code for tokens
  G-->>A: access_token + profile
  A->>A: ensureUser() + sign 30-day JWT
  A-->>C: redirect /auth/callback?token&user
  C->>C: Store JWT in authStore
  C->>A: GET /api/* (Authorization: Bearer)
  A-->>C: Protected data
`;

const DIAG_SHARING = `
sequenceDiagram
  participant O as Owner
  participant A as API
  participant V as Visitor
  O->>A: POST /files/:id/share { mode }
  A->>A: create share_token + set share_mode
  A-->>O: { token, mode }
  O-->>V: Share link /share/:token
  V->>A: GET /api/share/:token  (no auth)
  A-->>V: snapshot + name + mode
  alt mode == "edit"
    V->>A: PUT /api/share/:token/canvas
    A-->>V: { ok: true }
  else mode == "view"
    V--xA: edits disabled client-side
  end
`;

const DIAG_MERMAID = `
flowchart LR
  Src["Mermaid<br/>source text"] --> Parse["parseMermaid()<br/>nodes + edges"]
  Parse --> Rank["Kahn topo sort<br/>longest-path rank"]
  Rank --> Bary["barycenter<br/>crossing reduction<br/>(8 passes)"]
  Bary --> Place["layered layout<br/>(x, y per node)"]
  Place --> Build["build native objects<br/>shapes · text · arrows"]
  Build --> Store["Canvas store"]
`;

// ── Section content: Introduction ────────────────────────────────────────────

function IntroductionBody() {
  return (
    <>
      <Prose>
        <strong style={{ color: '#09090B' }}>Sketch</strong> is an infinite-canvas drawing and
        diagramming tool — think of an Excalidraw/tldraw-style whiteboard — built end to end as a
        full-stack TypeScript project. It pairs a custom HTML5 Canvas rendering engine with a
        CRDT-backed offline layer and a small cloud backend, so a drawing stays fast on screen,
        survives going offline, and syncs to the cloud across devices.
      </Prose>
      <Prose>
        This reference documents the whole system — the stack, the rendering and interaction
        internals, how data is stored and synced, every user-facing feature, and the REST API —
        written so a reviewer can understand the design without reading the source.
      </Prose>
      <Callout tone="note">
        The diagrams throughout this page are real <InlineCode>mermaid</InlineCode> diagrams,
        rendered in the browser. The library is lazy-loaded only on this docs route, so the main
        canvas app’s bundle is unaffected.
      </Callout>
    </>
  );
}

// ── Section content: Problem & goals ──────────────────────────────────────────

function GoalsBody() {
  return (
    <>
      <Prose>
        Browser canvas apps tend to fail in predictable ways: they stutter once a few hundred
        objects are on screen, they lose work when the network drops, and re-implementing a
        diagramming surface from scratch is deceptively hard. Sketch sets out to address each
        of these directly.
      </Prose>
      <BulletList items={[
        { lead: 'Stay smooth at scale', text: 'an R-tree spatial index means only the objects inside the viewport are ever drawn or hit-tested, so frame cost tracks what you can see, not the document size.' },
        { lead: 'Never lose work', text: 'every edit is written to IndexedDB synchronously through a CRDT, so a refresh or an offline spell never costs you a stroke.' },
        { lead: 'Feel instant', text: 'all input flows through an in-memory store and is painted on the next animation frame — the network is never in the interaction path.' },
        { lead: 'Be shareable', text: 'any file can be published as a read-only or editable link that opens with no account required.' },
        { lead: 'Stay portable', text: 'URLs, database, and OAuth credentials are all environment-driven, so the same build runs on localhost or a serverless deployment.' },
      ]} />
    </>
  );
}

// ── Section content: Tech stack ──────────────────────────────────────────────

const STACK_GROUPS: { title: string; blurb: string; items: string[] }[] = [
  { title: 'Client', blurb: 'UI, state, and routing', items: ['React 18', 'TypeScript 5', 'Vite 6', 'Zustand 5', 'React Router 7', 'Framer Motion'] },
  { title: 'Canvas engine', blurb: 'Custom 2D rendering, from scratch', items: ['HTML5 Canvas 2D (layered)', 'requestAnimationFrame loop', 'rbush R-tree index'] },
  { title: 'Realtime & offline', blurb: 'Local-first persistence', items: ['Yjs (CRDT)', 'y-indexeddb'] },
  { title: 'Server', blurb: 'REST API and auth', items: ['Node.js', 'Fastify 4', 'jsonwebtoken (JWT)', 'Google OAuth 2.0'] },
  { title: 'Database', blurb: 'Managed Postgres', items: ['PostgreSQL (NeonDB)', 'pg (node-postgres)'] },
  { title: 'Tooling & libraries', blurb: 'Export, IDs, icons, docs', items: ['jsPDF', 'html2canvas', 'nanoid', 'react-icons', 'mermaid (docs only)'] },
];

function StackBody() {
  const mob = useIsMobile();
  return (
    <>
      <Prose>
        A conventional full-stack TypeScript setup: a React single-page app talks to a small
        Fastify REST API, backed by a real Postgres database for durable storage, with a CRDT
        layer providing instant local persistence. There is no heavyweight canvas framework —
        the rendering engine is hand-written against the raw Canvas 2D API.
      </Prose>
      <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(2, 1fr)', columnGap: 40, rowGap: 24, marginTop: 20 }}>
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

// ── Section content: Feature tour ─────────────────────────────────────────────

const FEATURES: BulletItem[] = [
  { lead: 'Infinite canvas', text: 'pan, smooth eased zoom (5%–800%), pinch-to-zoom, drag-inertia, and a live minimap.' },
  { lead: 'Nine element types', text: 'rectangles, ellipses, diamonds, text, images, freehand pen strokes, arrows/lines, frames, and groups.' },
  { lead: 'Full transform model', text: 'move, multi-select, rotation-aware resize, rotation with 15° snapping, and alignment snapping with guides.' },
  { lead: 'Mermaid → canvas', text: 'paste flowchart syntax and a Sugiyama-style layout converts it into real, editable native shapes.' },
  { lead: 'Frames', text: 'section containers that capture and move the objects inside them — useful for grouping regions of a board.' },
  { lead: 'Cloud + offline sync', text: 'instant IndexedDB persistence plus a debounced Postgres autosave; edits survive offline.' },
  { lead: 'Shareable links', text: 'publish a canvas read-only or open it for collaborative editing — visitors need no account.' },
  { lead: 'Export anywhere', text: 'one-click export to PNG, SVG, or PDF.' },
  { lead: 'Laser pointer', text: 'an ephemeral glowing trail for presenting, which fades after a few seconds and is never saved.' },
  { lead: 'Command palette', text: '⌘K fuzzy access to every tool and action.' },
  { lead: 'Undo / redo', text: 'a 200-entry command history covering every mutation.' },
  { lead: 'Adaptive theming', text: 'twelve canvas backgrounds and three grid styles; new elements auto-pick a legible ink color for the background behind them.' },
];

function FeaturesBody() {
  return (
    <>
      <Prose>A quick map of what the app can do. Each capability is expanded in the deep-dive sections below.</Prose>
      <BulletList items={FEATURES} />
    </>
  );
}

// ── Section content: High-level overview ──────────────────────────────────────

function ArchitectureBody() {
  return (
    <>
      <Prose>
        Sketch is split into three tiers: a React client that owns all rendering and interaction,
        a thin Fastify REST API, and a Postgres database. The client is the heavy part — it holds
        the full document in memory, renders it to Canvas, and persists it down two independent
        paths (local CRDT and cloud REST). The server does only auth, ownership checks, and
        snapshot storage.
      </Prose>
      <MermaidDiagram title="flowchart · system architecture" code={DIAG_ARCHITECTURE} />
      <BulletList items={[
        { lead: 'UI layer', text: <>React components — <InlineCode>Toolbar</InlineCode>, <InlineCode>PropertiesPanel</InlineCode>, <InlineCode>Canvas</InlineCode>, routed pages — render chrome and dispatch into the store.</> },
        { lead: 'State machine', text: 'a hand-written FSM translates raw pointer/keyboard events into high-level operations (draw, move, resize, rotate…).' },
        { lead: 'Store', text: <>a single Zustand store is the source of truth: an <InlineCode>{'objects: Record<id, CanvasObject>'}</InlineCode> map plus camera, selection, and tool state.</> },
        { lead: 'Engine', text: 'pure functions that draw the store to three stacked canvases and an rbush index that culls to the viewport.' },
        { lead: 'Server', text: 'Fastify routes guarded by a JWT pre-handler; only share endpoints are public.' },
      ]} />
    </>
  );
}

// ── Section content: Rendering engine ─────────────────────────────────────────

function RenderingBody() {
  return (
    <>
      <Prose>
        Rendering is a single <InlineCode>requestAnimationFrame</InlineCode> loop driving three
        stacked <InlineCode>&lt;canvas&gt;</InlineCode> layers — grid, objects, and selection
        overlay. The loop is dirty-flag driven: nothing repaints unless a
        <InlineCode>needsRender</InlineCode> flag is set or the camera is still easing toward its
        target, which keeps the app idle-quiet when nothing is changing.
      </Prose>
      <MermaidDiagram title="flowchart · the render loop" code={DIAG_RENDER_LOOP} />
      <SubHeading>How a frame is built</SubHeading>
      <BulletList items={[
        { lead: 'Three layers', text: 'the grid rarely changes, objects change on edit, and the selection/snap/laser overlay changes constantly — separating them avoids repainting everything at once.' },
        { lead: 'Camera easing', text: <>each frame, <InlineCode>tickCamera</InlineCode> moves the camera a fraction toward its target with an exponential <InlineCode>1 − e^(−k·dt)</InlineCode> lerp, giving frame-rate-independent smooth pan/zoom.</> },
        { lead: 'Viewport culling', text: 'the visible-world AABB is queried against the rbush index, so only on-screen objects are sorted by z-index and drawn.' },
        { lead: 'World → screen', text: <>every object maps through <InlineCode>(world − camera) × zoom</InlineCode>; rotation is applied as a canvas transform about the object’s centre.</> },
        { lead: 'Shape coverage', text: 'the engine hand-draws rounded rects, ellipses, diamonds, multi-line text, cropped images, quadratic-smoothed pen strokes, straight/curved arrows with arrow/dot heads, frames, and nested groups.' },
      ]} />
      <Callout tone="tip">
        Because input only ever mutates the in-memory store and the renderer picks it up on the
        next frame, drawing latency is bounded by one animation frame (~16 ms) and is completely
        decoupled from network or disk.
      </Callout>
    </>
  );
}

// ── Section content: State & data model ───────────────────────────────────────

const OBJECT_ROWS: React.ReactNode[][] = [
  ['rect', 'Rectangle', 'fill, stroke, strokeWidth, cornerRadius'],
  ['ellipse', 'Ellipse', 'fill, stroke, strokeWidth'],
  ['diamond', 'Diamond / decision', 'fill, stroke, strokeWidth'],
  ['text', 'Text', 'content, fontFamily, fontSize, fontWeight, color, align'],
  ['image', 'Bitmap image', 'src, crop rect, objectFit'],
  ['pen', 'Freehand stroke', 'points[], color, strokeWidth, strokeStyle'],
  ['arrow', 'Arrow / line', 'x1,y1,x2,y2, curved, bendOffset, start/endHead'],
  ['frame', 'Section frame', 'name, fill, stroke, strokeWidth'],
  ['group', 'Group', 'childIds[] (children stored in group-local space)'],
];

function StateBody() {
  return (
    <>
      <Prose>
        All document state lives in one Zustand store. Objects are kept as a flat
        <InlineCode>Record</InlineCode> keyed by id (not an array) so any object is reachable in
        O(1); ordering is derived from a numeric <InlineCode>zIndex</InlineCode> field. Every
        object shares a <InlineCode>BaseObject</InlineCode> shape — id, position, size, rotation,
        opacity, lock/visibility, layer, parent, z-index, timestamps — and then extends it per type.
      </Prose>
      <DataTable mono columns={['type', 'Element', 'Type-specific fields']} rows={OBJECT_ROWS} />
      <SubHeading>Notable store behaviours</SubHeading>
      <BulletList items={[
        { lead: 'Immutable updates', text: 'every mutation replaces the objects map by reference, which is exactly the signal subscribers (renderer, autosave, sync) watch.' },
        { lead: 'Z-order normalisation', text: 'step reorders renumber all top-level objects to sequential integers first, so bring-forward/send-backward stay correct regardless of gaps or ties.' },
        { lead: 'Groups', text: 'grouping rewrites children into group-local coordinates and selects the group; the renderer shifts the camera origin to draw them.' },
        { lead: 'Adaptive ink', text: 'changing the canvas background recomputes the default ink colour and swaps the active text/pen colour only if it still held the previous auto-pick — never a user’s explicit choice.' },
        { lead: 'Persisted preferences', text: 'background, grid style, and recent pen colours are mirrored to localStorage so they survive reloads.' },
      ]} />
    </>
  );
}

// ── Section content: Interaction model ────────────────────────────────────────

function InteractionBody() {
  return (
    <>
      <Prose>
        Pointer and keyboard input is funnelled into a single
        <InlineCode>InteractionStateMachine</InlineCode>. Rather than scattering drag logic across
        components, the machine holds one <InlineCode>mode</InlineCode> at a time and routes every
        pointer-move to the matching handler. The active tool plus what was under the cursor on
        pointer-down decides which mode you enter.
      </Prose>
      <MermaidDiagram title="stateDiagram · interaction modes" code={DIAG_INTERACTION} />
      <BulletList items={[
        { lead: 'Pan & inertia', text: 'space-drag, middle-mouse, or the pan tool; releasing a fast pan keeps gliding with decaying velocity.' },
        { lead: 'Move & snap', text: 'dragging computes alignment snaps against other objects and the grid, drawing red guide lines; arrows move all four of their coordinates together.' },
        { lead: 'Resize', text: 'rotation-aware — the world delta is projected onto the object’s local axes; text scales its font size instead of stretching its box.' },
        { lead: 'Rotate', text: 'a dedicated handle above the selection; holding Shift snaps to 15° steps with a live angle badge.' },
        { lead: 'Eraser', text: 'an object eraser that also splits freehand strokes — erasing the middle of a stroke yields two surviving sub-strokes.' },
        { lead: 'Text editing', text: 'double-click enters an inline textarea overlay kept pixel-aligned with the world as you pan/zoom.' },
      ]} />
      <Callout tone="tip">
        Centralising interaction in one machine means a new gesture is added in exactly one place,
        and every mutation it produces is wrapped as an undoable command on commit.
      </Callout>
    </>
  );
}

// ── Section content: Spatial index ────────────────────────────────────────────

function SpatialBody() {
  return (
    <>
      <Prose>
        Both rendering and hit-testing need fast “what’s in this region?” queries. Sketch keeps an
        <InlineCode>rbush</InlineCode> R-tree of every top-level object’s bounding box alongside the
        store. The tree is rebuilt when a document loads and incrementally updated (remove + insert)
        as objects move, resize, or are created.
      </Prose>
      <BulletList items={[
        { lead: 'Viewport culling', text: 'the render loop queries the visible-world rectangle and only draws what comes back, so a 5,000-object board costs the same per frame as a 50-object one when zoomed in.' },
        { lead: 'Marquee selection', text: 'the rubber-band rectangle is resolved by a single tree search rather than scanning every object.' },
        { lead: 'Group-aware', text: 'only top-level objects are indexed; group children are reached through their parent, so the index never returns something the user can’t directly click.' },
        { lead: 'Hit-testing', text: 'top-most-first iteration over candidate objects, with precise per-shape tests (including arrow line/curve distance and rotated bounding boxes).' },
      ]} />
    </>
  );
}

// ── Section content: Undo / redo ──────────────────────────────────────────────

function HistoryBody() {
  return (
    <>
      <Prose>
        Undo/redo uses a classic command pattern. A singleton
        <InlineCode>historyManager</InlineCode> holds a past stack and a future stack of commands,
        each exposing <InlineCode>execute()</InlineCode> and <InlineCode>undo()</InlineCode>. The
        history is capped at 200 entries.
      </Prose>
      <BulletList items={[
        { lead: 'Two entry points', text: <><InlineCode>execute()</InlineCode> runs a command and records it, while <InlineCode>push()</InlineCode> records an already-applied change — used after a live drag so the on-screen object isn’t mutated twice.</> },
        { lead: 'Captured deltas', text: 'move/resize/rotate commands store before-and-after coordinates; erase commands snapshot the original and any split sub-strokes.' },
        { lead: 'Future invalidation', text: 'a new action clears the redo stack, matching standard editor behaviour.' },
        { lead: 'Index sync', text: 'every command keeps the rbush index in step with the store on both execute and undo.' },
      ]} />
    </>
  );
}

// ── Section content: Persistence model ────────────────────────────────────────

function PersistenceBody() {
  return (
    <>
      <Prose>
        Edits are persisted down two independent paths from the same store. The
        <strong style={{ color: '#09090B' }}> local path</strong> is synchronous and offline-first;
        the <strong style={{ color: '#09090B' }}>cloud path</strong> is a debounced REST autosave.
        Neither sits in the interaction loop, so saving never blocks drawing.
      </Prose>
      <MermaidDiagram title="flowchart · two save paths, one store" code={DIAG_PERSISTENCE} />
      <SubHeading>Local path — Yjs + IndexedDB</SubHeading>
      <BulletList items={[
        { lead: 'CRDT mirror', text: 'a store subscription diffs the objects map and writes only changed keys into a Yjs map, which y-indexeddb flushes to IndexedDB.' },
        { lead: 'Loop guard', text: 'local writes are tagged with a private transaction origin so the Yjs→store observer ignores them, preventing an echo loop.' },
        { lead: 'Instant load', text: 'opening a file resolves from IndexedDB first, so a board appears immediately and works with no network.' },
      ]} />
      <SubHeading>Cloud path — Fastify + Postgres</SubHeading>
      <BulletList items={[
        { lead: 'Debounced autosave', text: 'changes schedule a save ~5 s later (coalescing bursts); navigating away forces a final flush so nothing is lost to the debounce window.' },
        { lead: 'Snapshot, not log', text: 'the whole canvas is stored as one JSONB snapshot per file, overwritten each save — simple and cheap, with no server-side history to reconcile.' },
        { lead: 'Blob-safe', text: 'transient image blob URLs are stripped before upload so snapshots stay portable across sessions.' },
      ]} />
    </>
  );
}

// ── Section content: Database schema ──────────────────────────────────────────

function SchemaBody() {
  return (
    <>
      <Prose>
        Four tables on Postgres. Users own workspaces, workspaces contain files, and each file has
        exactly one canvas snapshot. Cascading deletes keep the tree consistent — removing a
        workspace removes its files and their snapshots.
      </Prose>
      <MermaidDiagram title="erDiagram · database schema" code={DIAG_SCHEMA} />
      <BulletList items={[
        { lead: 'users', text: 'identified by the Google subject id; upserted on every sign-in.' },
        { lead: 'workspaces', text: 'named, emoji- and colour-tagged folders scoped to a user.' },
        { lead: 'files', text: <>a canvas document, plus an optional unguessable <InlineCode>share_token</InlineCode> and a <InlineCode>share_mode</InlineCode> of <InlineCode>view</InlineCode> or <InlineCode>edit</InlineCode> (a partial unique index enforces token uniqueness).</> },
        { lead: 'canvas_snapshots', text: <>one row per file: the <InlineCode>objects</InlineCode> JSONB blob plus background colour and grid style.</> },
      ]} />
    </>
  );
}

// ── Section content: Authentication ───────────────────────────────────────────

function AuthBody() {
  return (
    <>
      <Prose>
        Authentication is a server-side Google OAuth 2.0 redirect flow that ends with the API
        minting its own JWT. The client never sees Google tokens — it receives a signed 30-day
        session JWT and attaches it as a bearer token on every API call.
      </Prose>
      <MermaidDiagram title="sequenceDiagram · Google OAuth → JWT" code={DIAG_AUTH} />
      <BulletList items={[
        { lead: 'Server-held secrets', text: 'the OAuth client secret and code-for-token exchange stay on the server; the browser only ever handles the final app JWT.' },
        { lead: 'Stateless sessions', text: <>a Fastify <InlineCode>preHandler</InlineCode> verifies the bearer JWT on every <InlineCode>/api/*</InlineCode> route except public share links — no server session store.</> },
        { lead: 'Graceful expiry', text: 'a 401 from any call signs the user out client-side and redirects to the landing page.' },
        { lead: 'Environment-driven URLs', text: 'callback and frontend URLs are inferred from env vars or the request origin, so the same code runs locally and in production.' },
      ]} />
    </>
  );
}

// ── Section content: Sharing ──────────────────────────────────────────────────

function SharingBody() {
  return (
    <>
      <Prose>
        Any file can be published as a link. The owner picks a mode — view or edit — and the server
        attaches an unguessable token to the file. Anyone with the link opens the canvas through
        public, unauthenticated endpoints; edit-mode links may also save back.
      </Prose>
      <MermaidDiagram title="sequenceDiagram · share link lifecycle" code={DIAG_SHARING} />
      <BulletList items={[
        { lead: 'View mode', text: 'the shared canvas renders read-only — the interaction machine routes every drag to panning and disables editing and the context menu.' },
        { lead: 'Edit mode', text: 'visitors can modify the board and their changes persist through the public save endpoint, which the server rejects unless the mode is still edit.' },
        { lead: 'Revocable', text: 'clearing the token instantly invalidates the link without touching the underlying file.' },
      ]} />
    </>
  );
}

// ── Section content: Tools & elements ─────────────────────────────────────────

const TOOL_ROWS: React.ReactNode[][] = [
  ['Select', 'V / 1', 'Move, multi-select, resize, rotate'],
  ['Pan', 'H / 2', 'Drag the canvas (or hold Space)'],
  ['Rectangle', 'R', 'Draw a rectangle (rounded corners supported)'],
  ['Ellipse', 'O', 'Draw an ellipse'],
  ['Diamond', 'D', 'Draw a diamond / decision node'],
  ['Frame', 'F', 'Draw a section container'],
  ['Text', 'T / 4', 'Click to place an inline text box'],
  ['Image', '5', 'Place an image (or drag-drop / paste one)'],
  ['Pen', 'P / 6', 'Freehand stroke, solid/dashed/dotted'],
  ['Arrow / Line', 'A', 'Connector with optional heads, straight or curved'],
  ['Eraser', '7', 'Erase objects; splits pen strokes'],
  ['Laser', '8', 'Ephemeral glowing presenter trail'],
];

function ToolsBody() {
  return (
    <>
      <Prose>
        The toolbar exposes twelve tools. Shapes drag out from a start point, text places an inline
        editor, the pen captures smoothed freehand input, and arrows attach heads you can later
        restyle. Selecting a tool is one keystroke; finishing a draw returns you to Select.
      </Prose>
      <DataTable columns={['Tool', 'Shortcut', 'What it does']} rows={TOOL_ROWS} />
      <SubHeading>Editing affordances</SubHeading>
      <BulletList items={[
        { lead: 'Properties panel', text: 'context-aware fill, stroke, width, corner radius, opacity, font, and arrowhead controls for the current selection.' },
        { lead: 'Z-order & grouping', text: 'bring-forward/back and to-front/back, group/ungroup, plus lock and hide.' },
        { lead: 'Frames as containers', text: 'dragging a frame carries every object whose centre sits inside it, so you can move a whole region at once.' },
        { lead: 'Clipboard', text: 'copy/cut/paste and duplicate, including pasting images from the system clipboard or dropping files onto the canvas.' },
      ]} />
    </>
  );
}

// ── Section content: Canvas navigation ────────────────────────────────────────

function NavigationBody() {
  return (
    <>
      <Prose>
        The camera is a smoothed object with separate current and target positions; navigation sets
        the target and the render loop eases toward it. Zoom ranges from 5% to 800% and always
        zooms toward the cursor or pinch midpoint.
      </Prose>
      <BulletList items={[
        { lead: 'Scroll & pinch', text: 'plain wheel/trackpad scrolls pan; Ctrl/⌘-wheel and two-finger pinch zoom toward the pointer.' },
        { lead: 'Zoom controls', text: 'on-screen +/− and percentage, keyboard zoom in/out, reset to 100%, and zoom-to-fit all content.' },
        { lead: 'Minimap', text: 'a live overview of the whole board with a draggable viewport indicator.' },
        { lead: 'Inertia', text: 'a flung pan keeps gliding and decelerates naturally.' },
      ]} />
    </>
  );
}

// ── Section content: Mermaid → canvas ─────────────────────────────────────────

function MermaidFeatureBody() {
  return (
    <>
      <Prose>
        Sketch ships its own Mermaid flowchart importer — paste diagram syntax and it becomes real,
        editable canvas objects rather than an embedded image. The parser and layout engine are
        hand-written (no Mermaid runtime in the app bundle), supporting
        <InlineCode>flowchart</InlineCode>/<InlineCode>graph</InlineCode> in all four directions, the
        common node shapes, and labelled edges.
      </Prose>
      <MermaidDiagram title="flowchart · the conversion pipeline" code={DIAG_MERMAID} />
      <BulletList items={[
        { lead: 'Parse', text: 'a tokenizer respects bracket/quote nesting to split each statement into nodes and connectors, registering shapes and edge labels.' },
        { lead: 'Rank', text: 'a Kahn topological sort followed by longest-path ranking assigns nodes to layers.' },
        { lead: 'Order', text: 'eight up/down barycenter passes reduce edge crossings within each layer.' },
        { lead: 'Place & build', text: 'nodes get coordinates, edges become arrows that meet shape borders cleanly, and labels render as chips that mask the line beneath them.' },
        { lead: 'Native output', text: 'the result is ordinary rectangles, diamonds, ellipses, text, and arrows — selectable, movable, and restyleable like anything else.' },
      ]} />
      <Callout tone="note">
        The diagrams on this docs page use the real <InlineCode>mermaid</InlineCode> library; the
        in-app importer is a separate, purpose-built parser that targets the canvas object model.
      </Callout>
    </>
  );
}

// ── Section content: Export ───────────────────────────────────────────────────

function ExportBody() {
  return (
    <>
      <Prose>
        A board can be exported in three formats, all rendered client-side from the same object
        model. Exports render onto an off-screen surface that fills the canvas background and omits
        the grid and selection chrome.
      </Prose>
      <BulletList items={[
        { lead: 'PNG', text: 'a rasterised bitmap of the content at an export scale, with the canvas background baked in.' },
        { lead: 'SVG', text: 'vector output built directly from the objects, so shapes and text stay crisp at any size.' },
        { lead: 'PDF', text: 'a single-page document sized to the content, generated with jsPDF.' },
      ]} />
    </>
  );
}

// ── Section content: Keyboard shortcuts ───────────────────────────────────────

const SHORTCUT_GROUPS: { title: string; rows: [string, string][] }[] = [
  { title: 'Editing', rows: [
    ['Undo', 'Ctrl/⌘ + Z'], ['Redo', 'Ctrl/⌘ + Shift + Z  ·  Ctrl + Y'],
    ['Copy / Cut / Paste', 'Ctrl/⌘ + C / X / V'], ['Duplicate', 'Ctrl/⌘ + D'],
    ['Delete', 'Delete  ·  Backspace'], ['Select all', 'Ctrl/⌘ + A'], ['Deselect', 'Escape'],
    ['Nudge', 'Arrow keys (Shift = 10px)'],
  ]},
  { title: 'Arrange', rows: [
    ['Group / Ungroup', 'Ctrl/⌘ + G  /  Ctrl/⌘ + Shift + G'],
    ['Lock', 'Ctrl/⌘ + L'],
    ['Forward / Backward', 'Ctrl/⌘ + ]  /  ['],
    ['To front / To back', 'Ctrl/⌘ + Shift + ]  /  ['],
  ]},
  { title: 'Tools', rows: [
    ['Select / Pan', 'V / H'], ['Rect / Ellipse / Diamond', 'R / O / D'],
    ['Text / Pen / Arrow / Frame', 'T / P / A / F'], ['Number row', '1–8 (left-to-right)'],
  ]},
  { title: 'View', rows: [
    ['Zoom in / out', 'Ctrl/⌘ + =  /  −'], ['Reset zoom', 'Ctrl/⌘ + 0'],
    ['Zoom to fit', 'Shift + 1'], ['Pan', 'Hold Space + drag'],
  ]},
];

function ShortcutsBody() {
  const mob = useIsMobile();
  return (
    <>
      <Prose>Sketch is keyboard-first. Shortcuts are ignored while typing in an input or text editor.</Prose>
      <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(2, 1fr)', gap: 18, marginTop: 20 }}>
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#52525B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{g.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {g.rows.map(([label, keys]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13.5, color: '#52525B' }}>{label}</span>
                  <kbd style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, color: '#3F3F46',
                    background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: 5, padding: '2px 7px',
                    whiteSpace: 'nowrap', textAlign: 'right',
                  }}>{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Section content: API endpoints ────────────────────────────────────────────

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
      display: 'inline-block', minWidth: 50, textAlign: 'center', padding: '3px 8px', borderRadius: 5,
      background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', fontFamily: 'ui-monospace, monospace',
    }}>{method}</span>
  );
}

const API_GROUPS: { title: string; routes: { method: string; path: string; detail: string }[] }[] = [
  { title: 'Auth (public)', routes: [
    { method: 'GET', path: '/auth/google', detail: 'Start the Google OAuth 2.0 flow' },
    { method: 'GET', path: '/auth/google/callback', detail: 'OAuth redirect target — issues a JWT' },
  ]},
  { title: 'Workspaces', routes: [
    { method: 'GET', path: '/api/workspaces', detail: 'List the signed-in user’s workspaces' },
    { method: 'POST', path: '/api/workspaces', detail: 'Create (or upsert) a workspace' },
    { method: 'PUT', path: '/api/workspaces/:id', detail: 'Rename / restyle a workspace' },
    { method: 'DELETE', path: '/api/workspaces/:id', detail: 'Delete a workspace (cascades)' },
  ]},
  { title: 'Files', routes: [
    { method: 'GET', path: '/api/workspaces/:wsId/files', detail: 'List files inside a workspace' },
    { method: 'POST', path: '/api/files', detail: 'Create (or upsert) a file' },
    { method: 'PUT', path: '/api/files/:id', detail: 'Rename a file' },
    { method: 'DELETE', path: '/api/files/:id', detail: 'Delete a file (cascades snapshot)' },
  ]},
  { title: 'Canvas snapshots', routes: [
    { method: 'GET', path: '/api/files/:id/canvas', detail: 'Load saved objects, background & grid' },
    { method: 'PUT', path: '/api/files/:id/canvas', detail: 'Persist the current canvas snapshot' },
  ]},
  { title: 'Sharing (owner)', routes: [
    { method: 'GET', path: '/api/files/:id/share', detail: 'Read current share state' },
    { method: 'POST', path: '/api/files/:id/share', detail: 'Enable sharing in view or edit mode' },
    { method: 'DELETE', path: '/api/files/:id/share', detail: 'Revoke a share link' },
  ]},
  { title: 'Sharing (public · no auth)', routes: [
    { method: 'GET', path: '/api/share/:token', detail: 'Open a shared canvas by token' },
    { method: 'PUT', path: '/api/share/:token/canvas', detail: 'Save edits (edit-mode links only)' },
  ]},
  { title: 'Health', routes: [
    { method: 'GET', path: '/health', detail: 'Liveness probe — returns { ok: true }' },
  ]},
];

function ApiBody() {
  return (
    <>
      <Prose>
        A small Fastify REST API fronts everything. All <InlineCode>/api/*</InlineCode> routes require
        a bearer JWT, enforced by a single pre-handler — the only exceptions are the public
        <InlineCode>/api/share/*</InlineCode> endpoints, which anyone with the link can reach.
        Mutations are idempotent upserts, so the offline-first client can safely replay them.
      </Prose>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20, maxWidth: 680 }}>
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
                  <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12.5, color: '#18181B', fontWeight: 600 }}>{r.path}</code>
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

// ── Section content: Design decisions ─────────────────────────────────────────

function DecisionsBody() {
  return (
    <>
      <Prose>A few choices that shaped the project, and the reasoning behind them.</Prose>
      <BulletList items={[
        { lead: 'Hand-written canvas engine', text: 'a custom Canvas 2D renderer gives full control over the frame budget, layering, and culling — and avoids tying the project to a third-party scene graph.' },
        { lead: 'Single Zustand store', text: 'one source of truth keeps the renderer, autosave, and sync as simple subscribers; reference-equality on the objects map is the only change signal needed.' },
        { lead: 'CRDT for local, REST for cloud', text: 'Yjs makes offline edits and instant load trivial, while a plain JSONB snapshot over REST keeps the server stateless and easy to reason about.' },
        { lead: 'State machine for input', text: 'modelling interaction as explicit modes keeps gesture logic in one testable place instead of spread across event handlers.' },
        { lead: 'No diagram library in the app', text: 'the Mermaid importer is hand-rolled so the canvas bundle stays lean; the heavyweight mermaid renderer appears only here in the docs, lazy-loaded.' },
      ]} />
    </>
  );
}

// ── Section registry ─────────────────────────────────────────────────────────

const SECTION_META: Record<SectionId, { title: string; Body: React.ComponentType }> = {
  intro:          { title: 'Introduction',        Body: IntroductionBody },
  goals:          { title: 'Problem & goals',     Body: GoalsBody },
  stack:          { title: 'Tech stack',          Body: StackBody },
  features:       { title: 'Feature tour',        Body: FeaturesBody },
  architecture:   { title: 'High-level overview', Body: ArchitectureBody },
  rendering:      { title: 'Rendering engine',    Body: RenderingBody },
  state:          { title: 'State & data model',  Body: StateBody },
  interaction:    { title: 'Interaction model',   Body: InteractionBody },
  spatial:        { title: 'Spatial index',       Body: SpatialBody },
  history:        { title: 'Undo / redo',         Body: HistoryBody },
  persistence:    { title: 'Persistence model',   Body: PersistenceBody },
  schema:         { title: 'Database schema',     Body: SchemaBody },
  auth:           { title: 'Authentication',      Body: AuthBody },
  sharing:        { title: 'Sharing',             Body: SharingBody },
  tools:          { title: 'Tools & elements',    Body: ToolsBody },
  navigation:     { title: 'Canvas navigation',   Body: NavigationBody },
  mermaidfeature: { title: 'Mermaid → canvas',    Body: MermaidFeatureBody },
  export:         { title: 'Export',              Body: ExportBody },
  shortcuts:      { title: 'Keyboard shortcuts',  Body: ShortcutsBody },
  api:            { title: 'REST endpoints',      Body: ApiBody },
  decisions:      { title: 'Design decisions',    Body: DecisionsBody },
};

// ── Sidebar (desktop) ──────────────────────────────────────────────────────────

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
    <nav style={{ width: 248, flexShrink: 0, borderRight: '1px solid #F0F0F0', overflowY: 'auto', padding: '24px 14px' }}>
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label} style={{ marginBottom: 14 }}>
            <button
              onClick={() => onToggleGroup(group.label)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1AA',
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
                          padding: '6px 12px', margin: '1px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
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

// ── Mobile nav (sticky horizontal strip) ────────────────────────────────────────

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
              background: isActive ? '#18181B' : '#fff', color: isActive ? '#fff' : '#52525B',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s, color 0.12s',
            }}
          >{item.label}</button>
        );
      })}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

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
          <div style={{ flex: 1, maxWidth: 820, width: '100%', margin: '0 auto', padding: mob ? '32px 20px 100px' : '44px 56px 140px', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: mob ? 28 : 34, fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 10px' }}>
              Sketch documentation
            </h1>
            <Prose>
              A complete reference to the architecture, engineering decisions, data flow, and
              feature set of Sketch — written so anyone can understand the system without reading
              the source.
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
                  {i > 0 && <hr style={{ border: 'none', borderTop: '1px solid #F0F0F0', margin: '44px 0' }} />}
                  <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.015em', color: '#09090B', margin: i === 0 ? '40px 0 0' : 0 }}>
                    {title}
                  </h2>
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
