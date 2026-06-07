import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { Tool, StrokeStyle } from '../types';
import { historyManager } from '../history/historyManager';

/** Subscribes to historyManager changes and returns live canUndo/canRedo flags. */
function useHistoryState() {
  const [state, setState] = useState({
    canUndo: historyManager.canUndo(),
    canRedo: historyManager.canRedo(),
  });
  useEffect(() => {
    return historyManager.subscribe(() => {
      setState({ canUndo: historyManager.canUndo(), canRedo: historyManager.canRedo() });
    });
  }, []);
  return state;
}
import { motion, AnimatePresence } from 'framer-motion';
import { ColorPicker } from './ColorPicker';
import { createImageObjectFromFile } from '../utils/clipboard';
import { MermaidModal } from './MermaidModal';

// ── React Icons (Tabler set — semantically matched to each action) ────────────
import {
  // History
  TbArrowBackUp,        // Undo   — curved arrow going back
  TbArrowForwardUp,     // Redo   — curved arrow going forward
  // Cursor tools
  TbPointer,            // Select — standard mouse pointer
  TbHandStop,           // Pan    — open hand / grab
  // Shape tools
  TbSquare,             // Rectangle
  TbCircle,             // Ellipse / Circle
  TbDiamond,            // Diamond
  TbMinus,              // Line   — straight horizontal line
  TbArrowUpRight,       // Arrow  — directional connector
  TbFrame,              // Frame  — section container
  // Other drawing tools
  TbTypography,         // Text   — "Aa" typographic label
  TbPhoto,              // Image  — picture frame with mountain
  TbPencil,             // Pen    — freehand pencil stroke
  TbEraser,             // Eraser — eraser block
  TbHighlight,          // Laser  — highlighter / spotlight pointer
  // Layer / z-order
  TbStackFront,         // Bring to Front
  TbArrowBigUpLines,    // Bring Forward    — arrow with multiple up lines
  TbArrowBigDownLines,  // Send Backward    — arrow with multiple down lines
  TbStackBack,          // Send to Back
  // Group
  TbLayersLinked,       // Group   — layers linked / connected
  TbLayersSubtract,     // Ungroup — layers splitting apart
  // Lock
  TbLock,
  TbLockOpen,
  // Diagram / Mermaid
  TbHierarchy2,         // Insert diagram — hierarchy / flowchart tree
} from 'react-icons/tb';

const ICO = 16; // uniform icon size (px) across the whole toolbar

interface ToolDef { id: Tool; label: string; shortcut: string; icon: React.ReactNode; }

// Shape tools live in the dropdown, not the main bar
const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rect',    label: 'Rectangle', shortcut: 'R', icon: <TbSquare      size={ICO} /> },
  { id: 'ellipse', label: 'Ellipse',   shortcut: 'O', icon: <TbCircle      size={ICO} /> },
  { id: 'diamond', label: 'Diamond',   shortcut: 'D', icon: <TbDiamond     size={ICO} /> },
  { id: 'line',    label: 'Line',      shortcut: '',  icon: <TbMinus       size={ICO} /> },
  { id: 'arrow',   label: 'Arrow',     shortcut: 'A', icon: <TbArrowUpRight size={ICO} /> },
  { id: 'frame',   label: 'Frame',     shortcut: 'F', icon: <TbFrame       size={ICO} /> },
];
const SHAPE_IDS = new Set<Tool>(SHAPE_TOOLS.map((s) => s.id));

// Non-shape tools that stay in the main bar
const MAIN_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <TbPointer   size={ICO} /> },
  { id: 'pan',    label: 'Pan',    shortcut: 'H', icon: <TbHandStop  size={ICO} /> },
  { id: 'text',   label: 'Text',   shortcut: 'T', icon: <TbTypography size={ICO} /> },
  { id: 'image',  label: 'Image',  shortcut: 'I', icon: <TbPhoto     size={ICO} /> },
  { id: 'pen',    label: 'Pen',    shortcut: 'P', icon: <TbPencil    size={ICO} /> },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: <TbEraser    size={ICO} /> },
  { id: 'laser',  label: 'Laser',  shortcut: 'L', icon: <TbHighlight size={ICO} style={{ color: '#EF4444' }} /> },
];

