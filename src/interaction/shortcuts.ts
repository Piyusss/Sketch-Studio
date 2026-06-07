import { nanoid } from 'nanoid';
import type { Camera, Tool } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { historyManager } from '../history/historyManager';
import { RemoveObjectsCommand } from '../history/commands';
import { spatialIndex } from '../engine/spatialIndex';
import { copyToClipboard, pasteFromClipboard } from '../utils/clipboard';
import { clamp } from '../utils/math';
import { MIN_ZOOM, MAX_ZOOM } from '../engine/camera';
import { zoomToFit } from '../engine/cameraControl';

type Handler = (camera: Camera) => void;

const registry: Record<string, Handler> = {
  'ctrl+z': () => historyManager.undo(),
  'ctrl+shift+z': () => historyManager.redo(),
  'ctrl+y': () => historyManager.redo(),

  'ctrl+a': () => {
    const store = useCanvasStore.getState();
    // Select only top-level objects
    const ids = Object.values(store.objects)
      .filter((o) => !o.parentId)
      .map((o) => o.id);
    store.setSelectedIds(ids);
  },

  'escape': () => {
    const store = useCanvasStore.getState();
    store.clearSelection();
    store.setActiveTool('select');
  },

  'delete': () => deleteSelected(),
  'backspace': () => deleteSelected(),

  'v': () => useCanvasStore.getState().setActiveTool('select'),
  'h': () => useCanvasStore.getState().setActiveTool('pan'),
  'r': () => useCanvasStore.getState().setActiveTool('rect'),
  'o': () => useCanvasStore.getState().setActiveTool('ellipse'),
  't': () => useCanvasStore.getState().setActiveTool('text'),
  'p': () => useCanvasStore.getState().setActiveTool('pen'),
  'a': () => useCanvasStore.getState().setActiveTool('arrow'),
  'd': () => useCanvasStore.getState().setActiveTool('diamond'),
  'e': () => useCanvasStore.getState().setActiveTool('eraser'),
  'l': () => useCanvasStore.getState().setActiveTool('laser'),
  'f': () => useCanvasStore.getState().setActiveTool('frame'),

  // Number-row shortcuts mirroring the toolbar's left-to-right order — the
  // little subscript digits under each icon show these at a glance.
  '1': () => useCanvasStore.getState().setActiveTool('select'),
  '2': () => useCanvasStore.getState().setActiveTool('pan'),
  '3': () => {
    const lastShape = (localStorage.getItem('sketch-last-shape') as Tool) ?? 'rect';
    useCanvasStore.getState().setActiveTool(lastShape);
  },
  '4': () => useCanvasStore.getState().setActiveTool('text'),
  '5': () => useCanvasStore.getState().setActiveTool('image'),
  '6': () => useCanvasStore.getState().setActiveTool('pen'),
  '7': () => useCanvasStore.getState().setActiveTool('eraser'),
  '8': () => useCanvasStore.getState().setActiveTool('laser'),

  'ctrl+=': (cam) => { cam.targetZoom = clamp(cam.targetZoom * 1.25, MIN_ZOOM, MAX_ZOOM); },
  'ctrl+-': (cam) => { cam.targetZoom = clamp(cam.targetZoom * 0.8, MIN_ZOOM, MAX_ZOOM); },
  'ctrl+0': (cam) => { cam.targetZoom = 1; cam.targetX = -200; cam.targetY = -150; },
  'ctrl+shift+h': (cam) => { cam.targetZoom = 1; cam.targetX = -200; cam.targetY = -150; },
  'shift+1': () => zoomToFit(Object.values(useCanvasStore.getState().objects)),

  'ctrl+d': () => duplicateSelected(),

  'ctrl+c': () => {
    const store = useCanvasStore.getState();
    const objects = store.selectedIds
      .map((id) => store.getObject(id))
      .filter(Boolean) as ReturnType<typeof store.getObject>[];
    copyToClipboard(objects.filter((o): o is NonNullable<typeof o> => !!o));
  },

  'ctrl+x': () => {
    const store = useCanvasStore.getState();
    const objects = store.selectedIds
      .map((id) => store.getObject(id))
      .filter((o): o is NonNullable<typeof o> => !!o);
    copyToClipboard(objects);
    deleteSelected();
  },

  'ctrl+v': (cam) => pasteFromClipboard(cam),

  'ctrl+g': () => useCanvasStore.getState().groupSelected(),
  'ctrl+shift+g': () => useCanvasStore.getState().ungroupSelected(),

  'ctrl+l': () => {
    const store = useCanvasStore.getState();
    store.selectedIds.forEach((id) => store.toggleLock(id));
  },

  'ctrl+]': () => {
    const store = useCanvasStore.getState();
    store.selectedIds.forEach((id) => store.bringForward(id));
  },
  'ctrl+[': () => {
    const store = useCanvasStore.getState();
    store.selectedIds.forEach((id) => store.sendBackward(id));
  },
  'ctrl+shift+]': () => {
    const store = useCanvasStore.getState();
    store.selectedIds.forEach((id) => store.bringToFront(id));
  },
  'ctrl+shift+[': () => {
    const store = useCanvasStore.getState();
    store.selectedIds.forEach((id) => store.sendToBack(id));
  },
};

function deleteSelected(): void {
  const store = useCanvasStore.getState();
  if (store.selectedIds.length === 0) return;
  historyManager.execute(new RemoveObjectsCommand(store.selectedIds));
}

function duplicateSelected(): void {
  const store = useCanvasStore.getState();
  const maxZ = Object.values(store.objects).reduce((m, o) => Math.max(m, o.zIndex), 0);
  const newIds: string[] = [];
  const OFF = 16;
  store.selectedIds.forEach((id, i) => {
    const obj = store.getObject(id);
    if (!obj) return;
    const base = {
      ...obj, id: nanoid(), x: obj.x + OFF, y: obj.y + OFF,
      zIndex: maxZ + i + 1, createdAt: Date.now(), updatedAt: Date.now(),
    };
    if (obj.type === 'arrow') {
      const a = obj as { x1: number; y1: number; x2: number; y2: number };
      Object.assign(base, { x1: a.x1 + OFF, y1: a.y1 + OFF, x2: a.x2 + OFF, y2: a.y2 + OFF });
    }
    store.addObject(base as ReturnType<typeof store.getObject> extends infer T ? NonNullable<T> : never);
    spatialIndex.insert(base as Parameters<typeof spatialIndex.insert>[0]);
    newIds.push(base.id);
  });
  if (newIds.length > 0) store.setSelectedIds(newIds);
}

export function handleKeyboardShortcut(e: KeyboardEvent, camera: Camera): void {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  ) return;

  let key = '';
  if (e.ctrlKey || e.metaKey) key += 'ctrl+';
  if (e.shiftKey) key += 'shift+';
  // Use the physical digit for number keys so Shift+1 isn't read as '!' (layout-dependent)
  const mainKey = /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : e.key.toLowerCase();
  key += mainKey;
  if (key === 'ctrl++') key = 'ctrl+=';

  const handler = registry[key];
  if (handler) {
    e.preventDefault();
    handler(camera);
  }
}
