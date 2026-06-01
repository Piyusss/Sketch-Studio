import React, { useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { CanvasObject } from '../types';

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7C2.5 4 4.5 2.5 7 2.5C9.5 2.5 11.5 4 13 7C11.5 10 9.5 11.5 7 11.5C4.5 11.5 2.5 10 1 7Z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.5 1.5L12.5 12.5M5.5 4.2C6 3.8 6.5 3.6 7 3.6C9.5 3.6 11.5 5.1 13 8C12.2 9.5 11.2 10.7 10 11.3M8.5 9.8C8 10.2 7.5 10.4 7 10.4C4.5 10.4 2.5 8.9 1 6C1.8 4.5 2.8 3.3 4 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5C4.5 3.12 5.62 2 7 2C8.38 2 9.5 3.12 9.5 4.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5C4.5 3.12 5.62 2 7 2C8.38 2 9.5 3.12 9.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function TypeIcon({ type }: { type: CanvasObject['type'] }) {
  if (type === 'rect') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
  if (type === 'ellipse') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="7" rx="5" ry="4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
  if (type === 'text') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4H11M7 4V11M5 11H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (type === 'image') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="5.5" r="1" stroke="currentColor" strokeWidth="1" />
      <path d="M2 10L5 7L7.5 9.5L9 8L12 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === 'group') return <GroupIcon />;
  return null;
}

function objectLabel(obj: CanvasObject): string {
  if (obj.type === 'text') return `"${'content' in obj ? (obj as { content: string }).content.slice(0, 16) : ''}"`;
  return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
}

export function LayersPanel() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const toggleVisible = useCanvasStore((s) => s.toggleVisible);
  const toggleLock = useCanvasStore((s) => s.toggleLock);
  const bringForward = useCanvasStore((s) => s.bringForward);
  const sendBackward = useCanvasStore((s) => s.sendBackward);

  const [isOpen, setIsOpen] = useState(true);

  // Only top-level objects, sorted by zIndex descending
  const topLevel = Object.values(objects)
    .filter((o) => !o.parentId)
    .sort((a, b) => b.zIndex - a.zIndex);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute', top: 70, left: 16,
          width: 32, height: 32, border: '1px solid #E4E4E7',
          borderRadius: 8, background: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#52525B', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          zIndex: 100,
        }}
        title="Show Layers"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute', top: 70, left: 16,
        width: 200,
        background: '#ffffff',
        border: '1px solid #E4E4E7',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        zIndex: 100,
        fontFamily: 'Inter, system-ui, sans-serif',
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px 6px',
          borderBottom: '1px solid #F4F4F5',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Layers
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 2, lineHeight: 1 }}
          title="Hide"
        >
          ×
        </button>
      </div>

      {/* Object list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {topLevel.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#A1A1AA', textAlign: 'center' }}>
            No objects yet
          </div>
        )}
        {topLevel.map((obj) => {
          const isSelected = selectedIds.includes(obj.id);
          return (
            <div
              key={obj.id}
              onClick={() => setSelectedIds([obj.id])}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px',
                background: isSelected ? '#EEF2FF' : 'transparent',
                cursor: 'pointer',
                borderBottom: '1px solid #F9F9F9',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Type icon */}
              <span style={{ color: isSelected ? '#4F46E5' : '#71717A', flexShrink: 0 }}>
                <TypeIcon type={obj.type} />
              </span>

              {/* Label */}
              <span style={{
                fontSize: 12, color: isSelected ? '#312E81' : '#374151',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                opacity: obj.visible ? 1 : 0.4,
              }}>
                {objectLabel(obj)}
              </span>

              {/* Controls */}
              <span
                onClick={(e) => { e.stopPropagation(); toggleVisible(obj.id); }}
                style={{ color: obj.visible ? '#71717A' : '#D1D5DB', cursor: 'pointer', flexShrink: 0 }}
                title={obj.visible ? 'Hide' : 'Show'}
              >
                <EyeIcon visible={obj.visible} />
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); toggleLock(obj.id); }}
                style={{ color: obj.locked ? '#F59E0B' : '#D1D5DB', cursor: 'pointer', flexShrink: 0 }}
                title={obj.locked ? 'Unlock' : 'Lock'}
              >
                <LockIcon locked={obj.locked} />
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: z-order controls for selected */}
      {selectedIds.length === 1 && (
        <div style={{
          borderTop: '1px solid #F4F4F5',
          padding: '6px 8px',
          display: 'flex', gap: 4,
        }}>
          {[
            { title: 'Bring to Front', icon: '⇈', fn: () => useCanvasStore.getState().bringToFront(selectedIds[0]) },
            { title: 'Bring Forward', icon: '↑', fn: () => bringForward(selectedIds[0]) },
            { title: 'Send Backward', icon: '↓', fn: () => sendBackward(selectedIds[0]) },
            { title: 'Send to Back', icon: '⇊', fn: () => useCanvasStore.getState().sendToBack(selectedIds[0]) },
          ].map((btn) => (
            <button
              key={btn.title}
              onClick={btn.fn}
              title={btn.title}
              style={{
                flex: 1, border: '1px solid #E4E4E7', borderRadius: 5,
                padding: '3px 0', background: '#FAFAFA', cursor: 'pointer',
                fontSize: 12, color: '#52525B',
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
