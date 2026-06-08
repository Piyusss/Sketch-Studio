import React from 'react';
import { ColorSwatchButton } from './ColorSwatchButton';

export const PRESET_COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#A16207', '#06B6D4', '#FFFFFF',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  recentColors?: string[];
}

export function ColorPicker({ value, onChange, recentColors = [] }: ColorPickerProps) {
  const safeValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#374151';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Swatch + hex input */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ColorSwatchButton value={safeValue} onChange={onChange} />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
              onChange(v.startsWith('#') ? v : '#' + v);
            }
          }}
          style={{
            flex: 1, padding: '4px 6px',
            border: '1px solid #E4E4E7', borderRadius: 5,
            fontSize: 12, color: '#18181B', background: '#FAFAFA',
            outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Preset palette — 2 rows × 8 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
        {PRESET_COLORS.map((c) => (
          <div
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              aspectRatio: '1', borderRadius: 4, cursor: 'pointer',
              background: c,
              border: value.toLowerCase() === c.toLowerCase()
                ? '2.5px solid #3B82F6'
                : c === '#FFFFFF' ? '1px solid #E4E4E7' : '1px solid transparent',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>

      {/* Recently used */}
      {recentColors.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#A1A1AA',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
          }}>Recent</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {recentColors.map((c, i) => (
              <div
                key={i}
                onClick={() => onChange(c)}
                title={c}
                style={{
                  width: 20, height: 20, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                  background: c,
                  border: value.toLowerCase() === c.toLowerCase()
                    ? '2px solid #3B82F6'
                    : c === '#FFFFFF' ? '1px solid #E4E4E7' : '1px solid rgba(0,0,0,0.1)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
