# Sketch — Infinite Canvas Application

A full-stack infinite-canvas diagramming and sketching tool built from scratch to explore the engineering behind modern design tools like Figma, Excalidraw, and Eraser.io.

> **Built for learning** · Exploring the engineering behind modern canvas tools

---

## Features

- **Infinite Canvas** — Pan and zoom freely across an unbounded workspace
- **Shape Tools** — Rectangle, Ellipse, Diamond, Line, Arrow with resize and rotate handles
- **Freehand Drawing** — Pen tool with colour, width, and stroke-style (solid / dashed / dotted)
- **Text & Image** — Place text labels and import images from your local machine
- **Eraser** — Pixel-wise erasure for pen strokes; whole-object removal for other shapes
- **Laser Pointer** — Glowing red annotation that disappears after 3 seconds
- **Mermaid Diagrams** — Paste Mermaid flowchart syntax and it becomes fully editable canvas elements
- **Undo / Redo** — Full command-history stack
- **Layer Controls** — Bring to Front / Forward / Backward / Back, Group / Ungroup, Lock
- **Canvas Backgrounds** — Dot grid, square grid, or plain — with custom colour themes
- **Right-click Context Menu** — Layer ordering, lock, duplicate, and delete from any element
- **Workspaces & Files** — Organise canvases into named workspaces
- **Google OAuth** — Sign in with Google; sessions last 30 days
- **Cloud Persistence** — Canvas snapshots autosaved to NeonDB (PostgreSQL)
- **Offline Support** — Yjs + IndexedDB keeps your work available without internet
- **Keyboard Shortcuts** — Every tool and action has a single-key shortcut

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Rendering | HTML5 Canvas 2D (custom 3-layer engine) |
| State | Zustand 5 |
| Routing | React Router v6 |
| Animation | Framer Motion |
| Spatial index | rbush R-tree (viewport culling & hit-testing) |
| Local persistence | Yjs CRDT + y-indexeddb |
| Icons | react-icons (Tabler set) |
| Backend | Fastify (Node.js) |
| Database | NeonDB — PostgreSQL via `pg` |
| Auth | Google OAuth 2.0 + JWT (jsonwebtoken) |

---

## Prerequisites

