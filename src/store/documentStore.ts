import { create } from 'zustand';
import { nanoid } from 'nanoid';

export interface DocumentMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const STORAGE_KEY = 'sketch-documents';

function loadDocMetas(): DocumentMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDocMetas(docs: DocumentMeta[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch { /* storage full */ }
}

interface DocumentState {
  documents: DocumentMeta[];
  activeDocId: string | null;
  saveStatus: SaveStatus;

  loadDocuments: () => void;
  createDocument: (name?: string) => DocumentMeta;
  openDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  deleteDocument: (id: string) => void;
  closeDocument: () => void;
  touchDocument: (id: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocId: null,
  saveStatus: 'saved',

  loadDocuments: () => set({ documents: loadDocMetas() }),

  createDocument: (name = 'Untitled') => {
    const now = Date.now();
    const doc: DocumentMeta = { id: nanoid(), name, createdAt: now, updatedAt: now };
    const docs = [...get().documents, doc];
    saveDocMetas(docs);
    set({ documents: docs });
    return doc;
  },

  openDocument: (id) => set({ activeDocId: id }),

  renameDocument: (id, name) => {
    const docs = get().documents.map((d) =>
      d.id === id ? { ...d, name, updatedAt: Date.now() } : d,
    );
    saveDocMetas(docs);
    set({ documents: docs });
  },

  deleteDocument: (id) => {
    const docs = get().documents.filter((d) => d.id !== id);
    saveDocMetas(docs);
    set({ documents: docs, activeDocId: get().activeDocId === id ? null : get().activeDocId });
  },

  closeDocument: () => set({ activeDocId: null }),

  touchDocument: (id) => {
    const docs = get().documents.map((d) =>
      d.id === id ? { ...d, updatedAt: Date.now() } : d,
    );
    saveDocMetas(docs);
    set({ documents: docs });
  },

  setSaveStatus: (status) => set({ saveStatus: status }),
}));
