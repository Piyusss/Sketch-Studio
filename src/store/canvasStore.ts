import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Camera, CanvasObject, GroupObject, Layer, Tool, StrokeStyle, CanvasGridStyle } from '../types';
import { computeUnionAABB } from '../utils/math';
import { spatialIndex } from '../engine/spatialIndex';

const DEFAULT_LAYER: Layer = {
  id: 'default',
  name: 'Layer 1',
  visible: true,
  locked: false,
  order: 0,
};

const DEFAULT_CAMERA: Camera = {
  x: -200, y: -150, zoom: 1,
  targetX: -200, targetY: -150, targetZoom: 1,
};

export interface CanvasState {
  camera: Camera;
  objects: Record<string, CanvasObject>;
  layers: Layer[];
  selectedIds: string[];
  activeTool: Tool;
  editingTextId: string | null;

  setCamera: (updates: Partial<Camera>) => void;

  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  removeObjects: (ids: string[]) => void;
  getObject: (id: string) => CanvasObject | undefined;

  setSelectedIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;

  setActiveTool: (tool: Tool) => void;
  setEditingTextId: (id: string | null) => void;

  // Z-order
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Group / Ungroup
  groupSelected: () => string | null;
  ungroupSelected: () => void;

  // Lock
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;

  // Collaboration
  loadObjects: (objects: Record<string, CanvasObject>) => void;
  upsertObject: (obj: CanvasObject) => void;

  // Text tool defaults (persist across text objects)
  textFontFamily: string;
  textFontSize: number;
  textFontWeight: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  setTextFontFamily: (v: string) => void;
  setTextFontSize: (v: number) => void;
  setTextFontWeight: (v: number) => void;
  setTextColor: (v: string) => void;
  setTextAlign: (v: 'left' | 'center' | 'right') => void;

  // Canvas background + grid style
  canvasBg: string;
  setCanvasBg: (color: string) => void;
  canvasGrid: CanvasGridStyle;
  setCanvasGrid: (style: CanvasGridStyle) => void;

  // Laser pointer settings
  laserSize: number;
  laserGlow: number;
  setLaserSize: (v: number) => void;
  setLaserGlow: (v: number) => void;

  // Pen / freehand tool settings (persist across strokes)
  penColor: string;
  penWidth: number;
  penStyle: StrokeStyle;
  penRecentColors: string[];
  setPenColor: (c: string) => void;
  setPenWidth: (w: number) => void;
  setPenStyle: (s: StrokeStyle) => void;
  addRecentPenColor: (c: string) => void;
}

const DEFAULT_BG = '#F7F7F8';

/**
 * Move `id` one step forward (+1) or backward (-1) in the z-order.
 * Normalises all zIndices to sequential integers first so the operation is
 * guaranteed to work regardless of gaps or duplicates in the existing values.
 * Returns null when the object is already at the boundary.
 */
function reorderStep(
  objects: Record<string, CanvasObject>,
  id: string,
  delta: 1 | -1,
): Record<string, CanvasObject> | null {
  // Sort all top-level objects by current zIndex; use createdAt as stable tie-breaker
  const sorted = Object.values(objects)
    .filter((o) => !o.parentId)
    .sort((a, b) => (a.zIndex !== b.zIndex ? a.zIndex - b.zIndex : a.createdAt - b.createdAt));

  const pos = sorted.findIndex((o) => o.id === id);
  if (pos === -1) return null;

  const newPos = pos + delta;
  if (newPos < 0 || newPos >= sorted.length) return null; // already at boundary

  const now = Date.now();
  const result = { ...objects };

  // 1. Normalise every top-level object to sequential zIndex values (0, 1, 2 …)
  sorted.forEach((o, i) => {
    result[o.id] = { ...o, zIndex: i, updatedAt: now };
  });

  // 2. Swap the target and the adjacent object
  result[id]               = { ...result[id],               zIndex: newPos };
  result[sorted[newPos].id] = { ...result[sorted[newPos].id], zIndex: pos   };

  return result;
}

function loadBg(): string {
  return localStorage.getItem('sketch-canvas-bg') ?? DEFAULT_BG;
}

