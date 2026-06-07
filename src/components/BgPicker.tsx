import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { CanvasGridStyle } from '../types';

// ── Color palette ─────────────────────────────────────────────────────────────

const PALETTE: { label: string; value: string; group: string }[] = [
  { label: 'Snow',      value: '#FFFFFF',  group: 'Neutral' },
  { label: 'Parchment', value: '#F7F7F8',  group: 'Neutral' },
  { label: 'Mist',      value: '#EBEBEF',  group: 'Neutral' },
  { label: 'Smoke',     value: '#D8D8DF',  group: 'Neutral' },
  { label: 'Rose',      value: '#FFF5F7',  group: 'Warm' },
  { label: 'Blush',     value: '#FFE8ED',  group: 'Warm' },
  { label: 'Butter',    value: '#FFFDE8',  group: 'Warm' },
  { label: 'Cream',     value: '#FFF8E1',  group: 'Warm' },
  { label: 'Slate',     value: '#4B4B5A',  group: 'Dark' },
  { label: 'Graphite',  value: '#2E2E3A',  group: 'Dark' },
  { label: 'Obsidian',  value: '#1C1C26',  group: 'Dark' },
  { label: 'Void',      value: '#111118',  group: 'Dark' },
  { label: 'Carbon',    value: '#101010',  group: 'Dark' },
  { label: 'Pitch',     value: '#070709',  group: 'Dark' },
];

function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// ── Grid style options ─────────────────────────────────────────────────────────

const GRID_OPTIONS: { id: CanvasGridStyle; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dots',
    label: 'Dots',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {([6, 14, 22] as number[]).flatMap((x) =>
          ([6, 14, 22] as number[]).map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />
          )),
        )}
      </svg>
    ),
  },
  {
    id: 'grid',
    label: 'Grid',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {([7, 14, 21] as number[]).map((x) => (
          <line key={`v${x}`} x1={x} y1="2" x2={x} y2="26" stroke="currentColor" strokeWidth="0.9" />
        ))}
        {([7, 14, 21] as number[]).map((y) => (
          <line key={`h${y}`} x1="2" y1={y} x2="26" y2={y} stroke="currentColor" strokeWidth="0.9" />
        ))}
      </svg>
    ),
  },
  {
    id: 'none',
    label: 'Plain',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="3" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 2" />
      </svg>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function BgPicker() {
  const canvasBg   = useCanvasStore((s) => s.canvasBg);
  const setCanvasBg = useCanvasStore((s) => s.setCanvasBg);
  const canvasGrid  = useCanvasStore((s) => s.canvasGrid);
  const setCanvasGrid = useCanvasStore((s) => s.setCanvasGrid);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const light = isLight(canvasBg);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', bottom: 16, left: 16,
        zIndex: 100, fontFamily: 'Inter, system-ui, sans-serif', userSelect: 'none',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Canvas background & grid"
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: '1.5px solid rgba(0,0,0,0.12)',
          background: canvasBg, cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.35)' : '0 1px 4px rgba(0,0,0,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, transition: 'box-shadow 0.15s', position: 'relative',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke={light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.2" fill="none"/>
          <circle cx="5.5" cy="6"   r="1.4" fill="#EF4444"/>
          <circle cx="10.5" cy="6"  r="1.4" fill="#22C55E"/>
          <circle cx="8"    cy="11" r="1.4" fill="#3B82F6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 40, left: 0,
          background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
          borderRadius: 12, boxShadow: 'var(--panel-shadow-lg)',
          padding: '12px 14px', width: 236,
        }}>

          {/* Grid style */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Background style
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {GRID_OPTIONS.map((opt) => {
              const active = canvasGrid === opt.id;
              return (
                <button
                  key={opt.id}
                  title={opt.label}
                  onClick={() => setCanvasGrid(opt.id)}
                  style={{
                    flex: 1, padding: '8px 4px 6px',
                    borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--active-fg)' : 'var(--panel-border)'}`,
                    background: active ? 'var(--active-bg)' : 'var(--panel-bg-2)',
                    color: active ? 'var(--active-fg)' : 'var(--text-faint)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'border-color 0.1s, background 0.1s',
                    outline: 'none',
                  }}
                >
                  {opt.icon}
                  <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--divider)', marginBottom: 12 }} />

          {/* Color label */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Canvas color
          </div>

          {/* Grouped swatches */}
          {(['Neutral', 'Warm', 'Dark'] as const).map((group) => {
            const swatches = PALETTE.filter((s) => s.group === group);
            return (
              <div key={group} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 5, letterSpacing: '0.04em' }}>
                  {group}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {swatches.map((swatch) => {
                    const active = canvasBg === swatch.value;
                    return (
                      <button
                        key={swatch.value}
                        title={swatch.label}
                        onClick={() => { setCanvasBg(swatch.value); }}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: swatch.value,
                          border: active
                            ? '2.5px solid var(--active-fg)'
                            : (isLight(swatch.value) ? '1.5px solid var(--panel-border)' : '1.5px solid transparent'),
                          cursor: 'pointer', padding: 0, position: 'relative',
                          boxShadow: active ? '0 0 0 2px rgba(99,102,241,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                          transition: 'transform 0.1s', flexShrink: 0, outline: 'none',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                      >
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 12 12"
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
                            <path d="M2 6L5 9L10 3" stroke={isLight(swatch.value) ? '#18181B' : '#fff'}
                              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Current color label */}
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: canvasBg, border: '1px solid var(--panel-border)', flexShrink: 0 }} />
            {PALETTE.find((s) => s.value === canvasBg)?.label ?? 'Custom'}
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11 }}>{canvasBg.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
