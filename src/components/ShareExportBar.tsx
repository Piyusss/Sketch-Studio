import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbShare3, TbDownload, TbCheck, TbCopy, TbX, TbPhoto, TbVectorTriangle, TbFileTypePdf, TbChevronDown } from 'react-icons/tb';
import { api, type ShareMode } from '../lib/api';
import { useWorkspaceStore } from '../store/workspaceStore';
import { exportCanvasToPng } from '../lib/exportImage';
import { exportCanvasToSvg } from '../lib/exportSvg';
import { exportCanvasToPdf } from '../lib/exportPdf';

const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8,
  background: 'var(--panel-translucent)', backdropFilter: 'blur(8px)',
  border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)',
  fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
};

function Toast({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      style={{
        position: 'absolute', bottom: 44, left: 0, whiteSpace: 'nowrap',
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
  const [exportOpen, setExportOpen] = useState(false);
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
    if (!shareOpen && !exportOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShareOpen(false);
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shareOpen, exportOpen]);

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

  async function runExport(kind: 'png' | 'svg' | 'pdf') {
    setExportOpen(false);
    const fn =
      kind === 'png' ? exportCanvasToPng({ filename: fileName })
        : kind === 'svg' ? exportCanvasToSvg(fileName)
          : exportCanvasToPdf({ filename: fileName });
    const res = await fn;
    if (!res.ok) {
      flashToast(res.reason === 'empty' ? 'Canvas is empty' : 'Export failed');
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', bottom: 16, left: 100, zIndex: 200, display: 'flex', gap: 8 }}
    >
      <div style={{ position: 'relative' }}>
        <button style={{ ...btn, ...(exportOpen ? { background: 'var(--panel-bg)' } : {}) }} title="Export canvas"
          onClick={() => { setExportOpen((v) => !v); setShareOpen(false); }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-bg)'; }}
          onMouseLeave={(e) => { if (!exportOpen) (e.currentTarget as HTMLElement).style.background = 'var(--panel-translucent)'; }}
        >
          <TbDownload size={15} /> Export <TbChevronDown size={13} style={{ marginLeft: -2 }} />
        </button>

        <AnimatePresence>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                width: 220, background: 'var(--panel-bg)', borderRadius: 12,
                border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow-lg)',
                padding: 6, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {([
                { kind: 'png', icon: <TbPhoto size={16} />, title: 'PNG image', sub: 'Raster · transparent-safe' },
                { kind: 'svg', icon: <TbVectorTriangle size={16} />, title: 'SVG vector', sub: 'Scalable · editable' },
                { kind: 'pdf', icon: <TbFileTypePdf size={16} />, title: 'PDF document', sub: 'Print · share' },
              ] as { kind: 'png' | 'svg' | 'pdf'; icon: React.ReactNode; title: string; sub: string }[]).map((opt) => (
                <button
                  key={opt.kind}
                  onClick={() => runExport(opt.kind)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                    padding: '9px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-primary)',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', color: 'var(--text-secondary)' }}>{opt.icon}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{opt.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{opt.sub}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          style={{ ...btn, ...(mode ? { background: 'var(--active-bg)', color: 'var(--active-fg)', borderColor: 'var(--active-fg)' } : {}) }}
          title="Share this canvas"
          onClick={() => setShareOpen((v) => !v)}
        >
          <TbShare3 size={15} /> {mode ? 'Shared' : 'Share'}
        </button>

        <AnimatePresence>
          {shareOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                width: 320, background: 'var(--panel-bg)', borderRadius: 12,
                border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow-lg)',
                padding: 16, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Share canvas</span>
                <button onClick={() => setShareOpen(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 1 }}>
                  <TbX size={16} />
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px', lineHeight: 1.5 }}>
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
                        border: `1px solid ${active ? 'var(--active-fg)' : 'var(--panel-border)'}`,
                        background: active ? 'var(--active-bg)' : 'var(--panel-bg-2)',
                        color: active ? 'var(--active-fg)' : 'var(--text-secondary)',
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
                      border: '1px solid var(--panel-border)', borderRadius: 7,
                      background: 'var(--input-bg)', color: 'var(--text-secondary)', outline: 'none',
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
