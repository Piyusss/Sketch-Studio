import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TbPointer, TbHandStop, TbSquare, TbCircle, TbDiamond, TbArrowUpRight,
  TbTypography, TbPencil, TbEraser, TbHighlight, TbPhoto,
  TbArrowBackUp, TbArrowForwardUp, TbCopy, TbTrash, TbLayersLinked, TbLayersSubtract,
  TbStackFront, TbStackBack, TbLock, TbZoomIn, TbZoomOut, TbMaximize, TbZoomReset,
  TbSun, TbMoon, TbGridDots, TbGrid4X4, TbSquareOff, TbSearch,
  TbVectorTriangle, TbFileTypePdf, TbFrame,
} from 'react-icons/tb';
import type { Tool } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { useThemeStore } from '../store/themeStore';
import { historyManager } from '../history/historyManager';
import { RemoveObjectsCommand } from '../history/commands';
import { zoomBy, resetZoom, zoomToFit } from '../engine/cameraControl';
import { exportCanvasToPng } from '../lib/exportImage';
import { exportCanvasToSvg } from '../lib/exportSvg';
import { exportCanvasToPdf } from '../lib/exportPdf';

interface Command {
  id: string;
  title: string;
  group: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
}

const IC = 16;

function setTool(t: Tool) { useCanvasStore.getState().setActiveTool(t); }

