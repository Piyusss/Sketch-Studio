import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TbEye, TbPencil, TbDownload } from 'react-icons/tb';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { BgPicker } from './BgPicker';
import { useCanvasStore } from '../store/canvasStore';
import { api, type ShareMode } from '../lib/api';
import type { CanvasObject, CanvasGridStyle } from '../types';
import { exportCanvasToPng } from '../lib/exportImage';

type Status = 'loading' | 'view' | 'edit' | 'notfound';

export function SharedCanvasPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [name, setName] = useState('Shared canvas');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load shared canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('notfound'); return; }
    let cancelled = false;

    api.publicShare.load(token)
      .then((data) => {
        if (cancelled) return;
        useCanvasStore.getState().loadObjects(data.objects as Record<string, CanvasObject>);
        if (data.bg_color)   useCanvasStore.getState().setCanvasBg(data.bg_color);
        if (data.grid_style) useCanvasStore.getState().setCanvasGrid(data.grid_style as CanvasGridStyle);
        setName(data.name || 'Shared canvas');
        setStatus((data.mode as ShareMode) === 'edit' ? 'edit' : 'view');
      })
      .catch(() => { if (!cancelled) setStatus('notfound'); });

    // Clear canvas state on leave so it can't bleed into the user's own editor
    return () => {
      cancelled = true;
      useCanvasStore.getState().loadObjects({});
      useCanvasStore.getState().clearSelection();
      useCanvasStore.getState().setActiveTool('select');
    };
  }, [token]);

  // ── Autosave (edit mode only) → public share endpoint ─────────────────────
  useEffect(() => {
    if (status !== 'edit' || !token) return;

    const save = () => {
      const s = useCanvasStore.getState();
      setSaveState('saving');
      api.publicShare.save(token, {
        objects:    s.objects as Record<string, unknown>,
        bg_color:   s.canvasBg,
        grid_style: s.canvasGrid,
      }).then(() => setSaveState('saved')).catch(() => setSaveState('saved'));
    };

    const unsub = useCanvasStore.subscribe(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, 2000);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      save(); // flush on unmount
    };
  }, [status, token]);

  async function handleExport() {
    await exportCanvasToPng({ filename: name });
  }

  if (status === 'loading') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #3B82F6, #6366F1)', animation: 'pulse 1.2s ease-in-out infinite' }} />
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, background: '#F8FAFF',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#18181B' }}>Link not available</div>
        <div style={{ fontSize: 14, color: '#71717A', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
          This shared canvas doesn’t exist or sharing has been turned off by its owner.
        </div>
        <a href="/" style={{ marginTop: 8, fontSize: 13, color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>Go to Sketch →</a>
      </div>
    );
  }

  const isEdit = status === 'edit';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <Canvas readOnly={!isEdit} />

      {/* Top-left badge */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, color: '#374151',
      }}>
        {isEdit ? <TbPencil size={15} color="#4F46E5" /> : <TbEye size={15} color="#52525B" />}
        <span style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
          background: isEdit ? '#EEF2FF' : '#F4F4F5', color: isEdit ? '#4F46E5' : '#71717A',
        }}>
          {isEdit ? 'Shared · can edit' : 'Shared · view only'}
        </span>
        {isEdit && (
          <span style={{ fontSize: 11, color: '#A1A1AA' }}>
            {saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        )}
      </div>

      {/* Top-right Export */}
      <button
        onClick={handleExport}
        title="Export as PNG"
        style={{
          position: 'absolute', top: 14, right: 14, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 500,
          color: '#374151', cursor: 'pointer',
        }}
      >
        <TbDownload size={15} /> Export
      </button>

      {/* Full editing chrome only when allowed to edit */}
      {isEdit && (
        <>
          <Toolbar />
          <PropertiesPanel />
          <BgPicker />
        </>
      )}
    </div>
  );
}
