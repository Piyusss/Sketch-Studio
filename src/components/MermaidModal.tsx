import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import type { Camera, CanvasObject } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { canvasSM } from './Canvas';
import { spatialIndex } from '../engine/spatialIndex';
import { historyManager } from '../history/historyManager';
import { drawObjects } from '../engine/renderer';
import { buildDiagramObjects, DEFAULT_MERMAID } from '../lib/mermaid';

interface MermaidModalProps {
  onClose: () => void;
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length < 6) return 1;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Diagram colors chosen so they stay visible on the current canvas background
function diagramColors(canvasBg: string) {
  return luminance(canvasBg) < 128
    ? { stroke: '#E5E7EB', fill: 'rgba(255,255,255,0.06)', text: '#F4F4F5' }
    : { stroke: '#1E1E1E', fill: '#FFFFFF', text: '#1E1E1E' };
}

export function MermaidModal({ onClose }: MermaidModalProps) {
  const [code, setCode] = useState(DEFAULT_MERMAID);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canvasBg = useCanvasStore((s) => s.canvasBg);

  // ── Preview rendering ───────────────────────────────────────────────────────
  const renderPreview = useCallback(() => {
    const canvas = previewRef.current;
    const wrap = previewWrapRef.current;
    if (!canvas || !wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (W === 0 || H === 0) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, W, H);

    const built = buildDiagramObjects(code, { colors: diagramColors(canvasBg), canvasBg });
    setError(built.error);
    setEmpty(!built.error && built.objects.length === 0);
    if (built.error || !built.objects.length || !built.bbox) return;

    const { minX, minY, maxX, maxY } = built.bbox;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const pad = 48;
    const zoom = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 1.4);
    const cam: Camera = {
      x: (minX + maxX) / 2 - W / 2 / zoom,
      y: (minY + maxY) / 2 - H / 2 / zoom,
      zoom,
      targetX: 0, targetY: 0, targetZoom: zoom,
    };
    const map: Record<string, CanvasObject> = {};
    for (const o of built.objects) map[o.id] = o;
    const sorted = built.objects.slice().sort((a, b) => a.zIndex - b.zIndex);
    drawObjects(ctx, sorted, cam, W, H, map);
  }, [code, canvasBg]);

  useEffect(() => { renderPreview(); }, [renderPreview]);

  // Re-render preview when the wrapper resizes
  useEffect(() => {
    const wrap = previewWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => renderPreview());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderPreview]);

  // ── Insert into canvas ────────────────────────────────────────────────────────
  const handleInsert = useCallback(() => {
    const store = useCanvasStore.getState();
    // Use the live camera from the canvas state machine — store.camera is
    // never synced back from the RAF loop so it would always be the initial value.
    const cam: Camera = canvasSM.ref?.currentCamera ?? store.camera;

    const probe = buildDiagramObjects(code, { colors: diagramColors(store.canvasBg), canvasBg: store.canvasBg });
    if (probe.error || !probe.objects.length || !probe.bbox) return;

    // Center the diagram on the current viewport
    const viewCX = cam.x + window.innerWidth  / 2 / cam.zoom;
    const viewCY = cam.y + window.innerHeight / 2 / cam.zoom;
    const dgCX = (probe.bbox.minX + probe.bbox.maxX) / 2;
    const dgCY = (probe.bbox.minY + probe.bbox.maxY) / 2;

    const maxZ = Math.max(0, ...Object.values(store.objects).map((o) => o.zIndex));
    const built = buildDiagramObjects(code, {
      offsetX: viewCX - dgCX,
      offsetY: viewCY - dgCY,
      baseZIndex: maxZ + 1,
      colors: diagramColors(store.canvasBg),
      canvasBg: store.canvasBg,
    });
    const objs = built.objects;
    if (!objs.length) return;

    historyManager.push({
      description: 'Insert Mermaid diagram',
      execute: () => {
        for (const o of objs) { useCanvasStore.getState().addObject(o); spatialIndex.insert(o); }
      },
      undo: () => {
        for (const o of objs) {
          useCanvasStore.getState().removeObject(o.id);
          spatialIndex.remove(o.id);
          useCanvasStore.getState().removeFromSelection(o.id);
        }
      },
    });
    for (const o of objs) { store.addObject(o); spatialIndex.insert(o); }
    store.setSelectedIds(objs.map((o) => o.id));
    store.setActiveTool('select');
    onClose();
  }, [code, onClose]);

  // Keyboard: Esc closes, Ctrl/Cmd+Enter inserts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleInsert(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleInsert]);

  const lineCount = code.split('\n').length;

  return ReactDOM.createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(8,8,12,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(1120px, 92vw)', height: 'min(680px, 88vh)',
          background: '#16161C', border: '1px solid #2A2A35',
          borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          color: '#E5E7EB',
        }}
      >
        {/* Header / tabs */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 22,
          padding: '0 22px', height: 52, borderBottom: '1px solid #26262F', flexShrink: 0,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#fff',
            borderBottom: '2px solid #8B7CF6', height: 52,
            display: 'flex', alignItems: 'center',
          }}>
            Mermaid
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              border: 'none', background: 'transparent', color: '#9CA3AF',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; }}
          >
            ×
          </button>
        </div>

        {/* Subtitle */}
        <div style={{ padding: '12px 22px 0', fontSize: 12.5, color: '#9CA3AF', flexShrink: 0 }}>
          Paste <span style={{ color: '#A5B4FC' }}>Mermaid flowchart</span> syntax below — it renders into
          editable canvas elements. Supported: <span style={{ color: '#CBD5E1' }}>nodes</span> (rectangle,
          rounded, circle, diamond, stadium) and <span style={{ color: '#CBD5E1' }}>edges</span> (→, labels,
          dotted/thick).
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', gap: 0, padding: 18, minHeight: 0 }}>
          {/* Editor */}
          <div style={{
            flex: 1, display: 'flex', minWidth: 0,
            background: '#0E0E13', border: '1px solid #26262F', borderRadius: 10,
            overflow: 'hidden',
          }}>
            {/* Line numbers */}
            <div style={{
              padding: '12px 8px 12px 12px', textAlign: 'right',
              color: '#52525B', fontSize: 13, lineHeight: '20px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              userSelect: 'none', flexShrink: 0,
              background: '#101017',
            }}>
              {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              autoFocus
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                background: 'transparent', color: '#E2E8F0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13, lineHeight: '20px', padding: '12px 14px',
                whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto',
              }}
            />
          </div>

          {/* Preview */}
          <div
            ref={previewWrapRef}
            style={{
              flex: 1, marginLeft: 18, minWidth: 0, position: 'relative',
              borderRadius: 10, overflow: 'hidden', border: '1px solid #26262F',
            }}
          >
            <canvas ref={previewRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            {error && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 24,
                color: '#F87171', fontSize: 13, textAlign: 'center',
              }}>
                {error}
              </div>
            )}
            {empty && !error && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#71717A', fontSize: 13,
              }}>
                Start typing a flowchart to see the preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '0 22px 18px', flexShrink: 0,
        }}>
          <button
            onClick={handleInsert}
            disabled={!!error || empty}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 9, border: 'none',
              background: (error || empty) ? '#3A3A45' : '#8B7CF6',
              color: (error || empty) ? '#71717A' : '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: (error || empty) ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { if (!error && !empty) (e.currentTarget as HTMLElement).style.background = '#7C6CF0'; }}
            onMouseLeave={(e) => { if (!error && !empty) (e.currentTarget as HTMLElement).style.background = '#8B7CF6'; }}
          >
            Insert →
          </button>
          <span style={{ fontSize: 11, color: '#71717A', display: 'flex', gap: 4 }}>
            <kbd style={kbdStyle}>Ctrl</kbd>
            <kbd style={kbdStyle}>Enter</kbd>
          </span>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

const kbdStyle: React.CSSProperties = {
  background: '#26262F', border: '1px solid #3A3A45', borderRadius: 4,
  padding: '1px 6px', fontSize: 10, color: '#9CA3AF',
  fontFamily: 'ui-monospace, monospace',
};
