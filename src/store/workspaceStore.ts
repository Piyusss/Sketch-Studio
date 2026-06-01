import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { api } from '../lib/api';

export interface Workspace {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileMeta {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

const WORKSPACE_EMOJIS = ['🎨', '🏗️', '💡', '🚀', '🧩', '📐', '🗂️', '⚡'];
const WORKSPACE_COLORS = [
  '#EEF2FF', '#FFF1F2', '#F0FDF4', '#FFFBEB',
  '#F0F9FF', '#FDF4FF', '#FFF7ED', '#F7F7FF',
];

// ── localStorage cache (offline fallback) ────────────────────────────────────

function wsKey(uid: string) { return `sketch-workspaces-${uid}`; }
function fileKey(uid: string) { return `sketch-files-${uid}`; }

function cacheWorkspaces(uid: string, data: Workspace[]) {
  try { localStorage.setItem(wsKey(uid), JSON.stringify(data)); } catch { /* quota */ }
}
function cacheFiles(uid: string, data: FileMeta[]) {
  try { localStorage.setItem(fileKey(uid), JSON.stringify(data)); } catch { /* quota */ }
}
function loadCachedWorkspaces(uid: string): Workspace[] {
  try { return JSON.parse(localStorage.getItem(wsKey(uid)) ?? '[]'); } catch { return []; }
}
function loadCachedFiles(uid: string): FileMeta[] {
  try { return JSON.parse(localStorage.getItem(fileKey(uid)) ?? '[]'); } catch { return []; }
}

// ── Row <-> model mapping ────────────────────────────────────────────────────

function rowToWorkspace(r: { id: string; name: string; emoji: string; color: string; created_at: number; updated_at: number }): Workspace {
  return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) };
}
function rowToFile(r: { id: string; workspace_id: string; name: string; created_at: number; updated_at: number }): FileMeta {
  return { id: r.id, workspaceId: r.workspace_id, name: r.name, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) };
}

// ── Store ────────────────────────────────────────────────────────────────────

interface WorkspaceState {
  userId: string | null;
  workspaces: Workspace[];
  files: FileMeta[];
  activeWorkspaceId: string | null;
  activeFileId: string | null;
  isLoading: boolean;

  initForUser: (uid: string) => Promise<void>;
  reset: () => void;

  createWorkspace: (name: string) => Workspace;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string | null) => void;

  createFile: (workspaceId: string, name?: string) => FileMeta;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  openFile: (id: string) => void;
  closeFile: () => void;
  touchFile: (id: string) => void;
  filesInWorkspace: (workspaceId: string) => FileMeta[];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  userId: null,
  workspaces: [],
  files: [],
  activeWorkspaceId: null,
  activeFileId: null,
  isLoading: false,

  // ── Init ──────────────────────────────────────────────────────────────────

  initForUser: async (uid) => {
    // Show cached data immediately while fetching
    const cachedWs = loadCachedWorkspaces(uid);
    const cachedFiles = loadCachedFiles(uid);
    set({ userId: uid, workspaces: cachedWs, files: cachedFiles, isLoading: true });

    try {
      const [wsRows, fileRows] = await Promise.all([
        api.workspaces.list(),
        // Fetch all files by fetching each workspace's files
        (async () => {
          const allWs = await api.workspaces.list();
          const nested = await Promise.all(allWs.map((w) => api.files.list(w.id)));
          return nested.flat();
        })(),
      ]);

      const workspaces = wsRows.map(rowToWorkspace);
      const files = fileRows.map(rowToFile);

      cacheWorkspaces(uid, workspaces);
      cacheFiles(uid, files);
      set({ workspaces, files, isLoading: false });
    } catch (err) {
      // API unavailable — keep cached data, let user work offline
      console.warn('Sketch API unreachable, using local cache:', err);
      set({ isLoading: false });
    }
  },

  reset: () =>
    set({ userId: null, workspaces: [], files: [], activeWorkspaceId: null, activeFileId: null }),

  // ── Workspaces ────────────────────────────────────────────────────────────

  createWorkspace: (name) => {
    const uid = get().userId!;
    const idx = get().workspaces.length % WORKSPACE_EMOJIS.length;
    const now = Date.now();
    const ws: Workspace = {
      id: nanoid(), name,
      emoji: WORKSPACE_EMOJIS[idx],
      color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
      createdAt: now, updatedAt: now,
    };
    const workspaces = [...get().workspaces, ws];
    set({ workspaces });
    cacheWorkspaces(uid, workspaces);

    // Sync to API in background
    api.workspaces.create({
      id: ws.id, name: ws.name, emoji: ws.emoji, color: ws.color,
      created_at: ws.createdAt, updated_at: ws.updatedAt,
    }).catch(console.error);

    return ws;
  },

  renameWorkspace: (id, name) => {
    const uid = get().userId!;
    const updatedAt = Date.now();
    const workspaces = get().workspaces.map((w) =>
      w.id === id ? { ...w, name, updatedAt } : w,
    );
    set({ workspaces });
    cacheWorkspaces(uid, workspaces);

    api.workspaces.update(id, { name, updated_at: updatedAt }).catch(console.error);
  },

  deleteWorkspace: (id) => {
    const uid = get().userId!;
    const workspaces = get().workspaces.filter((w) => w.id !== id);
    const files = get().files.filter((f) => f.workspaceId !== id);
    set({ workspaces, files });
    cacheWorkspaces(uid, workspaces);
    cacheFiles(uid, files);

    api.workspaces.delete(id).catch(console.error);
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  // ── Files ─────────────────────────────────────────────────────────────────

  createFile: (workspaceId, name = 'Untitled') => {
    const uid = get().userId!;
    const now = Date.now();
    const file: FileMeta = { id: nanoid(), workspaceId, name, createdAt: now, updatedAt: now };
    const files = [...get().files, file];
    set({ files });
    cacheFiles(uid, files);

    api.files.create({
      id: file.id, workspace_id: workspaceId, name: file.name,
      created_at: file.createdAt, updated_at: file.updatedAt,
    }).catch(console.error);

    return file;
  },

  renameFile: (id, name) => {
    const uid = get().userId!;
    const updatedAt = Date.now();
    const files = get().files.map((f) =>
      f.id === id ? { ...f, name, updatedAt } : f,
    );
    set({ files });
    cacheFiles(uid, files);

    api.files.update(id, { name, updated_at: updatedAt }).catch(console.error);
  },

  deleteFile: (id) => {
    const uid = get().userId!;
    const files = get().files.filter((f) => f.id !== id);
    set({ files });
    cacheFiles(uid, files);

    api.files.delete(id).catch(console.error);
  },

  openFile: (id) => set({ activeFileId: id }),
  closeFile: () => set({ activeFileId: null }),

  touchFile: (id) => {
    const uid = get().userId!;
    const updatedAt = Date.now();
    const files = get().files.map((f) =>
      f.id === id ? { ...f, updatedAt } : f,
    );
    set({ files });
    cacheFiles(uid, files);

    api.files.update(id, { updated_at: updatedAt }).catch(console.error);
  },

  filesInWorkspace: (workspaceId) =>
    get().files.filter((f) => f.workspaceId === workspaceId),
}));
