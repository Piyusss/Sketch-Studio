import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { BgPicker } from './components/BgPicker';
import { ThemeToggle } from './components/ThemeToggle';
import { ZoomControls } from './components/ZoomControls';
import { Minimap } from './components/Minimap';
import { CommandPalette } from './components/CommandPalette';
import { LandingPage } from './components/LandingPage';
import { DocsPage } from './components/DocsPage';
import { WorkspacesPage } from './components/WorkspacesPage';
import { FilesPage } from './components/FilesPage';
import { ShareExportBar } from './components/ShareExportBar';
import { SharedCanvasPage } from './components/SharedCanvasPage';
import { useWorkspaceStore } from './store/workspaceStore';
import { useCanvasStore } from './store/canvasStore';
import type { CanvasGridStyle } from './types';
import { openYDocument, closeYDocument } from './collaboration/yDocument';
import { api } from './lib/api';
import { stripBlobUrls } from './utils/stripBlobUrls';
import type { CanvasObject } from './types';

// ── Shared loading spinner ─────────────────────────────────────────────────

function AppLoader() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8FAFF',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
        animation: 'pulse 1.2s ease-in-out infinite',
      }} />
    </div>
  );
}

// ── Auth guard ─────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token, isLoaded } = useAuthStore();
  const location = useLocation();

  if (!isLoaded) return <AppLoader />;
  if (!user || !token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// ── Page transition wrapper ────────────────────────────────────────────────

const pageFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

// ── Landing route ──────────────────────────────────────────────────────────

function LandingRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { initForUser } = useWorkspaceStore();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/workspaces';

  function handleSignedIn() {
    const { user } = useAuthStore.getState();
    if (user) initForUser(user.id);
    navigate(from, { replace: true });
  }

  return (
    <motion.div key="landing" {...pageFade}>
      <LandingPage
        onSignedIn={handleSignedIn}
        onGoToApp={() => navigate('/workspaces')}
      />
    </motion.div>
  );
}

// ── Workspaces route ───────────────────────────────────────────────────────

function WorkspacesRoute() {
  const navigate = useNavigate();
  const { setActiveWorkspace } = useWorkspaceStore();

  return (
    <motion.div key="workspaces" {...pageFade}>
      <WorkspacesPage
        onOpen={(id) => { setActiveWorkspace(id); navigate(`/workspaces/${id}`); }}
        onHome={() => navigate('/')}
      />
    </motion.div>
  );
}

// ── Files route ────────────────────────────────────────────────────────────

function FilesRoute() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const userId = useWorkspaceStore((s) => s.userId);
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Wait for initial data load before deciding "not found"
  if (!userId || (isLoading && !workspace)) return <AppLoader />;
  if (!workspace) return <Navigate to="/workspaces" replace />;

  return (
    <motion.div key="files" {...pageFade}>
      <FilesPage
        workspace={workspace}
        onBack={() => navigate('/workspaces')}
        onOpenFile={(fileId) => navigate(`/workspaces/${workspaceId}/files/${fileId}`)}
      />
    </motion.div>
  );
}

// ── Editor back button ─────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Back to files"
      style={{
        position: 'absolute', top: 14, left: 14, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--panel-translucent)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-bg)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-translucent)'; }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  );
}

// ── Editor route ───────────────────────────────────────────────────────────

