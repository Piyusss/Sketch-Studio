// Minimal store used exclusively by yDocument.ts to track the local-save status
// shown while the Yjs IndexedDB persistence layer is syncing.
// The full document-list management that was here has been removed — workspaces
// and files are managed by workspaceStore + the NeonDB REST API instead.

import { create } from 'zustand';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface DocumentState {
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),
}));