function PenPanel() {
  const penColor = useCanvasStore((s) => s.penColor);
  const penWidth = useCanvasStore((s) => s.penWidth);
  const penStyle = useCanvasStore((s) => s.penStyle);
  const penRecentColors = useCanvasStore((s) => s.penRecentColors);
  const setPenColor = useCanvasStore((s) => s.setPenColor);
  const setPenWidth = useCanvasStore((s) => s.setPenWidth);
  const setPenStyle = useCanvasStore((s) => s.setPenStyle);
  const addRecentPenColor = useCanvasStore((s) => s.addRecentPenColor);

  const STYLES: { id: StrokeStyle; title: string; preview: React.ReactNode }[] = [
    {
      id: 'solid', title: 'Solid',
      preview: <svg width="28" height="10" viewBox="0 0 28 10"><line x1="2" y1="5" x2="26" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
    },
    {
      id: 'dashed', title: 'Dashed',
      preview: <svg width="28" height="10" viewBox="0 0 28 10"><line x1="2" y1="5" x2="26" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/></svg>,
    },
    {
      id: 'dotted', title: 'Dotted',
      preview: <svg width="28" height="10" viewBox="0 0 28 10"><line x1="2" y1="5" x2="26" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 4"/></svg>,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: '14px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        zIndex: 101, width: 232,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11, color: 'var(--text-secondary)',
      }}
    >
      {/* Color picker */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Color
        </div>
        <ColorPicker
          value={penColor}
          onChange={(c) => { setPenColor(c); addRecentPenColor(c); }}
          recentColors={penRecentColors}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--hover-bg)', margin: '10px 0' }} />

      {/* Width */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Width</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 11 }}>{penWidth}px</span>
        </div>
        <input
          type="range" min={1} max={24} step={0.5} value={penWidth}
          onChange={(e) => setPenWidth(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Style */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Style
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STYLES.map((s) => (
            <button
              key={s.id}
              title={s.title}
              onClick={() => setPenStyle(s.id)}
              style={{
                flex: 1, padding: '5px 4px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid ' + (penStyle === s.id ? 'var(--accent)' : 'var(--panel-border)'),
                background: penStyle === s.id ? 'var(--active-bg)' : 'var(--panel-bg-2)',
                color: penStyle === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {s.preview}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function LaserPanel() {
  const laserSize = useCanvasStore((s) => s.laserSize);
  const laserGlow = useCanvasStore((s) => s.laserGlow);
  const setLaserSize = useCanvasStore((s) => s.setLaserSize);
  const setLaserGlow = useCanvasStore((s) => s.setLaserGlow);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        zIndex: 101, display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Size</span>
        <input type="range" min={2} max={16} step={1} value={laserSize}
          onChange={(e) => setLaserSize(Number(e.target.value))}
          style={{ width: 72 }} />
        <span style={{ minWidth: 14, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{laserSize}</span>
      </div>
      <div style={{ width: 1, height: 18, background: 'var(--panel-border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Glow</span>
        <input type="range" min={5} max={40} step={1} value={laserGlow}
          onChange={(e) => setLaserGlow(Number(e.target.value))}
          style={{ width: 72 }} />
        <span style={{ minWidth: 14, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{laserGlow}</span>
      </div>
    </motion.div>
  );
}

const btnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 34, height: 34, border: 'none', borderRadius: 7,
  cursor: 'pointer', transition: 'background 0.1s',
  color: 'var(--text-secondary)', background: 'transparent',
};
const btnActive: React.CSSProperties = { ...btnBase, background: 'var(--active-bg)', color: 'var(--active-fg)' };

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button style={btnBase} onClick={onClick} title={title}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >{children}</button>
  );
}

const Divider = () => <div style={{ width: 1, height: 22, background: 'var(--panel-border)', margin: '0 3px' }} />;

export function Toolbar() {
  const { canUndo, canRedo } = useHistoryState();
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const bringForward = useCanvasStore((s) => s.bringForward);
  const sendBackward = useCanvasStore((s) => s.sendBackward);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const toggleLock = useCanvasStore((s) => s.toggleLock);
  const objects = useCanvasStore((s) => s.objects);

  const firstSelected = selectedIds.length > 0 ? objects[selectedIds[0]] : null;
  const isLocked = firstSelected?.locked ?? false;
  const isGroup = firstSelected?.type === 'group';
  const canGroup = selectedIds.length >= 2;

  // Shapes dropdown
  const [shapeOpen, setShapeOpen] = useState(false);
  const [lastShape, setLastShape] = useState<Tool>(() =>
    (localStorage.getItem('sketch-last-shape') as Tool) ?? 'rect',
  );
  const shapeRef = useRef<HTMLDivElement>(null);
  const isShapeActive = SHAPE_IDS.has(activeTool);
  const currentShapeDef = SHAPE_TOOLS.find((s) => s.id === lastShape) ?? SHAPE_TOOLS[0];

  // Sync lastShape when a shape tool is activated via keyboard shortcut
  useEffect(() => {
    if (SHAPE_IDS.has(activeTool)) {
      setLastShape(activeTool);
      localStorage.setItem('sketch-last-shape', activeTool);
    }
  }, [activeTool]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!shapeOpen) return;
    function onDown(e: MouseEvent) {
      if (shapeRef.current && !shapeRef.current.contains(e.target as Node)) {
        setShapeOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shapeOpen]);

  function selectShape(id: Tool) {
    setLastShape(id);
    localStorage.setItem('sketch-last-shape', id);
    setActiveTool(id);
    setShapeOpen(false);
  }

  // Mermaid diagram modal
  const [mermaidOpen, setMermaidOpen] = useState(false);

  // Image file picker
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageButtonClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be picked again if needed
    e.target.value = '';

    const cam = useCanvasStore.getState().camera;
    // Place at the center of the current viewport
    const cx = cam.x + window.innerWidth  / 2 / cam.zoom;
    const cy = cam.y + window.innerHeight / 2 / cam.zoom;
    await createImageObjectFromFile(file, { x: cx, y: cy });
    setActiveTool('select');
  }

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100,
      // On narrow screens, constrain width and allow horizontal scroll
      maxWidth: 'calc(100vw - 24px)',
    }}>
    {/* Hidden file input for image insertion */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={handleFileChange}
    />
    <AnimatePresence>
      {activeTool === 'pen'   && <PenPanel   key="pen-panel"   />}
      {activeTool === 'laser' && <LaserPanel key="laser-panel" />}
    </AnimatePresence>
    <div className="toolbar-scroll" style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
      borderRadius: 10, padding: '4px 6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      userSelect: 'none',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Undo/Redo — visually disabled when the stack is empty */}
      <button
        title={canUndo ? 'Undo (Ctrl+Z)' : 'Nothing to undo'}
        disabled={!canUndo}
        onClick={() => historyManager.undo()}
        style={{
          ...btnBase,
          opacity: canUndo ? 1 : 0.35,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
        onMouseEnter={(e) => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <TbArrowBackUp size={ICO} />
      </button>
      <button
        title={canRedo ? 'Redo (Ctrl+Shift+Z)' : 'Nothing to redo'}
        disabled={!canRedo}
        onClick={() => historyManager.redo()}
        style={{
          ...btnBase,
          opacity: canRedo ? 1 : 0.35,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
        onMouseEnter={(e) => { if (canRedo) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <TbArrowForwardUp size={ICO} />
      </button>

      <Divider />

      {/* Select + Pan */}
      {MAIN_TOOLS.slice(0, 2).map((tool) => {
        const active = activeTool === tool.id;
        return (
          <button key={tool.id} style={active ? btnActive : btnBase}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >{tool.icon}</button>
        );
      })}

      <Divider />

      {/* ── Shapes dropdown ──────────────────────────────────────────── */}
      <div ref={shapeRef} style={{ position: 'relative' }}>
        {/* Main shape button — click = use lastShape */}
        <button
          style={{
            ...(isShapeActive ? btnActive : btnBase),
            position: 'relative', paddingRight: 16,
          }}
          onClick={() => {
            if (activeTool === lastShape) { setShapeOpen((v) => !v); }
            else { setActiveTool(lastShape); setShapeOpen(false); }
          }}
          title={`${currentShapeDef.label}${currentShapeDef.shortcut ? ` (${currentShapeDef.shortcut})` : ''} — click ▾ for more shapes`}
        >
          {currentShapeDef.icon}
          {/* Tiny dropdown indicator */}
          <span style={{
            position: 'absolute', bottom: 3, right: 3,
            fontSize: 6, lineHeight: 1, opacity: 0.5, pointerEvents: 'none',
          }}>▾</span>
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {shapeOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.13, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
                borderRadius: 10, padding: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                zIndex: 200, minWidth: 168,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {SHAPE_TOOLS.map((s) => {
                const isActive = activeTool === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectShape(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      width: '100%', padding: '7px 10px',
                      border: 'none', borderRadius: 7, cursor: 'pointer',
                      background: isActive ? 'var(--active-bg)' : 'transparent',
                      color: isActive ? 'var(--active-fg)' : 'var(--text-secondary)',
                      fontSize: 13, textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', color: isActive ? 'var(--active-fg)' : 'var(--text-secondary)' }}>{s.icon}</span>
                    <span style={{ flex: 1, fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
                    {s.shortcut && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.shortcut}</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Divider />

      {/* Text, Image, Pen, Eraser, Laser */}
      {MAIN_TOOLS.slice(2).map((tool) => {
        const active = activeTool === tool.id;
        const handleClick = tool.id === 'image'
          ? handleImageButtonClick
          : () => setActiveTool(tool.id);
        return (
          <button key={tool.id} style={active ? btnActive : btnBase}
            onClick={handleClick}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >{tool.icon}</button>
        );
      })}

      <Divider />

      {/* Mermaid diagram import */}
      <IconBtn title="Insert diagram from Mermaid" onClick={() => setMermaidOpen(true)}>
        <TbHierarchy2 size={ICO} />
      </IconBtn>

      {/* Context actions: only show when objects selected */}
      {selectedIds.length > 0 && (
        <>
          <Divider />

          {/* Group / Ungroup */}
          {canGroup && (
            <IconBtn title="Group (Ctrl+G)" onClick={() => groupSelected()}>
              <TbLayersLinked size={ICO} />
            </IconBtn>
          )}
          {isGroup && (
            <IconBtn title="Ungroup (Ctrl+Shift+G)" onClick={ungroupSelected}>
              <TbLayersSubtract size={ICO} />
            </IconBtn>
          )}

          {/* Z-order — full set of four */}
          <IconBtn title="Bring to Front (Ctrl+Shift+])" onClick={() => selectedIds.forEach((id) => useCanvasStore.getState().bringToFront(id))}>
            <TbStackFront size={ICO} />
          </IconBtn>
          <IconBtn title="Bring Forward (Ctrl+])" onClick={() => selectedIds.forEach((id) => bringForward(id))}>
            <TbArrowBigUpLines size={ICO} />
          </IconBtn>
          <IconBtn title="Send Backward (Ctrl+[)" onClick={() => selectedIds.forEach((id) => sendBackward(id))}>
            <TbArrowBigDownLines size={ICO} />
          </IconBtn>
          <IconBtn title="Send to Back (Ctrl+Shift+[)" onClick={() => selectedIds.forEach((id) => useCanvasStore.getState().sendToBack(id))}>
            <TbStackBack size={ICO} />
          </IconBtn>

          <Divider />

          {/* Lock / Unlock */}
          <button
            title={isLocked ? 'Unlock (Ctrl+L)' : 'Lock (Ctrl+L)'}
            onClick={() => selectedIds.forEach((id) => toggleLock(id))}
            style={{
              ...btnBase,
              background: isLocked ? '#FEF3C7' : 'transparent',
              color: isLocked ? '#F59E0B' : 'var(--text-secondary)',
              border: isLocked ? '1px solid #FDE68A' : '1px solid transparent',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isLocked ? '#FDE68A' : 'var(--hover-bg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isLocked ? '#FEF3C7' : 'transparent'; }}
          >
            {isLocked
              ? <TbLock     size={ICO} style={{ color: '#F59E0B' }} />
              : <TbLockOpen size={ICO} />
            }
          </button>
        </>
      )}
    </div>

    {mermaidOpen && <MermaidModal onClose={() => setMermaidOpen(false)} />}
    </div>
  );
}
