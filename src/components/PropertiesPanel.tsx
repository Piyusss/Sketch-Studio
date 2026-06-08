import React, { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useIsMobile } from '../hooks/useIsMobile';
import { useCanvasStore } from '../store/canvasStore';
import type { CanvasObject, RectObject, EllipseObject, DiamondObject, TextObject, ArrowObject, ArrowHead, PenObject, StrokeStyle } from '../types';
import { spatialIndex } from '../engine/spatialIndex';
import { computeArrowBBox } from '../utils/math';
import { measureTextBox } from '../utils/textMetrics';
import { ColorPicker } from './ColorPicker';
import { FONT_FAMILIES, FONT_CATEGORIES } from '../lib/fonts';

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: 'var(--text-faint)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px',
  border: '1px solid var(--panel-border)', borderRadius: 5,
  fontSize: 13, color: 'var(--text-primary)', background: 'var(--input-bg)',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const row2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
};

function NumInput({
  label: labelText,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={label}>{labelText}</div>
      <input
        type="number"
        style={inputStyle}
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function ColorInput({
  label: labelText,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div style={label}>{labelText}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="color"
          value={value.startsWith('#') ? value : '#374151'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
        />
        <input
          type="text"
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// Fill with an enable/disable toggle — defaults to 'none' (no fill)
function FillInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const enabled = value !== 'none';
  const colorVal = enabled ? value : 'var(--active-fg)';

  function toggle() {
    onChange(enabled ? 'none' : colorVal);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={label}>Fill</div>
        <button
          onClick={toggle}
          title={enabled ? 'Remove fill' : 'Add fill'}
          style={{
            fontSize: 10, fontWeight: 600,
            padding: '1px 7px', borderRadius: 4,
            border: '1px solid var(--panel-border)',
            background: enabled ? 'var(--active-bg)' : 'var(--hover-bg)',
            color: enabled ? 'var(--active-fg)' : 'var(--text-muted)',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={value.startsWith('#') ? value : 'var(--active-fg)'}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
          />
          <input
            type="text"
            style={{ ...inputStyle, flex: 1 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 5,
          border: '1px dashed var(--panel-border)', background: 'var(--input-bg)',
        }}>
          {/* No-fill crossed swatch */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <rect x="1" y="1" width="16" height="16" rx="3" fill="var(--hover-bg)" stroke="#D4D4D8" strokeWidth="1"/>
            <line x1="2" y1="2" x2="16" y2="16" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No fill</span>
        </div>
      )}
    </div>
  );
}

function StrokeInput({
  color,
  width,
  onColorChange,
  onWidthChange,
}: {
  color: string;
  width: number;
  onColorChange: (v: string) => void;
  onWidthChange: (v: number) => void;
}) {
  const enabled = color !== 'none';
  const colorVal = enabled ? color : '#374151';

  function toggle() {
    if (enabled) {
      onColorChange('none');
    } else {
      onColorChange(colorVal);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={label}>Border</div>
        <button
          onClick={toggle}
          title={enabled ? 'Remove border' : 'Add border'}
          style={{
            fontSize: 10, fontWeight: 600,
            padding: '1px 7px', borderRadius: 4,
            border: '1px solid var(--panel-border)',
            background: enabled ? 'var(--active-bg)' : 'var(--hover-bg)',
            color: enabled ? 'var(--active-fg)' : 'var(--text-muted)',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Color row */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="color"
              value={color.startsWith('#') ? color : '#374151'}
              onChange={(e) => onColorChange(e.target.value)}
              style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            />
            <input
              type="text"
              style={{ ...inputStyle, flex: 1 }}
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
            />
          </div>
          {/* Width row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>Width</span>
            <input
              type="range"
              min={0.5} max={20} step={0.5}
              value={width}
              onChange={(e) => onWidthChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 24, textAlign: 'right' }}>{width}</span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 5,
          border: '1px dashed var(--panel-border)', background: 'var(--input-bg)',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <rect x="1" y="1" width="16" height="16" rx="3" fill="var(--hover-bg)" stroke="#D4D4D8" strokeWidth="1"/>
            <line x1="2" y1="2" x2="16" y2="16" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No border</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const mobile = useIsMobile();
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  // Subscribe only to the selected objects themselves (shallow-compared), not
  // the whole map — otherwise every object anywhere moving (e.g. drags, frame
  // children riding along) would re-render this entire panel on every tick.
  // `s.objects[id]` keeps its reference for untouched objects, so shallow
  // equality only sees a change when one of *these* objects actually changed.
  const selected = useCanvasStore(
    useShallow((s) => selectedIds.map((id) => s.objects[id]).filter((o): o is CanvasObject => !!o)),
  );
  const updateObject = useCanvasStore((s) => s.updateObject);
  const penRecentColors = useCanvasStore((s) => s.penRecentColors);

  const update = useCallback(
    (updates: Partial<CanvasObject>) => {
      selectedIds.forEach((id) => {
        updateObject(id, updates);
        const obj = useCanvasStore.getState().getObject(id);
        if (obj) spatialIndex.insert(obj);
      });
    },
    [selectedIds, updateObject],
  );

  if (selected.length === 0) return null;

  const first = selected[0];
  const allSameType = selected.every((o) => o.type === first.type);

  const avg = (key: keyof CanvasObject) => {
    const vals = selected.map((o) => o[key] as number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const panelStyle: React.CSSProperties = mobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        width: '100%', maxHeight: '45vh',
        background: 'var(--panel-bg)', border: 'none',
        borderTop: '1px solid var(--panel-border)',
        borderRadius: '16px 16px 0 0',
        padding: '12px 16px env(safe-area-inset-bottom, 0)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex: 200, fontFamily: 'Inter, system-ui, sans-serif',
        overflowY: 'auto', overflowX: 'hidden',
      }
    : {
        position: 'absolute', top: 16, right: 16,
        width: 220, background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)', borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        zIndex: 100, fontFamily: 'Inter, system-ui, sans-serif',
        maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', overflowX: 'hidden',
      };

  return (
    <div style={panelStyle}>
      {/* Size — text resizes only via its on-canvas handle, to keep the
          stored bbox in sync with the rendered glyphs */}
      {!(allSameType && first.type === 'text') && (
        <Section title="Size">
          <div style={row2}>
            <NumInput label="W" value={avg('width')} onChange={(v) => update({ width: Math.max(1, v) })} />
            <NumInput label="H" value={avg('height')} onChange={(v) => update({ height: Math.max(1, v) })} />
          </div>
        </Section>
      )}

      {/* Appearance */}
      {allSameType && (first.type === 'rect' || first.type === 'ellipse' || first.type === 'diamond') && (
        <Section title="Appearance">
          <FillInput
            value={(first as RectObject | EllipseObject | DiamondObject).fill}
            onChange={(v) => update({ fill: v } as Partial<CanvasObject>)}
          />
          <StrokeInput
            color={(first as RectObject | EllipseObject | DiamondObject).stroke}
            width={(first as RectObject | EllipseObject | DiamondObject).strokeWidth}
            onColorChange={(v) => update({ stroke: v } as Partial<CanvasObject>)}
            onWidthChange={(v) => update({ strokeWidth: Math.max(0, v) } as Partial<CanvasObject>)}
          />
          {first.type === 'rect' && (
            <NumInput
              label="Corner radius"
              value={(first as RectObject).cornerRadius}
              onChange={(v) => update({ cornerRadius: Math.max(0, v) } as Partial<CanvasObject>)}
            />
          )}
        </Section>
      )}

      {allSameType && first.type === 'text' && (() => {
        const t = first as TextObject;
        const syncDefaults = (changes: Partial<TextObject>) => {
          const s = useCanvasStore.getState();
          if (changes.fontFamily !== undefined) s.setTextFontFamily(changes.fontFamily);
          if (changes.fontSize    !== undefined) s.setTextFontSize(changes.fontSize);
          if (changes.fontWeight  !== undefined) s.setTextFontWeight(changes.fontWeight);
          if (changes.color       !== undefined) s.setTextColor(changes.color);
          if (changes.align       !== undefined) s.setTextAlign(changes.align as 'left' | 'center' | 'right');
        };
        const upd = (changes: Partial<TextObject>) => {
          // Font/line-height changes shift glyph layout — recompute the bbox
          // so the selection outline keeps hugging the rendered text instead
          // of drifting out of sync with it.
          const metricKeys: (keyof TextObject)[] = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'];
          let next = changes;
          if (metricKeys.some((k) => k in changes)) {
            const merged = { ...t, ...changes };
            next = { ...changes, ...measureTextBox(merged) };
          }
          update(next as Partial<CanvasObject>);
          syncDefaults(changes);
        };

        const fontsByCategory = FONT_CATEGORIES.map((cat) => ({
          cat,
          fonts: FONT_FAMILIES.filter((f) => f.category === cat),
        }));

        const WEIGHTS = [
          { label: 'Thin',       value: 100 },
          { label: 'Light',      value: 300 },
          { label: 'Regular',    value: 400 },
          { label: 'Medium',     value: 500 },
          { label: 'Semi-bold',  value: 600 },
          { label: 'Bold',       value: 700 },
          { label: 'Black',      value: 900 },
        ];

        return (
          <Section title="Text">
            {/* Font family */}
            <div>
              <div style={label}>Font</div>
              <select
                value={t.fontFamily}
                onChange={(e) => upd({ fontFamily: e.target.value })}
                style={{ ...inputStyle, fontFamily: t.fontFamily }}
              >
                {fontsByCategory.map(({ cat, fonts }) => (
                  <optgroup key={cat} label={cat}>
                    {fonts.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Size + Weight */}
            <div style={row2}>
              <NumInput
                label="Size"
                value={t.fontSize}
                onChange={(v) => upd({ fontSize: Math.max(1, v) })}
              />
              <div>
                <div style={label}>Weight</div>
                <select
                  value={t.fontWeight}
                  onChange={(e) => upd({ fontWeight: Number(e.target.value) })}
                  style={inputStyle}
                >
                  {WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color */}
            <div>
              <div style={label}>Color</div>
              <ColorPicker
                value={t.color}
                onChange={(v) => upd({ color: v })}
              />
            </div>

            {/* Alignment */}
            <div>
              <div style={label}>Align</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => upd({ align: a })}
                    style={{
                      flex: 1, padding: '5px 0',
                      border: `1px solid ${t.align === a ? 'var(--active-fg)' : 'var(--panel-border)'}`,
                      borderRadius: 5, fontSize: 12, cursor: 'pointer',
                      background: t.align === a ? 'var(--active-bg)' : 'var(--input-bg)',
                      color: t.align === a ? 'var(--active-fg)' : 'var(--text-secondary)',
                      fontWeight: t.align === a ? 600 : 400,
                    }}
                  >
                    {a === 'left' ? '← Left' : a === 'center' ? '≡ Center' : '→ Right'}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        );
      })()}

      {/* Pen */}
      {allSameType && first.type === 'pen' && (() => {
        const pen = first as PenObject;
        const store = useCanvasStore.getState();

        const updatePen = (changes: Partial<PenObject>) => {
          selectedIds.forEach((id) => {
            updateObject(id, changes as Partial<CanvasObject>);
            const obj = useCanvasStore.getState().getObject(id);
            if (obj) spatialIndex.insert(obj);
          });
          // Sync to active pen settings so next stroke inherits the same style
          if (changes.color !== undefined) { store.setPenColor(changes.color); store.addRecentPenColor(changes.color); }
          if (changes.strokeWidth !== undefined) store.setPenWidth(changes.strokeWidth);
          if (changes.strokeStyle !== undefined) store.setPenStyle(changes.strokeStyle as StrokeStyle);
        };

        const STYLE_OPTS: { id: StrokeStyle; label: string }[] = [
          { id: 'solid', label: '—' },
          { id: 'dashed', label: '- -' },
          { id: 'dotted', label: '···' },
        ];

        return (
          <Section title="Pen">
            <ColorPicker
              value={pen.color}
              onChange={(c) => updatePen({ color: c })}
              recentColors={penRecentColors}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>Width</span>
              <input type="range" min={0.5} max={24} step={0.5} value={pen.strokeWidth}
                onChange={(e) => updatePen({ strokeWidth: parseFloat(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'right' }}>{pen.strokeWidth}</span>
            </div>
            <div>
              <div style={label}>Style</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STYLE_OPTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updatePen({ strokeStyle: s.id })}
                    style={{
                      flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer',
                      border: '1px solid ' + (pen.strokeStyle === s.id ? 'var(--accent)' : 'var(--panel-border)'),
                      borderRadius: 5, letterSpacing: '0.05em',
                      background: pen.strokeStyle === s.id ? 'var(--active-bg)' : 'var(--input-bg)',
                      color: pen.strokeStyle === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: pen.strokeStyle === s.id ? 600 : 400,
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          </Section>
        );
      })()}

      {/* Arrow */}
      {allSameType && first.type === 'arrow' && (() => {
        const arr = first as ArrowObject;
        const updateArrow = (changes: Partial<ArrowObject>) => {
          selectedIds.forEach((id) => {
            const obj = useCanvasStore.getState().getObject(id) as ArrowObject | undefined;
            if (!obj || obj.type !== 'arrow') return;
            const merged = { ...obj, ...changes };
            const bbox = computeArrowBBox(merged.x1, merged.y1, merged.x2, merged.y2, merged.curved, merged.bendOffset);
            updateObject(id, { ...changes, ...bbox } as Partial<CanvasObject>);
            const updated = useCanvasStore.getState().getObject(id);
            if (updated) spatialIndex.insert(updated);
          });
        };

        const HeadBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
          <button onClick={onClick} style={{
            flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer',
            border: '1px solid ' + (active ? 'var(--active-fg)' : 'var(--panel-border)'), borderRadius: 5,
            background: active ? 'var(--active-bg)' : 'var(--input-bg)',
            color: active ? 'var(--active-fg)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400,
          }}>{label}</button>
        );

        return (
          <Section title="Arrow">
            <ColorInput label="Color" value={arr.stroke} onChange={(v) => updateArrow({ stroke: v })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>Width</span>
              <input type="range" min={0.5} max={20} step={0.5} value={arr.strokeWidth}
                onChange={(e) => updateArrow({ strokeWidth: parseFloat(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 24, textAlign: 'right' }}>{arr.strokeWidth}</span>
            </div>
            <div>
              <div style={label}>Curve</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['Straight', false], ['Curved', true]] as [string, boolean][]).map(([lbl, val]) => (
                  <HeadBtn key={lbl} label={lbl} active={arr.curved === val} onClick={() => updateArrow({ curved: val, bendOffset: val ? (arr.bendOffset || 60) : 0 })} />
                ))}
              </div>
            </div>
            {arr.curved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>Bend</span>
                <input type="range" min={-200} max={200} step={5} value={arr.bendOffset}
                  onChange={(e) => updateArrow({ bendOffset: parseFloat(e.target.value) })}
                  style={{ flex: 1 }} />
              </div>
            )}
            <div>
              <div style={label}>Start</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['none', 'arrow', 'dot'] as ArrowHead[]).map((h) => (
                  <HeadBtn key={h} label={h === 'none' ? '–' : h === 'arrow' ? '▶' : '●'} active={arr.startHead === h} onClick={() => updateArrow({ startHead: h })} />
                ))}
              </div>
            </div>
            <div>
              <div style={label}>End</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['none', 'arrow', 'dot'] as ArrowHead[]).map((h) => (
                  <HeadBtn key={h} label={h === 'none' ? '–' : h === 'arrow' ? '▶' : '●'} active={arr.endHead === h} onClick={() => updateArrow({ endHead: h })} />
                ))}
              </div>
            </div>
          </Section>
        );
      })()}

      {/* Frame */}
      {allSameType && first.type === 'frame' && (() => {
        const frame = first as import('../types').FrameObject;
        return (
          <Section title="Frame">
            <div>
              <div style={label}>Name</div>
              <input
                type="text"
                style={inputStyle}
                value={frame.name}
                onChange={(e) => update({ name: e.target.value } as Partial<CanvasObject>)}
                placeholder="Frame name"
              />
            </div>
            <FillInput
              value={frame.fill}
              onChange={(v) => update({ fill: v } as Partial<CanvasObject>)}
            />
            <StrokeInput
              color={frame.stroke}
              width={frame.strokeWidth}
              onColorChange={(v) => update({ stroke: v } as Partial<CanvasObject>)}
              onWidthChange={(v) => update({ strokeWidth: Math.max(0, v) } as Partial<CanvasObject>)}
            />
          </Section>
        );
      })()}

      {/* Opacity */}
      <Section title="Opacity">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range" min={0} max={1} step={0.01}
            value={avg('opacity')}
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 30 }}>
            {Math.round(avg('opacity') * 100)}%
          </span>
        </div>
      </Section>
    </div>
  );
}