- **Node.js** ≥ 18 (built-in `fetch` required by the server)
- **npm** ≥ 9
- A **NeonDB** account (free tier works) — [neon.tech](https://neon.tech)
- A **Google Cloud** project with OAuth 2.0 credentials

---

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd sketch
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

### 3. Configure environment variables

Copy the example below into a `.env` file at the project root:

```env
# ── Google OAuth ──────────────────────────────────────────────────────────────
# 1. Go to https://console.cloud.google.com/apis/credentials
# 2. Create a project → OAuth consent screen → External
# 3. Credentials → Create OAuth client ID → Web application
# 4. Add Authorized redirect URI: http://localhost:3001/auth/google/callback
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# ── App URLs ──────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001

# ── JWT ───────────────────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=change_this_to_a_random_secret

# ── NeonDB ────────────────────────────────────────────────────────────────────
# Copy the connection string from your NeonDB project dashboard
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### 4. Push the database schema

This creates all required tables in your NeonDB database (safe to re-run):

```bash
npm run db:push
```

### 5. Start the development servers

Open **two terminals** and run each command in its own terminal:

```bash
# Terminal 1 — Vite frontend (http://localhost:5173)
npm run dev

# Terminal 2 — Fastify API server (http://localhost:3001)
npm run server:dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser and sign in with Google.

---

## Google OAuth Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create or select a project
3. Navigate to **APIs & Services → OAuth consent screen** → set to **External** → fill in app name and email
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID** → select **Web application**
5. Under **Authorized redirect URIs** add: `http://localhost:3001/auth/google/callback`
6. Copy the **Client ID** and **Client secret** into your `.env`

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite frontend dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run server:dev` | Start Fastify API server with `--watch` (auto-restarts) |
| `npm run server` | Start Fastify API server (production) |
| `npm run db:push` | Push `server/schema.sql` to NeonDB |

---

## Project Structure

```
sketch/
├── public/
│   └── favicon.svg             # Stylus favicon
├── server/
│   ├── api.js                  # Fastify REST API + Google OAuth
│   ├── db.js                   # pg connection pool
│   ├── db-push.js              # Schema migration script
│   └── schema.sql              # PostgreSQL table definitions
├── src/
│   ├── collaboration/
│   │   └── yDocument.ts        # Yjs + IndexedDB offline persistence
│   ├── components/
│   │   ├── Canvas.tsx          # Main canvas component (RAF loop)
│   │   ├── Toolbar.tsx         # Top toolbar with all tools
│   │   ├── PropertiesPanel.tsx # Right-side element properties
│   │   ├── BgPicker.tsx        # Canvas background picker
│   │   ├── MermaidModal.tsx    # Mermaid diagram import modal
│   │   ├── ContextMenu.tsx     # Right-click context menu
│   │   ├── LandingPage.tsx     # Marketing landing page
│   │   ├── WorkspacesPage.tsx  # Workspace list
│   │   ├── FilesPage.tsx       # File list within a workspace
│   │   └── UserMenu.tsx        # User avatar + sign-out dropdown
│   ├── engine/
│   │   ├── renderer.ts         # Canvas 2D draw functions
│   │   ├── hitTest.ts          # Pointer → object hit testing
│   │   ├── camera.ts           # Zoom / pan / inertia
│   │   ├── spatialIndex.ts     # rbush R-tree wrapper
│   │   └── snapping.ts         # Snap-to-grid / snap-to-object
│   ├── history/
│   │   ├── historyManager.ts   # Undo / redo stack
│   │   └── commands.ts         # Add / remove object commands
│   ├── interaction/
│   │   ├── stateMachine.ts     # Pointer interaction state machine
│   │   └── shortcuts.ts        # Keyboard shortcut registry
│   ├── lib/
│   │   ├── api.ts              # Frontend API client (fetch wrapper)
│   │   └── mermaid.ts          # Mermaid parser + layout engine
│   ├── store/
│   │   ├── canvasStore.ts      # Canvas objects, tools, settings
│   │   ├── workspaceStore.ts   # Workspaces and files
│   │   ├── authStore.ts        # Auth state + localStorage
│   │   └── documentStore.ts    # Save status
│   ├── types/
│   │   └── index.ts            # All TypeScript types and interfaces
│   ├── utils/
│   │   ├── math.ts             # Vector math, bbox, arrow helpers
│   │   └── clipboard.ts        # Copy/paste and image import
│   └── App.tsx                 # Route definitions
├── .env                        # Environment variables (not committed)
├── index.html
├── vite.config.ts
└── package.json
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Pan tool |
| `R` | Rectangle |
| `O` | Ellipse |
| `D` | Diamond |
| `A` | Arrow |
| `P` | Pen / freehand |
| `T` | Text |
| `E` | Eraser |
| `L` | Laser pointer |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selection |
| `Ctrl+G` | Group |
| `Ctrl+Shift+G` | Ungroup |
| `Ctrl+L` | Lock / Unlock |
| `Ctrl+]` | Bring Forward |
| `Ctrl+[` | Send Backward |
| `Ctrl+Shift+]` | Bring to Front |
| `Ctrl+Shift+[` | Send to Back |
| `Ctrl+A` | Select all |
| `Delete / Backspace` | Delete selection |
| `Escape` | Clear selection |
| `Ctrl+Scroll` | Zoom in / out |
| `Space + Drag` | Pan canvas |

---

## Architecture Notes

### Rendering Engine
Three stacked `<canvas>` elements handle the grid, objects, and selection overlay independently. A `requestAnimationFrame` loop with a dirty-flag (`needsRenderRef`) redraws only when state changes, keeping performance smooth even with many elements.

### Spatial Indexing
An [rbush](https://github.com/mourner/rbush) R-tree indexes all object bounding boxes. Hit-testing and viewport culling are O(log n) regardless of canvas size, making the app responsive even with thousands of objects.

### State Machine
Pointer interactions are managed by `InteractionStateMachine` — a class that transitions between modes (`idle`, `moving`, `resizing`, `rotating`, `drawing`, `drawing-pen`, `drawing-arrow`, `erasing`, `selecting`) and handles all edge cases (StrictMode double-invocation, touch input, locked objects, etc.).

### Mermaid Layout
The Mermaid parser implements a Sugiyama-style layered layout: topological sort → longest-path ranking → barycenter ordering with overlap resolution → direction transforms. Output is native canvas objects (no image export).

### Auth Flow
```
User → /auth/google (server) → Google consent screen
     → /auth/google/callback (server) → exchange code → user info
     → issue 30-day JWT → redirect to /auth/callback (frontend)
     → store in localStorage → navigate to /workspaces
```

---

## License

Built for educational purposes. All rights reserved.
