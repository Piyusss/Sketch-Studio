import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { UserMenu } from './UserMenu';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useIsMobile } from '../hooks/useIsMobile';

function CreateWorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const mob = useIsMobile();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: '28px 32px',
          width: mob ? 'calc(100vw - 32px)' : 360, maxWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.16)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
          New workspace
        </h2>
        <input
          autoFocus
          placeholder="Workspace name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) { onCreate(name.trim()); onClose(); }
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
            boxSizing: 'border-box', marginBottom: 16,
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#3B82F6'; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #E4E4E7',
            background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) { onCreate(name.trim()); onClose(); } }}
            disabled={!name.trim()}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: name.trim() ? 'linear-gradient(135deg, #3B82F6, #6366F1)' : '#E4E4E7',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: name.trim() ? 'pointer' : 'default',
            }}
          >
            Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface WorkspacesPageProps {
  onOpen: (workspaceId: string) => void;
  onHome?: () => void;
}

export function WorkspacesPage({ onOpen, onHome }: WorkspacesPageProps) {
  const mobile = useIsMobile();
  const { user } = useAuthStore();
  const { workspaces, createWorkspace, deleteWorkspace, renameWorkspace } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  function handleCreate(name: string) {
    const ws = createWorkspace(name);
    onOpen(ws.id);
  }

  function startRename(ws: { id: string; name: string }) {
    setRenamingId(ws.id);
    setRenameDraft(ws.name);
  }

  function commitRename() {
    if (renamingId && renameDraft.trim()) {
      renameWorkspace(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  }

  const sorted = [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div style={{
      minHeight: '100vh', background: '#F8FAFF',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        height: 56, background: '#fff', borderBottom: '1px solid #EEF2FF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: mobile ? '0 16px' : '0 32px',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onHome ? 'pointer' : 'default' }}
          onClick={onHome}
          title={onHome ? 'Back to home' : undefined}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7H12M7 2V12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>Sketch</span>
        </div>
        <UserMenu />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: mobile ? '24px 16px' : '48px 32px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}
        >
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Hi, {user?.name?.split(' ')[0] ?? 'there'} 👽
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              {workspaces.length === 0 ? 'Create your first workspace to get started.' : 'Select a workspace to continue.'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
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
            New workspace
          </button>
        </motion.div>

        {/* Workspace grid */}
        {sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ textAlign: 'center', paddingTop: 80 }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
            <p style={{ fontSize: 15, color: '#94A3B8', fontWeight: 500 }}>No workspaces yet</p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: 16, padding: '10px 24px', borderRadius: 9, border: 'none',
                background: '#EFF6FF', color: '#3B82F6', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Create your first workspace
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: mobile ? 10 : 16 }}>
            {sorted.map((ws, i) => (
              <motion.div
                key={ws.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                onClick={() => onOpen(ws.id)}
                style={{
                  background: '#fff', borderRadius: 14,
                  border: '1px solid #EEF2FF',
                  padding: '20px 20px 16px',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: '0 1px 6px rgba(59,130,246,0.05)',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                }}
                whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(59,130,246,0.12)' }}
              >
                {/* Color accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                  background: 'linear-gradient(90deg, #3B82F6, #6366F1)',
                  borderRadius: '14px 14px 0 0',
                }}/>

                <div style={{ fontSize: 32, marginBottom: 10 }}>{ws.emoji}</div>

                {renamingId === ws.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 15, fontWeight: 700, width: '100%', border: 'none',
                      borderBottom: '2px solid #3B82F6', outline: 'none', padding: '2px 0',
                      background: 'transparent', color: '#0F172A', marginBottom: 4,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                    {ws.name}
                  </div>
                )}

                {/* Action buttons */}
                <div
                  style={{ display: 'flex', gap: 4, marginTop: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => startRename(ws)}
                    title="Rename"
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#F8FAFC', cursor: 'pointer', fontSize: 11, color: '#64748B' }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteWorkspace(ws.id)}
                    title="Delete"
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', fontSize: 11, color: '#EF4444' }}
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateWorkspaceModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
