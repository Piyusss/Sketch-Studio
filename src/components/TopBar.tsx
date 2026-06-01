import React, { useState, useRef, useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';

interface TopBarProps {
  onClose: () => void;
}

export function TopBar({ onClose }: TopBarProps) {
  const { documents, activeDocId, saveStatus, renameDocument } = useDocumentStore();
  const activeDoc = documents.find((d) => d.id === activeDocId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activeDoc?.name ?? 'Untitled');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  useEffect(() => { setDraft(activeDoc?.name ?? 'Untitled'); }, [activeDoc?.name]);

  function commit() {
    const name = draft.trim() || 'Untitled';
    if (activeDocId) renameDocument(activeDocId, name);
    setEditing(false);
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 48,
      background: '#fff', borderBottom: '1px solid #E4E4E7',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px', zIndex: 200,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <button
        onClick={onClose}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#71717A', padding: '4px 8px', borderRadius: 6,
          fontSize: 13, fontWeight: 500,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F4F4F5'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Docs
      </button>

      <div style={{ width: 1, height: 20, background: '#E4E4E7' }} />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setEditing(false); setDraft(activeDoc?.name ?? 'Untitled'); }
          }}
          style={{
            fontSize: 14, fontWeight: 600, color: '#18181B',
            border: '1px solid #E4E4E7', borderRadius: 5,
            padding: '2px 8px', outline: 'none', background: '#FAFAFA', minWidth: 120,
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            fontSize: 14, fontWeight: 600, color: '#18181B',
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '2px 8px', borderRadius: 5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F4F4F5'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {activeDoc?.name ?? 'Untitled'}
        </button>
      )}

      <span style={{ fontSize: 11, color: '#A1A1AA', marginLeft: -4 }}>
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : ''}
      </span>
    </div>
  );
}
