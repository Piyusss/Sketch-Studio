import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbShare3, TbDownload, TbCheck, TbCopy, TbX } from 'react-icons/tb';
import { api, type ShareMode } from '../lib/api';
import { useWorkspaceStore } from '../store/workspaceStore';
import { exportCanvasToPng } from '../lib/exportImage';

const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)',
  border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
};

function Toast({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      style={{
        position: 'absolute', top: 44, right: 0, whiteSpace: 'nowrap',
        background: '#18181B', color: '#fff', fontSize: 12, fontWeight: 500,
        padding: '6px 12px', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      }}
    >{msg}</motion.div>
  );
}

export function ShareExportBar() {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const files = useWorkspaceStore((s) => s.files);
  const fileName = files.find((f) => f.id === activeFileId)?.name ?? 'sketch';

  const [shareOpen, setShareOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const link = token ? `${window.location.origin}/share/${token}` : '';

  // Load current share state when the modal opens
  useEffect(() => {
    if (!shareOpen || !activeFileId) return;
    let cancelled = false;
    api.share.get(activeFileId)
      .then((s) => { if (!cancelled) { setMode(s.mode); setToken(s.token); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [shareOpen, activeFileId]);

  // Close on outside click
  useEffect(() => {
    if (!shareOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shareOpen]);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function applyMode(next: ShareMode) {
    if (!activeFileId) return;
    setLoading(true);
    try {
      const res = await api.share.set(activeFileId, next);
      setMode(res.mode);
      setToken(res.token);
    } catch {
      flashToast('Could not update sharing');
    } finally {
      setLoading(false);
    }
  }

  async function stopSharing() {
    if (!activeFileId) return;
    setLoading(true);
    try {
      await api.share.revoke(activeFileId);
      setMode(null);
      setToken(null);
    } catch {
      flashToast('Could not stop sharing');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => flashToast('Copy failed'));
  }

  async function handleExport() {
    const res = await exportCanvasToPng({ filename: fileName });
    if (!res.ok) {
      flashToast(res.reason === 'empty' ? 'Canvas is empty' : 'Export failed');
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', top: 14, right: 14, zIndex: 200, display: 'flex', gap: 8 }}
    >
      <button style={btn} title="Export as PNG" onClick={handleExport}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.98)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.88)'; }}
      >
        <TbDownload size={15} /> Export
      </button>

      <div style={{ position: 'relative' }}>
        <button
          style={{ ...btn, ...(mode ? { background: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' } : {}) }}
          title="Share this canvas"
          onClick={() => setShareOpen((v) => !v)}
        >
          <TbShare3 size={15} /> {mode ? 'Shared' : 'Share'}
        </button>

        <AnimatePresence>
          {shareOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 320, background: '#fff', borderRadius: 12,
                border: '1px solid #E4E4E7', boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                padding: 16, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>Share canvas</span>
                <button onClick={() => setShareOpen(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 2, lineHeight: 1 }}>
                  <TbX size={16} />
                </button>
              </div>

              <p style={{ fontSize: 12, color: '#71717A', margin: '0 0 10px', lineHeight: 1.5 }}>
                Anyone with the link can access this canvas with the permission you choose.
              </p>

              {/* Permission segmented control */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {([
                  { id: null,   label: 'Off' },
                  { id: 'view', label: 'Can view' },
                  { id: 'edit', label: 'Can edit' },
                ] as { id: ShareMode | null; label: string }[]).map((opt) => {
                  const active = mode === opt.id;
                  return (
                    <button
                      key={opt.label}
                      disabled={loading}
                      onClick={() => (opt.id === null ? stopSharing() : applyMode(opt.id))}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer',
                        fontSize: 12, fontWeight: 600,
                        border: `1px solid ${active ? '#6366F1' : '#E4E4E7'}`,
                        background: active ? '#EEF2FF' : '#FAFAFA',
                        color: active ? '#4F46E5' : '#52525B',
                      }}
                    >{opt.label}</button>
                  );
                })}
              </div>

              {/* Link row */}
              {mode && token && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{
                      flex: 1, padding: '7px 10px', fontSize: 12,
                      border: '1px solid #E4E4E7', borderRadius: 7,
                      background: '#FAFAFA', color: '#374151', outline: 'none',
                      fontFamily: 'ui-monospace, monospace', textOverflow: 'ellipsis',
                    }}
                  />
                  <button
                    onClick={copyLink}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '0 12px', borderRadius: 7, cursor: 'pointer',
                      border: 'none', background: copied ? '#16A34A' : '#18181B',
                      color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{toast && <Toast msg={toast} />}</AnimatePresence>
    </div>
  );
}
