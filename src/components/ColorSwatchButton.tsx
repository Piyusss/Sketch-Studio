import React, { useEffect, useRef, useState } from 'react';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '../utils/color';

// ── Custom HSV picker panel ────────────────────────────────────────────────────

const SQUARE_W = 188;
const SQUARE_H = 124;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function HsvPanel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(value) ?? { r: 55, g: 65, b: 81 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync from external value changes (e.g. hex typed directly), but don't fight
  // the user mid-drag — only resync when the prop no longer matches our HSV
  // (preserves hue/saturation when value collapses to black/white/gray).
  useEffect(() => {
    const rgb = hexToRgb(value);
    if (!rgb) return;
    const derived = hsvToRgb(hsv.h, hsv.s, hsv.v);
    if (rgbToHex(derived.r, derived.g, derived.b).toLowerCase() !== value.toLowerCase()) {
      setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(next: { h: number; s: number; v: number }) {
    setHsv(next);
    const rgb = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  }

  function dragSquare(e: React.PointerEvent) {
    const el = squareRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    function update(ev: PointerEvent | React.PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const s = clamp01((ev.clientX - rect.left) / rect.width);
      const v = clamp01(1 - (ev.clientY - rect.top) / rect.height);
      commit({ h: hsv.h, s, v });
    }
    update(e);
    function move(ev: PointerEvent) { update(ev); }
    function up(ev: PointerEvent) {
      el!.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function dragHue(e: React.PointerEvent) {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    function update(ev: PointerEvent | React.PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const h = clamp01((ev.clientX - rect.left) / rect.width) * 360;
      commit({ h, s: hsv.s, v: hsv.v });
    }
    update(e);
    function move(ev: PointerEvent) { update(ev); }
    function up(ev: PointerEvent) {
      el!.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  function setChannel(channel: 'r' | 'g' | 'b', raw: number) {
    const v = Math.max(0, Math.min(255, Math.round(raw) || 0));
    const next = { ...rgb, [channel]: v };
    setHsv(rgbToHsv(next.r, next.g, next.b));
    onChange(rgbToHex(next.r, next.g, next.b));
  }

  function setHex(raw: string) {
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) onChange(hex.toUpperCase());
  }

  const channelInput: React.CSSProperties = {
    flex: '1 1 0%', minWidth: 0, padding: '4px 0', textAlign: 'center',
    border: '1px solid var(--panel-border)', borderRadius: 5,
    fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: SQUARE_W }}>
      {/* Saturation / value square */}
      <div
        ref={squareRef}
        onPointerDown={dragSquare}
        style={{
          position: 'relative', width: SQUARE_W, height: SQUARE_H,
          borderRadius: 8, cursor: 'crosshair', touchAction: 'none',
          background: `linear-gradient(to top, #000, transparent),
                       linear-gradient(to right, #fff, transparent),
                       ${hueColor}`,
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`,
          width: 14, height: 14, borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.3)',
          background: rgbToHex(rgb.r, rgb.g, rgb.b),
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onPointerDown={dragHue}
        style={{
          position: 'relative', width: '100%', height: 12,
          borderRadius: 6, cursor: 'pointer', touchAction: 'none',
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <div style={{
          position: 'absolute', top: '50%',
          left: `${(hsv.h / 360) * 100}%`,
          width: 16, height: 16, borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.3)',
          background: hueColor,
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hex + RGB */}
      <div style={{ display: 'flex', gap: 5 }}>
        <input
          type="text"
          value={rgbToHex(rgb.r, rgb.g, rgb.b)}
          maxLength={7}
          onChange={(e) => setHex(e.target.value)}
          style={{ ...channelInput, flex: '1.5 1 0%', textAlign: 'left', padding: '4px 7px' }}
        />
        {(['r', 'g', 'b'] as const).map((ch) => (
          <input
            key={ch}
            type="number"
            min={0}
            max={255}
            value={rgb[ch] === undefined ? 0 : Math.round(rgb[ch])}
            onChange={(e) => setChannel(ch, parseFloat(e.target.value))}
            style={channelInput}
          />
        ))}
      </div>
    </div>
  );
}

// ── Swatch button + popover ────────────────────────────────────────────────────

interface ColorSwatchButtonProps {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
  style?: React.CSSProperties;
}

export function ColorSwatchButton({ value, onChange, size = 28, style }: ColorSwatchButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const safeValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#374151';

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

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Pick color"
        style={{
          width: size, height: size, borderRadius: 6,
          background: safeValue, border: 'none', padding: 0, cursor: 'pointer',
          boxShadow: open ? '0 0 0 2px var(--active-fg)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
          ...style,
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: `calc(100% + 8px)`, left: 0, zIndex: 200,
          background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
          borderRadius: 12, boxShadow: 'var(--panel-shadow-lg)', padding: 12,
        }}>
          <HsvPanel value={safeValue} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
