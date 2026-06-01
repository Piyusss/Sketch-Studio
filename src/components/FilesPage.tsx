import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserMenu } from './UserMenu';
import { useWorkspaceStore, type FileMeta, type Workspace } from '../store/workspaceStore';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function FileCard({
  file, onOpen, onDelete, onRename,
}: {
  file: FileMeta;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [menuOpen, setMenuOpen] = useState(false);

  function commit() {
    const name = draft.trim() || 'Untitled';
    onRename(name);
    setDraft(name);
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25 }}
      style={{
        background: '#fff', borderRadius: 12,
        border: '1px solid #EEF2FF',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(59,130,246,0.04)',
        position: 'relative',
      }}
      whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(59,130,246,0.10)' }}
      onClick={onOpen}
    >
      {/* Thumbnail area */}
      <div style={{
        height: 120, background: '#F0F4FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid #EEF2FF',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Mini dot grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
          <defs>
            <pattern id={`dots-${file.id}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#BFDBFE"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dots-${file.id})`}/>
        </svg>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ position: 'relative', zIndex: 1 }}>
          <rect x="4" y="8" width="16" height="12" rx="2" stroke="#93C5FD" strokeWidth="1.5"/>
          <rect x="16" y="14" width="12" height="14" rx="2" stroke="#A5B4FC" strokeWidth="1.5"/>
          <circle cx="10" cy="26" r="4" stroke="#BAE6FD" strokeWidth="1.5"/>
        </svg>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setEditing(false); setDraft(file.name); }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 13, fontWeight: 600, width: '100%',
              border: 'none', borderBottom: '1.5px solid #3B82F6', outline: 'none',
              padding: '0 0 2px', background: 'transparent', color: '#0F172A',
            }}
          />
        ) : (
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#0F172A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {file.name}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
          Edited {formatDate(file.updatedAt)}
        </div>
      </div>

      {/* Menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 26, height: 26, borderRadius: 6,
          border: 'none', background: 'rgba(255,255,255,0.9)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748B',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="13" r="1.3"/>
        </svg>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 36, right: 8, zIndex: 10,
              background: '#fff', border: '1px solid #E4E4E7',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              overflow: 'hidden', minWidth: 120,
            }}
          >
            {[
              { label: 'Rename', action: () => { setEditing(true); setMenuOpen(false); }, color: '#374151' },
              { label: 'Delete', action: () => { onDelete(); setMenuOpen(false); }, color: '#EF4444' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: '100%', padding: '8px 14px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13, color: item.color,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface FilesPageProps {
  workspace: Workspace;
  onBack: () => void;
  onOpenFile: (fileId: string) => void;
}

export function FilesPage({ workspace, onBack, onOpenFile }: FilesPageProps) {
  const { createFile, deleteFile, renameFile, openFile, filesInWorkspace } = useWorkspaceStore();
  const files = filesInWorkspace(workspace.id).sort((a, b) => b.updatedAt - a.updatedAt);

  function handleOpen(file: FileMeta) {
    // Canvas loading and Yjs initialisation happen in EditorRoute on navigation
    openFile(file.id);
    onOpenFile(file.id);
  }

  function handleCreate() {
    const file = createFile(workspace.id, 'Untitled');
    openFile(file.id);
    onOpenFile(file.id);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8FAFF',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        height: 56, background: '#fff', borderBottom: '1px solid #EEF2FF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Back */}
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 7, border: '1px solid #E4E4E7',
              background: '#fff', fontSize: 13, color: '#374151',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Workspaces
          </button>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            {workspace.emoji} {workspace.name}
          </span>
        </div>
        <UserMenu />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 3px', letterSpacing: '-0.02em' }}>
              {workspace.emoji} {workspace.name}
            </h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </p>
          </div>
          <button
            onClick={handleCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59,130,246,0.26)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1V12M1 6.5H12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            New file
          </button>
        </motion.div>

        {files.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ textAlign: 'center', paddingTop: 80 }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>📄</div>
            <p style={{ fontSize: 15, color: '#94A3B8', fontWeight: 500 }}>No files yet</p>
            <button
              onClick={handleCreate}
              style={{
                marginTop: 14, padding: '10px 24px', borderRadius: 9, border: 'none',
                background: '#EFF6FF', color: '#3B82F6', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Create your first file
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onOpen={() => handleOpen(file)}
                  onDelete={() => deleteFile(file.id)}
                  onRename={(name) => renameFile(file.id, name)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