function EditorRoute() {
  const { workspaceId, fileId } = useParams<{ workspaceId: string; fileId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { initForUser, setActiveWorkspace, openFile, closeFile } = useWorkspaceStore();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!user?.id || !workspaceId || !fileId) return;

    // `cancelled` guards against StrictMode double-invocation and async races.
    // Cleanup (below) sets it to true; any pending async step bails out.
    let cancelled = false;

    (async () => {
      try {
        // Load workspace + file list (idempotent; serves from cache immediately)
        await initForUser(user.id);
        if (cancelled) return;

        // Validate the file actually belongs to this user
        const { files } = useWorkspaceStore.getState();
        if (!files.some((f) => f.id === fileId)) {
          if (!cancelled) setStatus('error');
          return;
        }

        // Load the saved canvas snapshot from the cloud
        try {
          const snapshot = await api.canvas.load(fileId);
          if (!cancelled) {
            useCanvasStore.getState().loadObjects(snapshot.objects as Record<string, CanvasObject>);
            if (snapshot.bg_color)   useCanvasStore.getState().setCanvasBg(snapshot.bg_color);
            if (snapshot.grid_style) useCanvasStore.getState().setCanvasGrid(snapshot.grid_style as CanvasGridStyle);
          }
        } catch {
          if (!cancelled) useCanvasStore.getState().loadObjects({});
        }

        if (cancelled) return;

        // Open the Yjs document for local offline persistence
        await openYDocument(fileId);

        if (cancelled) {
          // We opened it but then got cancelled — close cleanly
          closeYDocument().catch(() => {});
          return;
        }

        setActiveWorkspace(workspaceId);
        openFile(fileId);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    // Cleanup: runs on unmount OR when deps change (StrictMode fake-unmount included)
    return () => {
      cancelled = true;
      // ── Persist canvas state BEFORE clearing activeFileId ──────────────────
      // Canvas.tsx's own autosave reads activeFileId at cleanup time. If closeFile()
      // ran first (activeFileId → null), that save silently no-ops.  We do an
      // explicit fire-and-forget save here so bg_color / grid_style / objects are
      // always flushed regardless of debounce timing.
      const fid = useWorkspaceStore.getState().activeFileId;
      if (fid) {
        const s = useCanvasStore.getState();
        api.canvas.save(fid, {
          objects:    stripBlobUrls(s.objects),
          bg_color:   s.canvasBg,
          grid_style: s.canvasGrid,
        }).catch(() => {});
      }
      closeYDocument().catch(() => {});
      closeFile();
    };
  }, [user?.id, workspaceId, fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <AppLoader />;
  if (status === 'error') return <Navigate to={`/workspaces/${workspaceId ?? ''}`} replace />;

  async function handleBack() {
    try { await closeYDocument(); } catch { /* always navigate */ }
    // Do NOT call closeFile() here — the cleanup effect above handles it after
    // the final save, ensuring activeFileId is still valid when Canvas.tsx's
    // autosave cleanup also runs (children clean up before parents in React).
    navigate(`/workspaces/${workspaceId}`);
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <Canvas />
      <BackButton onClick={handleBack} />
      <ShareExportBar />
      <Toolbar />
      <PropertiesPanel />
      <BgPicker />
      <ThemeToggle />
      <Minimap />
      <ZoomControls />
      <CommandPalette />
    </div>
  );
}

// ── Auth callback (server redirects here after Google OAuth) ──────────────

function AuthCallbackRoute() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const { initForUser } = useWorkspaceStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get('token');
    const userRaw = params.get('user');

    if (token && userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw)) as import('./store/authStore').AuthUser;
        signIn(token, user);
        initForUser(user.id);
        navigate('/workspaces', { replace: true });
        return;
      } catch { /* fall through */ }
    }
    navigate('/?error=auth_failed', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <AppLoader />;
}

// ── Root App ───────────────────────────────────────────────────────────────

export function App() {
  const { isLoaded, user, token, loadFromStorage } = useAuthStore();
  const { initForUser } = useWorkspaceStore();
  const didInit = useRef(false);
  const location = useLocation();

  // Restore persisted auth on mount
  useEffect(() => { loadFromStorage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise workspace data once on sign-in
  useEffect(() => {
    const isSignedIn = !!(user && token);
    if (isSignedIn && user && !didInit.current) {
      didInit.current = true;
      initForUser(user.id);
    }
    if (!isSignedIn) didInit.current = false;
  }, [user?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded) return <AppLoader />;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.key}>
        <Route path="/"                                         element={<LandingRoute />} />
        <Route path="/docs"                                     element={<DocsPage />} />
        <Route path="/auth/callback"                            element={<AuthCallbackRoute />} />
        <Route path="/share/:token"                             element={<SharedCanvasPage />} />
        <Route path="/workspaces"                               element={<RequireAuth><WorkspacesRoute /></RequireAuth>} />
        <Route path="/workspaces/:workspaceId"                  element={<RequireAuth><FilesRoute /></RequireAuth>} />
        <Route path="/workspaces/:workspaceId/files/:fileId"    element={<RequireAuth><EditorRoute /></RequireAuth>} />
        <Route path="*"                                         element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
