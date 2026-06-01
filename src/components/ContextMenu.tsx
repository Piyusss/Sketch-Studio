import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { nanoid } from 'nanoid';
import { useCanvasStore } from '../store/canvasStore';
import { historyManager } from '../history/historyManager';
import { RemoveObjectsCommand } from '../history/commands';
import { spatialIndex } from '../engine/spatialIndex';
import type { ArrowObject } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

const ITEM_H = 32; // approximate height per item

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const store = useCanvasStore.getState();
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  const allLocked = selectedIds.length > 0 && selectedIds.every((id) => store.getObject(id)?.locked);
  const hasSelection = selectedIds.length > 0;

  // Close on outside click or Escape
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const MENU_W = 216, MENU_H = ITEM_H * 9;
  const adjX = x + MENU_W > window.innerWidth  ? x - MENU_W : x;
  const adjY = y + MENU_H > window.innerHeight ? y - MENU_H : y;

  function act(fn: () => void) {
    fn();
    onClose();
  }

  function duplicate() {
    const st = useCanvasStore.getState();
    const maxZ = Math.max(0, ...Object.values(st.objects).map((o) => o.zIndex));
    const newIds: string[] = [];
    const OFFSET = 16;
    st.selectedIds.forEach((id, i) => {
      const obj = st.getObject(id);
      if (!obj) return;
      const clone = { ...obj, id: nanoid(), x: obj.x + OFFSET, y: obj.y + OFFSET, zIndex: maxZ + i + 1, createdAt: Date.now(), updatedAt: Date.now() };
      if (obj.type === 'arrow') {
        const a = obj as ArrowObject;
        Object.assign(clone, { x1: a.x1 + OFFSET, y1: a.y1 + OFFSET, x2: a.x2 + OFFSET, y2: a.y2 + OFFSET });
      }
      historyManager.push({
        description: 'Duplicate',
        execute: () => { useCanvasStore.getState().addObject(clone as typeof obj); spatialIndex.insert(clone as typeof obj); },
        undo: () => { useCanvasStore.getState().removeObject(clone.id); spatialIndex.remove(clone.id); },
      });
      useCanvasStore.getState().addObject(clone as typeof obj);
      spatialIndex.insert(clone as typeof obj);
      newIds.push(clone.id);
    });
    if (newIds.length) useCanvasStore.getState().setSelectedIds(newIds);
  }

  const sections: Array<Array<{ label: string; shortcut: string; danger?: boolean; disabled?: boolean; action: () => void }> | null> = [
    [
      { label: 'Bring to Front', shortcut: '⌘⇧]', action: () => selectedIds.forEach((id) => useCanvasStore.getState().bringToFront(id)) },
      { label: 'Bring Forward',  shortcut: '⌘]',  action: () => selectedIds.forEach((id) => useCanvasStore.getState().bringForward(id)) },
      { label: 'Send Backward',  shortcut: '⌘[',  action: () => selectedIds.forEach((id) => useCanvasStore.getState().sendBackward(id)) },
      { label: 'Send to Back',   shortcut: '⌘⇧[', action: () => selectedIds.forEach((id) => useCanvasStore.getState().sendToBack(id)) },
    ],
    null, // divider
    [
      {
        label: allLocked ? 'Unlock' : 'Lock',
        shortcut: '⌘L',
        action: () => selectedIds.forEach((id) => useCanvasStore.getState().toggleLock(id)),
      },
    ],
    null,
    [
      { label: 'Duplicate', shortcut: '⌘D', action: duplicate },
      { label: 'Delete',    shortcut: '⌫',  danger: true, action: () => historyManager.execute(new RemoveObjectsCommand(selectedIds)) },
    ],
  ];

  if (!hasSelection) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: adjX, top: adjY,
        background: '#fff',
        border: '1px solid #E4E4E7',
        borderRadius: 10, padding: '4px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        zIndex: 9999, minWidth: MENU_W,
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {sections.map((section, si) =>
        section === null ? (
          <div key={si} style={{ height: 1, background: '#F4F4F5', margin: '3px 0' }} />
        ) : (
          section.map((item) => (
            <button
              key={item.label}
              onClick={() => act(item.action)}
              disabled={item.disabled}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 10px',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                background: 'transparent',
                color: item.danger ? '#EF4444' : '#374151',
                fontSize: 13, textAlign: 'left', fontFamily: 'inherit',
                gap: 24, opacity: item.disabled ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled)
                  (e.currentTarget as HTMLButtonElement).style.background = item.danger ? '#FEF2F2' : '#F4F4F5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span style={{ fontWeight: item.label === 'Bring to Front' || item.label === 'Send to Back' ? 500 : 400 }}>
                {item.label}
              </span>
              <span style={{ fontSize: 11, color: item.danger ? '#FCA5A5' : '#A1A1AA', whiteSpace: 'nowrap' }}>
                {item.shortcut}
              </span>
            </button>
          ))
        )
      )}
    </div>,
    document.body,
  );
}
