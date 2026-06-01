import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { openYDocument } from '../collaboration/yDocument';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function DocCard({
  doc,
  onOpen,
  onDelete,
}: {
  doc: { id: string; name: string; updatedAt: number };
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        background: '#fff', border: '1px solid #E4E4E7',
        borderRadius: 10, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer', transition: 'box-shadow 0.1s',
        position: 'relative',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Canvas preview icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 8,
        background: '#F4F4F5', border: '1px solid #E4E4E7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#A1A1AA" strokeWidth="1.5"/>
          <rect x="6" y="8" width="7" height="5" rx="1" fill="#D4D4D8"/>
          <rect x="6" y="15" width="12" height="2" rx="1" fill="#E4E4E7"/>
          <rect x="15" y="7" width="3" height="7" rx="1" fill="#D4D4D8"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#18181B', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.name}
        </div>
        <div style={{ fontSize: 12, color: '#A1A1AA' }}>
          Edited {formatDate(doc.updatedAt)}
        </div>
      </div>

      {/* More menu */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        style={{
          width: 28, height: 28, border: 'none', background: 'transparent',
          borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#A1A1AA', flexShrink: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F4F4F5'; (e.currentTarget as HTMLElement).style.color = '#52525B'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#A1A1AA'; }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
        </svg>
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute', right: 8, top: 44,
            background: '#fff', border: '1px solid #E4E4E7',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 10, minWidth: 120, overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setMenuOpen(false); onDelete(); }}
            style={{
              width: '100%', padding: '8px 14px', border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
              fontSize: 13, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 5H13M5 5V3H11V5M6 8V12M10 8V12M4 5L5 14H11L12 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface DocumentListProps {
  onOpen: (docId: string) => void;
}

export function DocumentList({ onOpen }: DocumentListProps) {
  const { documents, loadDocuments, createDocument, deleteDocument } = useDocumentStore();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
    // Close menu on outside click
    const close = () => {};
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [loadDocuments]);

  async function handleOpen(docId: string) {
    setLoading(docId);
    await openYDocument(docId);
    useDocumentStore.getState().openDocument(docId);
    onOpen(docId);
    setLoading(null);
  }

  function handleCreate() {
    const doc = createDocument('Untitled');
    handleOpen(doc.id);
  }

  const sorted = [...documents].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#F7F7F8',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E4E4E7',
        padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#4F46E5"/>
            <path d="M7 12H17M12 7V17" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#18181B' }}>Sketch</span>
        </div>
        <button
          onClick={handleCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#4F46E5', color: '#fff',
            border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#4338CA'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#4F46E5'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New document
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#71717A', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          All documents
        </h2>

        {sorted.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 80, gap: 12, color: '#A1A1AA',
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="38" rx="3" stroke="#D4D4D8" strokeWidth="2"/>
              <path d="M16 18H32M16 24H28M16 30H24" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No documents yet</div>
            <div style={{ fontSize: 13 }}>Click "New document" to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {sorted.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onOpen={() => handleOpen(doc.id)}
                onDelete={() => deleteDocument(doc.id)}
              />
            ))}
          </div>
        )}

        {loading && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#52525B', zIndex: 1000,
          }}>
            Opening…
          </div>
        )}
      </div>
    </div>
  );
}
