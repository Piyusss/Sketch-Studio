import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentStore } from '../store/documentStore';
import type { CanvasObject } from '../types';

let ydoc: Y.Doc | null = null;
let yObjects: Y.Map<CanvasObject> | null = null;
let idbPersistence: IndexeddbPersistence | null = null;
let zustandUnsub: (() => void) | null = null;
let prevObjects: Record<string, CanvasObject> = {};

// Prevents Zustand→Yjs→Zustand circular sync
const LOCAL_ORIGIN = Symbol('sketch-local');

export function getYDoc(): Y.Doc | null { return ydoc; }

// ── Open a document ────────────────────────────────────────────────────────────

export async function openYDocument(docId: string): Promise<void> {
  await closeYDocument();

  ydoc = new Y.Doc();
  yObjects = ydoc.getMap<CanvasObject>('objects');

  // Local IndexedDB persistence — instant load, works offline
  idbPersistence = new IndexeddbPersistence(`sketch-doc-${docId}`, ydoc);

  await new Promise<void>((resolve) => {
    idbPersistence!.once('synced', () => {
      const objects: Record<string, CanvasObject> = {};
      yObjects!.forEach((val, key) => { objects[key] = val; });
      useCanvasStore.getState().loadObjects(objects);
      resolve();
    });
  });

  useDocumentStore.getState().setSaveStatus('saved');

  // Yjs → Zustand (local persistence changes only)
  yObjects.observe((event) => {
    if (event.transaction.origin === LOCAL_ORIGIN) return;

    const updates: Record<string, CanvasObject> = {};
    const deletes: string[] = [];

    event.changes.keys.forEach((change, key) => {
      if (change.action === 'delete') {
        deletes.push(key);
      } else {
        const val = yObjects!.get(key);
        if (val) updates[key] = val;
      }
    });

    if (Object.keys(updates).length > 0 || deletes.length > 0) {
      const state = useCanvasStore.getState();
      const newObjects = { ...state.objects };
      deletes.forEach((id) => delete newObjects[id]);
      Object.assign(newObjects, updates);
      useCanvasStore.getState().loadObjects(newObjects);
    }
  });

  // Zustand → Yjs (debounced, keeps IndexedDB in sync)
  prevObjects = useCanvasStore.getState().objects;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  zustandUnsub = useCanvasStore.subscribe((state) => {
    if (state.objects === prevObjects) return;
    const curr = state.objects;
    const prev = prevObjects;
    prevObjects = curr;

    ydoc!.transact(() => {
      Object.keys(prev).forEach((id) => {
        if (!curr[id]) yObjects!.delete(id);
      });
      Object.keys(curr).forEach((id) => {
        if (curr[id] !== prev[id]) yObjects!.set(id, curr[id]);
      });
    }, LOCAL_ORIGIN);

    useDocumentStore.getState().setSaveStatus('saving');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      useDocumentStore.getState().setSaveStatus('saved');
    }, 1500);
  });
}

// ── Close / cleanup ────────────────────────────────────────────────────────────

export async function closeYDocument(): Promise<void> {
  if (zustandUnsub) { zustandUnsub(); zustandUnsub = null; }
  if (idbPersistence) { await idbPersistence.destroy(); idbPersistence = null; }
  if (ydoc) { ydoc.destroy(); ydoc = null; }
  yObjects = null;
  useDocumentStore.getState().setSaveStatus('saved');
  useCanvasStore.getState().loadObjects({});
}
