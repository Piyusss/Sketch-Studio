import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { UserMenu } from './UserMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import { Link } from 'react-router-dom';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11 } },
};

// ── Shared window chrome ─────────────────────────────────────────────────────

function WindowChrome({
  children,
  bar,
}: {
  children: React.ReactNode;
  bar?: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid #E4E4E7',
      boxShadow: '0 24px 56px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      background: '#fff',
    }}>
      <div style={{
        height: 40, background: '#FAFAFA', borderBottom: '1px solid #F0F0F0',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6,
      }}>
        {(['#FF5F57', '#FFBD2E', '#28C840'] as const).map((color) => (
          <div key={color} style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        ))}
        {bar && <div style={{ marginLeft: 10, flex: 1 }}>{bar}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Dot grid (reused across mockups) ────────────────────────────────────────

function DotGrid({ id }: { id: string }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill="#D4D4D8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

// ── Canvas Mockup — Infinite Canvas with Zoom ────────────────────────────────
// Communicates: vast/boundless workspace + zoom navigation

function CanvasMockup() {
  // Nodes at varying opacities to suggest the canvas extends infinitely in all directions
  const nodes: { top?: number; bottom?: number; left?: number; right?: number; label: string; opacity: number; size: number }[] = [
    { top: 68, left: 60,  label: 'System Design',  opacity: 1,    size: 11 },
    { top: 130, left: 190, label: 'API Layer',     opacity: 0.9,  size: 11 },
    { top: 26, right: 90,  label: 'Roadmap',       opacity: 0.5,  size: 10 },
    { top: 190, left: 30,  label: 'Planning',      opacity: 0.35, size: 10 },
    { top: 200, right: 50, label: 'Q3 Goals',      opacity: 0.25, size: 10 },
    { top: 50, left: 290,  label: 'Infra',         opacity: 0.45, size: 10 },
  ];

  return (
    <WindowChrome>
      <div style={{ position: 'relative', height: 300, background: '#FAFAFA', overflow: 'hidden' }}>
        <DotGrid id="lp-canvas-dots" />

        {/* Nodes — nearer ones are sharp, distant ones fade out */}
        {nodes.map((n) => (
          <div key={n.label} style={{
            position: 'absolute',
            top: n.top, bottom: n.bottom, left: n.left, right: n.right,
            background: '#fff', border: '1.5px solid #E4E4E7', borderRadius: 8,
            padding: '8px 18px',
            fontSize: n.size, fontWeight: 600, color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            opacity: n.opacity,
            whiteSpace: 'nowrap',
          }}>{n.label}</div>
        ))}

        {/* Connector between the two main nodes */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <line x1="175" y1="84" x2="208" y2="130" stroke="#D4D4D8" strokeWidth="1.2" strokeDasharray="5 3" />
        </svg>

        {/* ── Zoom slider — prominent, centred at bottom ── */}
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #E4E4E7', borderRadius: 9,
          padding: '7px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 2px 10px rgba(0,0,0,0.09)',
        }}>
          <span style={{ fontSize: 16, color: '#374151', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>−</span>
          {/* Slider track + thumb */}
          <div style={{ position: 'relative', width: 80, height: 4 }}>
            <div style={{ width: '100%', height: '100%', background: '#F0F0F0', borderRadius: 2 }} />
            {/* filled portion */}
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: '38%', height: '100%', background: '#3B82F6', borderRadius: 2,
            }} />
            {/* thumb */}
            <div style={{
              position: 'absolute', top: '50%', left: '38%',
              width: 12, height: 12, background: '#3B82F6', borderRadius: '50%',
              border: '2.5px solid #fff', boxShadow: '0 0 0 1.5px #3B82F6',
              transform: 'translate(-50%, -50%)',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#18181B', minWidth: 30 }}>38%</span>
          <span style={{ fontSize: 16, color: '#374151', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>+</span>
        </div>

        {/* ── Mini-map — top-right corner ── */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 84, height: 56,
          background: '#fff', border: '1px solid #E4E4E7', borderRadius: 7,
          overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: '#F8FAFB' }} />
          {/* Tiny node blocks representing distant canvas content */}
          {[
            [7,  6,  28, 7 ],
            [20, 20, 22, 7 ],
            [52, 8,  18, 6 ],
            [5,  36, 16, 6 ],
            [40, 30, 20, 6 ],
            [66, 28, 10, 5 ],
          ].map(([t, l, w, h], i) => (
            <div key={i} style={{
              position: 'absolute', top: t, left: l, width: w, height: h,
              background: '#D4D4D8', borderRadius: 2,
            }} />
          ))}
          {/* Current viewport rectangle */}
          <div style={{
            position: 'absolute', top: 5, left: 4,
            width: 42, height: 30,
            border: '1.5px solid #3B82F6',
            background: 'rgba(59,130,246,0.07)',
            borderRadius: 3,
          }} />
          <div style={{
            position: 'absolute', bottom: 3, right: 5,
            fontSize: 6.5, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.06em',
          }}>MAP</div>
        </div>

      </div>
    </WindowChrome>
  );
}

// ── Sync Mockup (replaces collab) ───────────────────────────────────────────

function SyncMockup() {
  return (
    <WindowChrome bar={
      <span style={{ fontSize: 11, color: '#71717A', fontWeight: 500 }}>All changes saved</span>
    }>
      <div style={{ position: 'relative', height: 300, background: '#FAFAFA', overflow: 'hidden' }}>
        <DotGrid id="lp-sync-dots" />

        {/* Central device mockup */}
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          width: 180, background: '#fff', border: '1.5px solid #E4E4E7',
          borderRadius: 12, padding: '14px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#09090B', marginBottom: 10 }}>System Overview</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {['Component A', 'Component B', 'Component C'].map((label, i) => (
              <div key={label} style={{
                height: 22, borderRadius: 4,
                background: i === 0 ? '#18181B' : '#F4F4F5',
                display: 'flex', alignItems: 'center', paddingLeft: 8,
              }}>
                <span style={{ fontSize: 10, color: i === 0 ? '#fff' : '#A1A1AA', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* IndexedDB badge */}
        <div style={{
          position: 'absolute', bottom: 54, left: 36,
          background: '#fff', border: '1px solid #E4E4E7',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <ellipse cx="7" cy="4" rx="5" ry="2" stroke="#A1A1AA" strokeWidth="1.2"/>
            <path d="M2 4v3c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="#A1A1AA" strokeWidth="1.2"/>
            <path d="M2 7v3c0 1.1 2.24 2 5 2s5-.9 5-2V7" stroke="#A1A1AA" strokeWidth="1.2"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B' }}>Local cache</span>
        </div>

        {/* Cloud badge */}
        <div style={{
          position: 'absolute', bottom: 54, right: 36,
          background: '#fff', border: '1px solid #E4E4E7',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10 9.5H11a3 3 0 000-6h-.27A4.5 4.5 0 102 8.24" stroke="#A1A1AA" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M7 9v4M5.5 11.5L7 13l1.5-1.5" stroke="#4ADE80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B' }}>Cloud sync</span>
        </div>

        {/* Connecting lines — endpoints sit exactly on box boundaries:
            • y1 = 300 (container) − 54 (bottom) − 30 (badge height) = 216  → top edge of each badge
            • y2 = 40 (card top) + 130 (card height)                  = 170  → bottom edge of central card
            • x values match badge centres and card bottom-left / bottom-right corners */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <motion.line x1="90" y1="216" x2="170" y2="170"
            stroke="#E4E4E7" strokeWidth="1.2" strokeDasharray="4 3"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }} />
          <motion.line x1="372" y1="216" x2="290" y2="170"
            stroke="#E4E4E7" strokeWidth="1.2" strokeDasharray="4 3"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }} />
        </svg>
      </div>
    </WindowChrome>
  );
}

// ── Tools / Editing Mockup ────────────────────────────────────────────────────

function ToolsMockup() {
  return (
    <WindowChrome>
      <div style={{ position: 'relative', height: 300, background: '#FAFAFA', overflow: 'hidden' }}>
        <DotGrid id="lp-tools-dots" />

        {/* Heading text element */}
        <div style={{
          position: 'absolute', top: 28, left: 44,
          fontSize: 13, fontWeight: 700, color: '#09090B',
          borderBottom: '2px solid #6366F1', paddingBottom: 2,
        }}>System Overview</div>

        {/* Rectangle */}
        <div style={{
          position: 'absolute', top: 64, left: 44,
          width: 106, height: 60, background: '#fff',
          border: '1.5px solid #E4E4E7', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#52525B' }}>API Service</span>
        </div>

        {/* Arrow rect → circle */}
        <svg style={{ position: 'absolute', top: 82, left: 152 }} width="58" height="24" overflow="visible">
          <defs>
            <marker id="tm-ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3z" fill="#D4D4D8" />
            </marker>
          </defs>
          <line x1="2" y1="12" x2="50" y2="12" stroke="#D4D4D8" strokeWidth="1.5" markerEnd="url(#tm-ah)" />
        </svg>

        {/* Circle */}
        <div style={{
          position: 'absolute', top: 64, left: 212,
          width: 60, height: 60, background: '#EFF6FF',
          border: '1.5px solid #93C5FD', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6' }}>Cache</span>
        </div>

        {/* Arrow circle → diamond */}
        <svg style={{ position: 'absolute', top: 82, left: 274 }} width="46" height="24" overflow="visible">
          <line x1="2" y1="12" x2="38" y2="12" stroke="#D4D4D8" strokeWidth="1.5" markerEnd="url(#tm-ah)" />
        </svg>

        {/* Diamond */}
        <div style={{
          position: 'absolute', top: 66, left: 322,
          width: 56, height: 56, background: '#FFF7ED',
          border: '1.5px solid #FED7AA', transform: 'rotate(45deg)',
        }}>
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-45deg)', fontSize: 9, fontWeight: 600, color: '#C2410C',
          }}>Logic</span>
        </div>

        {/* Pen stroke annotation */}
        <svg style={{ position: 'absolute', bottom: 46, left: 44 }} width="360" height="56">
          <path
            d="M 8 40 C 28 15, 52 8, 82 22 C 112 36, 130 46, 160 32 C 190 18, 210 12, 240 28 C 270 44, 295 50, 320 36"
            stroke="#374151" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.65"
          />
          <text x="120" y="54" fontSize="10" fill="#A1A1AA" fontFamily="Inter, sans-serif">freehand annotation</text>
        </svg>

        {/* Zoom pill */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: '#fff', border: '1px solid #E4E4E7', borderRadius: 6,
          padding: '3px 10px', fontSize: 11, color: '#71717A', fontWeight: 500,
        }}>100%</div>
      </div>
    </WindowChrome>
  );
}

// ── Mermaid Mockup ────────────────────────────────────────────────────────────

function MermaidMockup() {
  const lines = [
    { color: '#8B7CF6', text: 'flowchart TD' },
    { color: '#A5B4FC', text: '  A[Start]' },
    { color: '#E2E8F0', text: '  A --> B{Decision}' },
    { color: '#4ADE80', text: '  B -->|Yes| C[Done]' },
    { color: '#F87171', text: '  B -->|No|  A' },
  ];
  return (
    <WindowChrome bar={
      <span style={{ fontSize: 11, color: '#8B7CF6', fontWeight: 600 }}>Mermaid → Canvas</span>
    }>
      <div style={{ display: 'flex', height: 300 }}>
        {/* Code editor pane */}
        <div style={{
          width: '44%', background: '#0E0E13',
          padding: '16px', borderRight: '1px solid #26262F',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 12, lineHeight: 1.8,
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {lines.map((l, i) => (
            <div key={i} style={{ color: l.color }}>{l.text}</div>
          ))}
          {/* blinking cursor */}
          <div style={{ color: '#8B7CF6', marginTop: 4, opacity: 0.7 }}>▍</div>
        </div>

        {/* Rendered diagram pane */}
        <div style={{ flex: 1, background: '#FAFAFA', position: 'relative', overflow: 'hidden' }}>
          <DotGrid id="lp-mm-dots" />

          {/* Start node */}
          <div style={{
            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#fff', border: '1.5px solid #E4E4E7', borderRadius: 8,
            padding: '5px 18px', fontSize: 11, fontWeight: 600, color: '#09090B',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', whiteSpace: 'nowrap',
          }}>Start</div>

          {/* Arrow down */}
          <svg style={{ position: 'absolute', top: 62, left: '50%', marginLeft: -1 }} width="2" height="36">
            <line x1="1" y1="0" x2="1" y2="28" stroke="#D4D4D8" strokeWidth="1.5" />
            <polygon points="1,36 -3,26 5,26" fill="#D4D4D8" />
          </svg>

          {/* Decision diamond */}
          <div style={{
            position: 'absolute', top: 96, left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: 62, height: 62,
            background: '#fff', border: '1.5px solid #E4E4E7',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <span style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-45deg)', fontSize: 9.5, fontWeight: 600, color: '#52525B',
            }}>Decision</span>
          </div>

          {/* Yes label */}
          <div style={{ position: 'absolute', top: 155, left: '60%', fontSize: 9.5, color: '#4ADE80', fontWeight: 700 }}>Yes</div>

          {/* Arrow down to Done */}
          <svg style={{ position: 'absolute', top: 166, left: '50%', marginLeft: -1 }} width="2" height="36">
            <line x1="1" y1="0" x2="1" y2="28" stroke="#D4D4D8" strokeWidth="1.5" />
            <polygon points="1,36 -3,26 5,26" fill="#D4D4D8" />
          </svg>

          {/* Done node */}
          <div style={{
            position: 'absolute', top: 200, left: '50%', transform: 'translateX(-50%)',
            background: '#F0FDF4', border: '1.5px solid #4ADE80', borderRadius: 8,
            padding: '5px 18px', fontSize: 11, fontWeight: 600, color: '#166534',
            boxShadow: '0 2px 6px rgba(74,222,128,0.12)', whiteSpace: 'nowrap',
          }}>Done</div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ── Workspace Mockup ─────────────────────────────────────────────────────────

function WorkspaceMockup() {
  const workspaces = [
    { emoji: '🎨', name: 'Product Design', active: false },
    { emoji: '🏗️', name: 'Architecture', active: true },
    { emoji: '💡', name: 'Ideas', active: false },
    { emoji: '🚀', name: 'Roadmap', active: false },
  ];
  const files = [
    { name: 'System Overview', active: true },
    { name: 'API Gateway', active: false },
    { name: 'DB Schema', active: false },
    { name: 'Auth Flow', active: false },
  ];
  return (
    <WindowChrome>
      <div style={{ display: 'flex', height: 300 }}>
        <div style={{
          width: 158, background: '#FAFAFA', borderRight: '1px solid #F0F0F0',
          padding: '12px 0', flexShrink: 0,
        }}>
          <div style={{
            padding: '2px 14px 10px', fontSize: 10, fontWeight: 600,
            color: '#A1A1AA', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Workspaces</div>
          {workspaces.map((ws) => (
            <div key={ws.name} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
              background: ws.active ? '#F0F0F0' : 'transparent',
            }}>
              <span style={{ fontSize: 13 }}>{ws.emoji}</span>
              <span style={{
                fontSize: 12, fontWeight: ws.active ? 600 : 400,
                color: ws.active ? '#18181B' : '#71717A',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{ws.name}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#A1A1AA',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
          }}>Architecture · 4 files</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {files.map((f) => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
                background: f.active ? '#18181B' : '#fff',
                border: `1px solid ${f.active ? '#18181B' : '#F0F0F0'}`,
                borderRadius: 7,
              }}>
                <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
                  <rect x="1" y="1" width="10" height="11" rx="2" stroke={f.active ? '#fff' : '#A1A1AA'} strokeWidth="1.3" />
                  <path d="M3.5 4.5h5M3.5 7h5M3.5 9.5h3" stroke={f.active ? '#fff' : '#A1A1AA'} strokeWidth="1" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: f.active ? 600 : 400, color: f.active ? '#fff' : '#52525B' }}>
                  {f.name}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 6, padding: '6px 10px',
            border: '1px dashed #E4E4E7', borderRadius: 7,
            fontSize: 11, color: '#A1A1AA', textAlign: 'center',
          }}>+ New file</div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ── Pen Mockup ───────────────────────────────────────────────────────────────

function PenMockup() {
  const anchors: [number, number][] = [[54, 220], [136, 130], [246, 138], [390, 158]];
  const tools = ['V', '✏', '□', '○', 'T'];
  return (
    <WindowChrome>
      <div style={{ position: 'relative', height: 300, background: '#FAFAFA', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <pattern id="lp-pen-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" fill="#D4D4D8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-pen-dots)" />

          <motion.path
            d="M 54 220 C 74 200, 94 156, 136 130 C 178 104, 200 166, 246 138 C 292 110, 326 178, 390 158"
            stroke="#18181B" strokeWidth="2.2" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.2 }}
          />

          {anchors.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={4.5} fill="#fff" stroke="#3B82F6" strokeWidth="1.5" />
          ))}

          <g transform="translate(386,144) rotate(-20)">
            <path d="M0,12 L3,12 L9,2 L7,0 L1,8 Z" fill="#18181B" />
            <path d="M0,12 L-1.5,15.5 L1.5,14 Z" fill="#A1A1AA" />
          </g>
        </svg>

        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: '#fff', border: '1px solid #E4E4E7',
          borderRadius: 10, padding: 6,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {tools.map((t, i) => (
            <div key={t} style={{
              width: 28, height: 28, borderRadius: 6,
              background: i === 1 ? '#18181B' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: i === 1 ? '#fff' : '#A1A1AA', fontWeight: i === 1 ? 700 : 400,
            }}>{t}</div>
          ))}
        </div>
      </div>
    </WindowChrome>
  );
}

// ── Hero canvas preview (original, kept for hero) ────────────────────────────

function HeroPreview() {
  return (
    <div style={{ position: 'relative', width: 460, height: 300, flexShrink: 0 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', inset: 0,
          background: '#F8FAFC', borderRadius: 18,
          border: '1px solid #E2E8F0',
          boxShadow: '0 24px 56px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          <defs>
            <pattern id="lp-hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#CBD5E1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-hero-dots)" />
        </svg>

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: 60, left: 56,
            width: 140, height: 88, borderRadius: 10,
            border: '1.5px solid #3B82F6', background: 'rgba(59,130,246,0.06)',
          }}
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          style={{
            position: 'absolute', top: 96, right: 64,
            width: 96, height: 96, borderRadius: '50%',
            border: '1.5px solid #6366F1', background: 'rgba(99,102,241,0.06)',
          }}
        />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          style={{
            position: 'absolute', bottom: 56, left: 136,
            width: 80, height: 48, borderRadius: 6,
            border: '1.5px solid #8B5CF6', background: 'rgba(139,92,246,0.06)',
          }}
        />
        <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%">
          <motion.line
            x1="200" y1="104" x2="338" y2="144"
            stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="6 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
        </svg>
        <motion.div
          animate={{ x: [0, 38, 76, 38, 0], y: [0, -18, 10, 28, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: 136, left: 96 }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20">
            <path d="M0 0L0 14L4 10L6.5 16L8 15L5.5 9L10 9Z" fill="#3B82F6" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Feature section (alternating layout) ─────────────────────────────────────

interface FeatureSectionProps {
  label: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  reverse?: boolean;
}

function FeatureSection({ label, title, description, visual, reverse = false }: FeatureSectionProps) {
  const mob = useIsMobile();
  return (
    <div style={{
      display: 'flex', alignItems: mob ? 'stretch' : 'center',
      gap: mob ? 24 : 80,
      flexDirection: mob ? 'column' : (reverse ? 'row-reverse' : 'row'),
    }}>
      <motion.div
        variants={stagger} initial="hidden" whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
        style={{ flex: 1, minWidth: 0 }}
      >
        <motion.div variants={fadeUp}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#A1A1AA', marginBottom: mob ? 10 : 16,
          }}>{label}</span>
        </motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontSize: mob ? 24 : 36, fontWeight: 800, lineHeight: 1.14,
          letterSpacing: '-0.02em', color: '#09090B', margin: `0 0 ${mob ? '12px' : '18px'}`,
        }}>{title}</motion.h2>
        <motion.p variants={fadeUp} style={{
          fontSize: mob ? 14 : 16, lineHeight: 1.65, color: '#71717A', margin: 0,
        }}>{description}</motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        viewport={{ once: true, margin: '-40px' }}
        style={{ width: mob ? '100%' : 460, flexShrink: 0 }}
      >
        {visual}
      </motion.div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'What is this project?',
    a: 'Sketch is a full-stack infinite-canvas application built from scratch to explore the engineering behind modern collaborative design tools like Figma, Excalidraw, and Eraser. It covers real-time rendering, spatial indexing, state management, OAuth, and cloud persistence.',
  },
  {
    q: 'What technologies power it?',
    a: 'The frontend is React 18 + TypeScript, with a custom Canvas 2D rendering engine, Zustand for state, and React Router for navigation. The backend is a Fastify REST API on Node.js backed by NeonDB (PostgreSQL). Auth uses Google OAuth 2.0 with JWT sessions.',
  },
  {
    q: 'How does the canvas rendering work?',
    a: 'Three stacked HTML5 Canvas layers handle the grid, objects, and selection overlay independently. A requestAnimationFrame loop with a dirty-flag keeps redraws minimal. An rbush R-tree spatial index makes viewport culling and hit-testing O(log n) even with thousands of objects.',
  },
  {
    q: 'How is data persisted?',
    a: 'Canvas snapshots (objects, background, grid style) are autosaved to NeonDB every 5 seconds via the REST API. A Yjs CRDT backed by IndexedDB provides instant offline access - the cloud snapshot loads on first open and the local copy keeps updates in-between saves.',
  },
  {
    q: 'What is Mermaid diagram conversion?',
    a: 'You can paste any Mermaid flowchart syntax and the app parses it, runs a Sugiyama-style layered layout algorithm, and places fully editable native canvas elements like shapes, arrows, and labels onto the canvas with one click.',
  },
  {
    q: 'Is it production-ready?',
    a: 'in development phase',
  },
];

function FaqList() {
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            viewport={{ once: true }}
            style={{
              borderBottom: '1px solid #F0F0F0',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%', background: 'none', border: 'none',
                padding: '22px 0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 16, fontWeight: 600, color: '#09090B',
                letterSpacing: '-0.01em', lineHeight: 1.4,
              }}>{item.q}</span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  flexShrink: 0, width: 22, height: 22,
                  borderRadius: '50%', background: isOpen ? '#09090B' : '#F4F4F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: isOpen ? '#fff' : '#52525B',
                  lineHeight: 1,
                }}
              >+</motion.span>
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <p style={{
                margin: '0 0 22px', fontSize: 15, color: '#52525B',
                lineHeight: 1.72, paddingRight: 40,
              }}>{item.a}</p>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LandingPageProps {
  onSignedIn: () => void;
  onGoToApp: () => void;
}

function GoogleSignInButton() {
  // Dynamically detect API server URL:
  // 1. If VITE_API_URL is set in env (e.g., via Vercel env vars), use it
  // 2. Otherwise, try to use the same domain/host as the frontend
  // 3. Fall back to localhost:3001 for development
  
  let apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl || apiUrl.includes('localhost')) {
    // On production (Vercel, etc.), API is typically on same domain
    // or use x-forwarded-proto/host headers if behind a proxy
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // Use same protocol and hostname, but adjust port if needed
      // For Vercel deployments, API might be on same domain or a backend subdomain
      const proto = window.location.protocol; // https: or http:
      const host = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      apiUrl = `${proto}//${host}${port}`;
    } else {
      // Fall back to the env or localhost
      apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    }
  }
  
  return (
    <a
      href={`${apiUrl}/auth/google`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
        border: '1px solid #E4E4E7', background: '#fff',
        fontSize: 14, fontWeight: 500, color: '#374151',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
    >
      {/* Google "G" logo */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
        <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
        <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
      </svg>
      Sign in with Google
    </a>
  );
}

export function LandingPage({ onSignedIn: _onSignedIn, onGoToApp }: LandingPageProps) {
  const mobile = useIsMobile();
  const { user } = useAuthStore();
  const isSignedIn = !!user;

  return (
    <div style={{
      minHeight: '100vh', background: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#09090B', overflowX: 'hidden',
    }}>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: mobile ? '0 16px' : '0 48px', height: 56,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: '#18181B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M8 3V13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: mobile ? 15 : 17, letterSpacing: '-0.02em' }}>Sketch</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 4 : 8 }}>
          <Link
            to="/docs"
            style={{
              padding: mobile ? '6px 10px' : '7px 14px', borderRadius: 8, border: 'none',
              background: 'transparent', fontSize: 13, fontWeight: 600,
              color: '#52525B', cursor: 'pointer', textDecoration: 'none',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#09090B'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#52525B'; }}
          >Docs</Link>
          {isSignedIn ? (
            <>
              {!mobile && <span style={{ fontSize: 13, color: '#52525B', fontWeight: 500 }}>{user.name}</span>}
              <button onClick={onGoToApp} style={{
                padding: mobile ? '6px 12px' : '7px 18px', borderRadius: 8, border: 'none',
                background: '#18181B', fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer',
              }}>{mobile ? 'Open →' : 'Open app →'}</button>
              <UserMenu />
            </>
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      </motion.nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: mobile ? '48px 20px 40px' : '96px 48px 80px',
        display: 'flex', alignItems: 'center', gap: mobile ? 0 : 64,
        flexDirection: mobile ? 'column' : 'row',
      }}>
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ flex: 1, minWidth: 0 }}>
          <motion.div variants={fadeUp} style={{ marginBottom: mobile ? 16 : 24 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 4,
              background: '#F4F4F5', color: '#52525B',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
              border: '1px solid #E4E4E7',
            }}>
              This project is made for educational purposes by Piyush Raj
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} style={{
            fontSize: mobile ? 34 : 58, fontWeight: 800, lineHeight: 1.08,
            letterSpacing: '-0.03em', margin: '0 0 16px', color: '#09090B',
          }}>
            Design without<br />
            <span style={{ color: '#3B82F6' }}>boundaries.</span>
          </motion.h1>

          <motion.p variants={fadeUp} style={{
            fontSize: mobile ? 15 : 18, color: '#71717A', lineHeight: 1.6,
            margin: `0 0 ${mobile ? '24px' : '36px'}`,
          }}>
            An infinite canvas for architects, designers, and engineers.
            Draw, organise, and think clearly - all in one place.
          </motion.p>

          <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            {isSignedIn ? (
              <button onClick={onGoToApp} style={{
                padding: mobile ? '12px 22px' : '13px 28px', borderRadius: 10, border: 'none',
                background: '#18181B', fontSize: 15, fontWeight: 600,
                color: '#fff', cursor: 'pointer', width: mobile ? '100%' : undefined,
              }}>Open your workspace →</button>
            ) : (
              <GoogleSignInButton />
            )}
          </motion.div>
        </motion.div>

        {!mobile && <HeroPreview />}
      </section>

      {/* ── Feature sections ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #F0F0F0' }}>

        {/* Section intro */}
        <div style={{ textAlign: 'center', padding: mobile ? '40px 20px 0' : '80px 48px 0' }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }} viewport={{ once: true }}
          >
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#A1A1AA',
              display: 'block', marginBottom: 14,
            }}>Built for makers</span>
            <h2 style={{
              fontSize: mobile ? 28 : 44, fontWeight: 800, letterSpacing: '-0.03em',
              margin: 0, color: '#09090B', lineHeight: 1.1,
            }}>
              Everything you need<br />to think visually
            </h2>
          </motion.div>
        </div>

        {/* 1 — Infinite Canvas */}
        <section style={{ padding: mobile ? '48px 20px' : '100px 48px', background: '#fff' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FeatureSection label="Canvas" title="Think without boundaries"
              description="An infinite workspace that grows with your ideas. Sketch system diagrams, plan architecture, map user flows - then zoom out to see the complete picture."
              visual={<CanvasMockup />} reverse={false} />
          </div>
        </section>

        {/* 2 — Sync */}
        <section style={{ padding: mobile ? '48px 20px' : '100px 48px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FeatureSection label="Persistence" title="Your work, always where you left it"
              description="Every change is saved locally and synced to the cloud so your canvases are available on any device. Nothing is ever lost."
              visual={<SyncMockup />} reverse={true} />
          </div>
        </section>

        {/* 3 — Visual Editing */}
        <section style={{ padding: mobile ? '48px 20px' : '100px 48px', background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FeatureSection label="Editing" title="Built for visual thinking"
              description="Shapes, connectors, text, images, freehand strokes - every element lives in the same canvas. Select, resize, rotate, group, and lock anything."
              visual={<ToolsMockup />} reverse={false} />
          </div>
        </section>

        {/* 4 — Pen */}
        <section style={{ padding: mobile ? '48px 20px' : '100px 48px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FeatureSection label="Drawing" title="Freehand input, precisely rendered"
              description="Draw naturally with a stylus or finger. Smooth bezier interpolation captures the fluidity of a real whiteboard. Mix freehand strokes with shapes and text."
              visual={<PenMockup />} reverse={true} />
          </div>
        </section>

        {/* 5 — Mermaid */}
        <section style={{ padding: mobile ? '48px 20px' : '100px 48px', background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FeatureSection label="Diagrams" title="Mermaid to diagram conversion"
              description="Paste any Mermaid flowchart and it instantly becomes fully editable canvas elements - shapes, arrows, and labels you can move, restyle, and extend."
              visual={<MermaidMockup />} reverse={false} />
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section style={{ padding: mobile ? '48px 20px 60px' : '80px 48px 100px', background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }} viewport={{ once: true }}
              style={{ textAlign: 'center', marginBottom: mobile ? 32 : 56 }}
            >
              <h3 style={{
                fontSize: mobile ? 24 : 34, fontWeight: 800, letterSpacing: '-0.02em',
                color: '#09090B', margin: '0 0 10px',
              }}>About This Project</h3>
              <p style={{ fontSize: mobile ? 14 : 16, color: '#71717A', margin: 0 }}>
                Things you might be curious about before diving in.
              </p>
            </motion.div>
            <FaqList />
          </div>
        </section>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }} viewport={{ once: true }}
        style={{
          padding: mobile ? '56px 20px' : '100px 48px', textAlign: 'center',
          background: '#09090B',
        }}
      >
        <h2 style={{
          fontSize: mobile ? 28 : 42, fontWeight: 800, letterSpacing: '-0.02em',
          margin: '0 0 12px', color: '#fff',
        }}>Ready to start?</h2>
        <p style={{ fontSize: mobile ? 14 : 16, color: '#71717A', margin: '0 0 28px' }}>
          Free forever.
        </p>
        {isSignedIn ? (
          <button onClick={onGoToApp} style={{
            padding: '14px 36px', borderRadius: 12, border: '1px solid #3F3F46',
            background: '#fff', fontSize: 16, fontWeight: 700,
            color: '#09090B', cursor: 'pointer',
          }}>Open your workspace</button>
        ) : (
          <GoogleSignInButton />
        )}
      </motion.section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid #F0F0F0', padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: '#18181B' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Sketch</span>
        </div>
        <span style={{ fontSize: 12, color: '#A1A1AA' }}>Built for makers</span>
      </footer>
    </div>
  );
}