function loadGrid(): CanvasGridStyle {
  return (localStorage.getItem('sketch-canvas-grid') as CanvasGridStyle) ?? 'dots';
}

function loadRecentColors(): string[] {
  try { return JSON.parse(localStorage.getItem('sketch-pen-recent') ?? '[]'); } catch { return []; }
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  camera: DEFAULT_CAMERA,
  objects: {},
  layers: [DEFAULT_LAYER],
  selectedIds: [],
  activeTool: 'select',
  editingTextId: null,
  textFontFamily: 'Inter, system-ui, sans-serif',
  textFontSize: 20,
  textFontWeight: 400,
  textColor: '#111827',
  textAlign: 'left' as const,
  canvasBg: loadBg(),
  canvasGrid: loadGrid(),
  laserSize: 4,
  laserGlow: 20,
  penColor: '#374151',
  penWidth: 2,
  penStyle: 'solid' as StrokeStyle,
  penRecentColors: loadRecentColors(),

  setCamera: (updates) =>
    set((state) => ({ camera: { ...state.camera, ...updates } })),

  addObject: (obj) =>
    set((state) => ({ objects: { ...state.objects, [obj.id]: obj } })),

  updateObject: (id, updates) =>
    set((state) => {
      const existing = state.objects[id];
      if (!existing) return state;
      return {
        objects: {
          ...state.objects,
          [id]: { ...existing, ...updates, updatedAt: Date.now() } as CanvasObject,
        },
      };
    }),

  removeObject: (id) =>
    set((state) => {
      const obj = state.objects[id];
      const newObjects = { ...state.objects };
      delete newObjects[id];
      // If it's a group, remove children too
      if (obj?.type === 'group') {
        (obj as GroupObject).childIds.forEach((cid) => delete newObjects[cid]);
      }
      return { objects: newObjects };
    }),

  removeObjects: (ids) =>
    set((state) => {
      const newObjects = { ...state.objects };
      ids.forEach((id) => {
        const obj = newObjects[id];
        delete newObjects[id];
        if (obj?.type === 'group') {
          (obj as GroupObject).childIds.forEach((cid) => delete newObjects[cid]);
        }
      });
      return { objects: newObjects };
    }),

  getObject: (id) => get().objects[id],

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addToSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds
        : [...state.selectedIds, id],
    })),
  removeFromSelection: (id) =>
    set((state) => ({ selectedIds: state.selectedIds.filter((sid) => sid !== id) })),
  clearSelection: () => set({ selectedIds: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setTextFontFamily: (v) => set({ textFontFamily: v }),
  setTextFontSize: (v) => set({ textFontSize: v }),
  setTextFontWeight: (v) => set({ textFontWeight: v }),
  setTextColor: (v) => set({ textColor: v }),
  setTextAlign: (v) => set({ textAlign: v }),

  // ── Z-order ──────────────────────────────────────────────────────────────

  bringForward: (id) =>
    set((state) => {
      const objects = reorderStep(state.objects, id, 1);
      return objects ? { objects } : state;
    }),

  sendBackward: (id) =>
    set((state) => {
      const objects = reorderStep(state.objects, id, -1);
      return objects ? { objects } : state;
    }),

  bringToFront: (id) =>
    set((state) => {
      const obj = state.objects[id];
      if (!obj) return state;
      const maxZ = Math.max(0, ...Object.values(state.objects).map((o) => o.zIndex));
      return {
        objects: {
          ...state.objects,
          [id]: { ...obj, zIndex: maxZ + 1, updatedAt: Date.now() },
        },
      };
    }),

  sendToBack: (id) =>
    set((state) => {
      const obj = state.objects[id];
      if (!obj) return state;
      const minZ = Math.min(0, ...Object.values(state.objects).map((o) => o.zIndex));
      return {
        objects: {
          ...state.objects,
          [id]: { ...obj, zIndex: minZ - 1, updatedAt: Date.now() },
        },
      };
    }),

  // ── Group / Ungroup ───────────────────────────────────────────────────────

  groupSelected: () => {
    const state = get();
    const ids = state.selectedIds.filter((id) => !state.objects[id]?.parentId);
    if (ids.length < 2) return null;

    const objects = ids.map((id) => state.objects[id]).filter(Boolean) as CanvasObject[];
    const bbox = computeUnionAABB(objects);
    const groupId = nanoid();
    const now = Date.now();
    const maxZ = Math.max(...objects.map((o) => o.zIndex));

    const group: GroupObject = {
      id: groupId, type: 'group',
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
      rotation: 0, opacity: 1,
      locked: false, visible: true,
      layerId: 'default', parentId: null,
      zIndex: maxZ, createdAt: now, updatedAt: now,
      childIds: ids,
      fill: 'none', stroke: 'none', strokeWidth: 0,
    };

    set((st) => {
      const updated = { ...st.objects };
      ids.forEach((id) => {
        const obj = updated[id];
        if (!obj) return;
        updated[id] = {
          ...obj,
          x: obj.x - bbox.x,
          y: obj.y - bbox.y,
          parentId: groupId,
          updatedAt: now,
        } as CanvasObject;
      });
      updated[groupId] = group;
      return { objects: updated, selectedIds: [groupId] };
    });

    spatialIndex.insert(group);
    return groupId;
  },

  ungroupSelected: () => {
    const state = get();
    const newSelectedIds: string[] = [];

    state.selectedIds.forEach((id) => {
      const obj = state.objects[id];
      if (obj?.type !== 'group') return;
      const group = obj as GroupObject;
      const now = Date.now();

      set((st) => {
        const updated = { ...st.objects };
        group.childIds.forEach((cid) => {
          const child = updated[cid];
          if (!child) return;
          const absX = group.x + child.x;
          const absY = group.y + child.y;
          updated[cid] = { ...child, x: absX, y: absY, parentId: null, updatedAt: now } as CanvasObject;
          spatialIndex.insert({ ...child, x: absX, y: absY, parentId: null });
          newSelectedIds.push(cid);
        });
        delete updated[group.id];
        spatialIndex.remove(group.id);
        return { objects: updated, selectedIds: newSelectedIds };
      });
    });
  },

  // ── Lock / Visible ────────────────────────────────────────────────────────

  toggleLock: (id) =>
    set((state) => {
      const obj = state.objects[id];
      if (!obj) return state;
      return {
        objects: {
          ...state.objects,
          [id]: { ...obj, locked: !obj.locked, updatedAt: Date.now() },
        },
      };
    }),

  toggleVisible: (id) =>
    set((state) => {
      const obj = state.objects[id];
      if (!obj) return state;
      return {
        objects: {
          ...state.objects,
          [id]: { ...obj, visible: !obj.visible, updatedAt: Date.now() },
        },
      };
    }),

  // ── Collaboration ──────────────────────────────────────────────────────────

  loadObjects: (objects) => {
    spatialIndex.rebuild(objects);
    set({ objects, selectedIds: [], editingTextId: null });
  },

  upsertObject: (obj) =>
    set((state) => {
      const updated = { ...state.objects, [obj.id]: obj };
      spatialIndex.insert(obj);
      return { objects: updated };
    }),

  setCanvasBg: (color) => {
    localStorage.setItem('sketch-canvas-bg', color);
    set({ canvasBg: color });
  },

  setCanvasGrid: (style) => {
    localStorage.setItem('sketch-canvas-grid', style);
    set({ canvasGrid: style });
  },

  setLaserSize: (v) => set({ laserSize: v }),
  setLaserGlow: (v) => set({ laserGlow: v }),

  setPenColor: (c) => set({ penColor: c }),
  setPenWidth: (w) => set({ penWidth: w }),
  setPenStyle: (s) => set({ penStyle: s }),
  addRecentPenColor: (c) =>
    set((state) => {
      const filtered = state.penRecentColors.filter((x) => x !== c);
      const recent = [c, ...filtered].slice(0, 8);
      try { localStorage.setItem('sketch-pen-recent', JSON.stringify(recent)); } catch { /* quota */ }
      return { penRecentColors: recent };
    }),
}));