function buildCommands(): Command[] {
  const store = useCanvasStore.getState();
  const theme = useThemeStore.getState();
  const selErr = () => store.selectedIds.length > 0;

  const cmds: Command[] = [
    // Tools
    { id: 'tool-select', title: 'Select', group: 'Tools', hint: 'V', icon: <TbPointer size={IC} />, run: () => setTool('select') },
    { id: 'tool-pan', title: 'Pan', group: 'Tools', hint: 'H', icon: <TbHandStop size={IC} />, run: () => setTool('pan') },
    { id: 'tool-rect', title: 'Rectangle', group: 'Tools', hint: 'R', icon: <TbSquare size={IC} />, run: () => setTool('rect') },
    { id: 'tool-ellipse', title: 'Ellipse', group: 'Tools', hint: 'O', icon: <TbCircle size={IC} />, run: () => setTool('ellipse') },
    { id: 'tool-diamond', title: 'Diamond', group: 'Tools', hint: 'D', icon: <TbDiamond size={IC} />, run: () => setTool('diamond') },
    { id: 'tool-arrow', title: 'Arrow', group: 'Tools', hint: 'A', icon: <TbArrowUpRight size={IC} />, run: () => setTool('arrow') },
    { id: 'tool-text', title: 'Text', group: 'Tools', hint: 'T', icon: <TbTypography size={IC} />, run: () => setTool('text') },
    { id: 'tool-pen', title: 'Pen', group: 'Tools', hint: 'P', icon: <TbPencil size={IC} />, run: () => setTool('pen') },
    { id: 'tool-eraser', title: 'Eraser', group: 'Tools', hint: 'E', icon: <TbEraser size={IC} />, run: () => setTool('eraser') },
    { id: 'tool-laser', title: 'Laser pointer', group: 'Tools', hint: 'L', icon: <TbHighlight size={IC} />, run: () => setTool('laser') },
    { id: 'tool-frame', title: 'Frame / section', group: 'Tools', hint: 'F', keywords: 'section container', icon: <TbFrame size={IC} />, run: () => setTool('frame') },
    { id: 'tool-image', title: 'Insert image', group: 'Tools', hint: 'I', icon: <TbPhoto size={IC} />, run: () => setTool('image') },

    // Edit
    { id: 'undo', title: 'Undo', group: 'Edit', hint: 'Ctrl+Z', icon: <TbArrowBackUp size={IC} />, run: () => historyManager.undo() },
    { id: 'redo', title: 'Redo', group: 'Edit', hint: 'Ctrl+Shift+Z', icon: <TbArrowForwardUp size={IC} />, run: () => historyManager.redo() },
    { id: 'duplicate', title: 'Duplicate selection', group: 'Edit', hint: 'Ctrl+D', keywords: 'copy clone', icon: <TbCopy size={IC} />, run: duplicateSelection },
    { id: 'delete', title: 'Delete selection', group: 'Edit', hint: 'Del', icon: <TbTrash size={IC} />, run: () => { if (selErr()) historyManager.execute(new RemoveObjectsCommand(store.selectedIds)); } },
    { id: 'group', title: 'Group selection', group: 'Edit', hint: 'Ctrl+G', icon: <TbLayersLinked size={IC} />, run: () => useCanvasStore.getState().groupSelected() },
    { id: 'ungroup', title: 'Ungroup', group: 'Edit', hint: 'Ctrl+Shift+G', icon: <TbLayersSubtract size={IC} />, run: () => useCanvasStore.getState().ungroupSelected() },
    { id: 'front', title: 'Bring to front', group: 'Edit', hint: 'Ctrl+Shift+]', icon: <TbStackFront size={IC} />, run: () => useCanvasStore.getState().selectedIds.forEach((id) => useCanvasStore.getState().bringToFront(id)) },
    { id: 'back', title: 'Send to back', group: 'Edit', hint: 'Ctrl+Shift+[', icon: <TbStackBack size={IC} />, run: () => useCanvasStore.getState().selectedIds.forEach((id) => useCanvasStore.getState().sendToBack(id)) },
    { id: 'lock', title: 'Lock / unlock selection', group: 'Edit', hint: 'Ctrl+L', icon: <TbLock size={IC} />, run: () => useCanvasStore.getState().selectedIds.forEach((id) => useCanvasStore.getState().toggleLock(id)) },

    // View
    { id: 'zoom-in', title: 'Zoom in', group: 'View', hint: 'Ctrl+=', icon: <TbZoomIn size={IC} />, run: () => zoomBy(1.25) },
    { id: 'zoom-out', title: 'Zoom out', group: 'View', hint: 'Ctrl+-', icon: <TbZoomOut size={IC} />, run: () => zoomBy(0.8) },
    { id: 'zoom-reset', title: 'Reset zoom to 100%', group: 'View', hint: 'Ctrl+0', icon: <TbZoomReset size={IC} />, run: () => resetZoom() },
    { id: 'zoom-fit', title: 'Zoom to fit content', group: 'View', hint: 'Shift+1', icon: <TbMaximize size={IC} />, run: () => zoomToFit(Object.values(useCanvasStore.getState().objects)) },
    { id: 'theme', title: theme.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', group: 'View', keywords: 'dark light mode', icon: theme.theme === 'dark' ? <TbSun size={IC} /> : <TbMoon size={IC} />, run: () => useThemeStore.getState().toggleTheme() },
    { id: 'grid-dots', title: 'Background: dots', group: 'View', keywords: 'grid', icon: <TbGridDots size={IC} />, run: () => store.setCanvasGrid('dots') },
    { id: 'grid-lines', title: 'Background: grid', group: 'View', keywords: 'lines', icon: <TbGrid4X4 size={IC} />, run: () => store.setCanvasGrid('grid') },
    { id: 'grid-none', title: 'Background: plain', group: 'View', keywords: 'none blank', icon: <TbSquareOff size={IC} />, run: () => store.setCanvasGrid('none') },

    // Export
    { id: 'export-png', title: 'Export as PNG', group: 'Export', keywords: 'download image save raster', icon: <TbPhoto size={IC} />, run: () => { void exportCanvasToPng({ filename: 'sketch' }); } },
    { id: 'export-svg', title: 'Export as SVG', group: 'Export', keywords: 'download vector scalable save', icon: <TbVectorTriangle size={IC} />, run: () => { void exportCanvasToSvg('sketch'); } },
    { id: 'export-pdf', title: 'Export as PDF', group: 'Export', keywords: 'download document print save', icon: <TbFileTypePdf size={IC} />, run: () => { void exportCanvasToPdf({ filename: 'sketch' }); } },
  ];
  return cmds;
}

function duplicateSelection(): void {
  const store = useCanvasStore.getState();
  const ids = store.selectedIds;
  if (ids.length === 0) return;
  // Delegate to the existing Ctrl+D path by dispatching a synthetic key event
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset state + focus when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo(() => (open ? buildCommands() : []), [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands
      .map((c) => {
        const hay = `${c.title} ${c.group} ${c.keywords ?? ''}`.toLowerCase();
        const idx = hay.indexOf(q);
        return idx === -1 ? null : { c, score: idx };
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c);
  }, [commands, query]);

  // Clamp active index when the list changes
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  // Keep the active row scrolled into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function execute(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    // Defer so the palette closes before the command (some change selection/tool)
    requestAnimationFrame(() => cmd.run());
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    // Isolate the palette from the canvas key handlers (arrows nudge objects etc.)
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); execute(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  }

  if (!open) return null;

  // Group consecutive commands by their group label for section headers
  const rows: Array<{ type: 'header'; label: string } | { type: 'cmd'; cmd: Command; idx: number }> = [];
  let lastGroup = '';
  filtered.forEach((cmd, idx) => {
    if (cmd.group !== lastGroup) { rows.push({ type: 'header', label: cmd.group }); lastGroup = cmd.group; }
    rows.push({ type: 'cmd', cmd, idx });
  });

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="cmdk-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onMouseDown={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '12vh',
        }}
      >
        <motion.div
          key="cmdk-panel"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 'min(92vw, 540px)', maxHeight: '62vh',
            display: 'flex', flexDirection: 'column',
            background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
            borderRadius: 14, boxShadow: 'var(--panel-shadow-lg)',
            overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Search row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
            <TbSearch size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onInputKeyDown}
              placeholder="Search commands…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
            <kbd style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              border: '1px solid var(--panel-border)', borderRadius: 5, padding: '2px 6px',
            }}>ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} style={{ overflowY: 'auto', padding: 6 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No matching commands
              </div>
            )}
            {rows.map((row, i) =>
              row.type === 'header' ? (
                <div key={`h-${row.label}-${i}`} style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', padding: '8px 10px 4px',
                }}>{row.label}</div>
              ) : (
                <button
                  key={row.cmd.id}
                  data-idx={row.idx}
                  onMouseEnter={() => setActive(row.idx)}
                  onClick={() => execute(row.cmd)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                    padding: '9px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: row.idx === active ? 'var(--active-bg)' : 'transparent',
                    color: row.idx === active ? 'var(--active-fg)' : 'var(--text-primary)',
                    fontSize: 13.5, textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', color: row.idx === active ? 'var(--active-fg)' : 'var(--text-secondary)' }}>
                    {row.cmd.icon}
                  </span>
                  <span style={{ flex: 1, fontWeight: row.idx === active ? 600 : 400 }}>{row.cmd.title}</span>
                  {row.cmd.hint && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{row.cmd.hint}</span>
                  )}
                </button>
              ),
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
