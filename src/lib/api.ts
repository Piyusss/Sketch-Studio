// Thin API client — reads the JWT stored by authStore (works outside React hooks).
import { useAuthStore } from '../store/authStore';

function getToken(): string | null {
  return useAuthStore.getState().token;
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string> ?? {}) },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid — sign out and redirect to landing
      useAuthStore.getState().signOut();
      window.location.href = '/';
      throw new Error('Session expired');
    }
    const text = await res.text();
    throw new Error(`API ${opts.method ?? 'GET'} /api${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// Unauthenticated fetch for public share endpoints — never attaches a token and
// never triggers the sign-out-on-401 behaviour (anonymous viewers have no session).
async function publicFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${opts.method ?? 'GET'} /api${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types mirroring DB rows ──────────────────────────────────────────────────

export interface WsRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: number;
  updated_at: number;
}

export interface FileRow {
  id: string;
  workspace_id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface CanvasSnapshot {
  objects: Record<string, unknown>;
  bg_color: string;
  grid_style: string;
}

export type ShareMode = 'view' | 'edit';

export interface ShareState {
  token: string | null;
  mode: ShareMode | null;
}

export interface PublicShareData {
  name: string;
  mode: ShareMode;
  objects: Record<string, unknown>;
  bg_color: string;
  grid_style: string;
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export const api = {
  workspaces: {
    list: () => apiFetch<WsRow[]>('/workspaces'),
    create: (data: WsRow) =>
      apiFetch<{ ok: true }>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<WsRow>) =>
      apiFetch<{ ok: true }>(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ ok: true }>(`/workspaces/${id}`, { method: 'DELETE' }),
  },

  files: {
    list: (wsId: string) => apiFetch<FileRow[]>(`/workspaces/${wsId}/files`),
    create: (data: FileRow & { workspace_id: string }) =>
      apiFetch<{ ok: true }>('/files', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<FileRow>) =>
      apiFetch<{ ok: true }>(`/files/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ ok: true }>(`/files/${id}`, { method: 'DELETE' }),
  },

  canvas: {
    load: (fileId: string) => apiFetch<CanvasSnapshot>(`/files/${fileId}/canvas`),
    save: (fileId: string, snapshot: Omit<CanvasSnapshot, never>) =>
      apiFetch<{ ok: true }>(`/files/${fileId}/canvas`, {
        method: 'PUT',
        body: JSON.stringify(snapshot),
      }),
  },

  // Owner-side share management (authenticated)
  share: {
    get: (fileId: string) => apiFetch<ShareState>(`/files/${fileId}/share`),
    set: (fileId: string, mode: ShareMode) =>
      apiFetch<{ token: string; mode: ShareMode }>(`/files/${fileId}/share`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
    revoke: (fileId: string) =>
      apiFetch<{ ok: true }>(`/files/${fileId}/share`, { method: 'DELETE' }),
  },

  // Public share access (no authentication)
  publicShare: {
    load: (token: string) => publicFetch<PublicShareData>(`/share/${token}`),
    save: (token: string, snapshot: CanvasSnapshot) =>
      publicFetch<{ ok: true }>(`/share/${token}/canvas`, {
        method: 'PUT',
        body: JSON.stringify(snapshot),
      }),
  },
};
