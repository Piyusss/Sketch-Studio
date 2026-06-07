import React, { useEffect, useRef, useState } from 'react';
import { TbMap2, TbChevronDown } from 'react-icons/tb';
import { useCanvasStore } from '../store/canvasStore';
import { cameraHandle, centerOnWorld } from '../engine/cameraControl';
import type { CanvasObject } from '../types';

const MAP_W = 180;
const MAP_H = 120;
const PAD = 10; // inner padding in minimap pixels

interface Bounds { minX: number; minY: number; maxX: number; maxY: number; }

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Bird's-eye overview of the whole sketch. Draws every top-level object's
 * bounding box plus the live viewport rectangle, and recenters the camera on
 * click/drag. Self-renders via rAF but only repaints when something changed.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let sig = '';

    const computeBounds = (objs: CanvasObject[], cam: { x: number; y: number; zoom: number }): Bounds => {
      let b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const o of objs) {
        if (o.parentId) continue;
        b.minX = Math.min(b.minX, o.x);
        b.minY = Math.min(b.minY, o.y);
        b.maxX = Math.max(b.maxX, o.x + o.width);
        b.maxY = Math.max(b.maxY, o.y + o.height);
      }
      // Always include the current viewport so "you are here" is visible.
      const vw = window.innerWidth / cam.zoom;
      const vh = window.innerHeight / cam.zoom;
      b.minX = Math.min(b.minX, cam.x);
      b.minY = Math.min(b.minY, cam.y);
      b.maxX = Math.max(b.maxX, cam.x + vw);
      b.maxY = Math.max(b.maxY, cam.y + vh);
      if (!isFinite(b.minX)) b = { minX: cam.x, minY: cam.y, maxX: cam.x + vw, maxY: cam.y + vh };
      return b;
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cam = cameraHandle.current;
      if (!cam) return;
      const store = useCanvasStore.getState();
      const objs = Object.values(store.objects);

      // Cheap change-signature so we skip redundant repaints. `updatedAt` is
      // bumped by `updateObject` on every move/resize tick, so tracking the
      // newest one keeps the minimap live while dragging — not just at rest.
      let lastUpdate = 0;
      for (const o of objs) {
        if (!o.parentId && o.updatedAt > lastUpdate) lastUpdate = o.updatedAt;
      }
      const theme = document.documentElement.dataset.theme ?? 'light';
      const nextSig = `${objs.length}:${Math.round(cam.x)}:${Math.round(cam.y)}:${cam.zoom.toFixed(3)}:${store.selectedIds.length}:${theme}:${lastUpdate}`;
      if (nextSig === sig) return;
      sig = nextSig;

      const b = computeBounds(objs, cam);
      const spanX = Math.max(1, b.maxX - b.minX);
      const spanY = Math.max(1, b.maxY - b.minY);
      const scale = Math.min((MAP_W - PAD * 2) / spanX, (MAP_H - PAD * 2) / spanY);
      // Centre the content within the minimap
      const offsetX = (MAP_W - spanX * scale) / 2;
      const offsetY = (MAP_H - spanY * scale) / 2;
      const toMX = (wx: number) => offsetX + (wx - b.minX) * scale;
      const toMY = (wy: number) => offsetY + (wy - b.minY) * scale;

      ctx.clearRect(0, 0, MAP_W, MAP_H);

      const selected = new Set(store.selectedIds);
      const accent = cssVar('--accent', '#3b82f6');
      const objColor = cssVar('--text-muted', '#a1a1aa');

      for (const o of objs) {
        if (o.parentId || !o.visible) continue;
        const mx = toMX(o.x);
        const my = toMY(o.y);
        const mw = Math.max(1.5, o.width * scale);
        const mh = Math.max(1.5, o.height * scale);
        ctx.fillStyle = selected.has(o.id) ? accent : objColor;
        ctx.globalAlpha = selected.has(o.id) ? 0.9 : 0.5;
        ctx.fillRect(mx, my, mw, mh);
      }
      ctx.globalAlpha = 1;

      // Viewport rectangle
      const vx = toMX(cam.x);
      const vy = toMY(cam.y);
      const vw = (window.innerWidth / cam.zoom) * scale;
      const vh = (window.innerHeight / cam.zoom) * scale;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(vx, vy, vw, vh);
      ctx.globalAlpha = 1;

      // Stash transform for click → world mapping
      navState = { b, scale, offsetX, offsetY };
    };

    let navState: { b: Bounds; scale: number; offsetX: number; offsetY: number } | null = null;

    const navigate = (clientX: number, clientY: number) => {
      const canvasEl = canvasRef.current;
      if (!canvasEl || !navState) return;
      const rect = canvasEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const wx = navState.b.minX + (mx - navState.offsetX) / navState.scale;
      const wy = navState.b.minY + (my - navState.offsetY) / navState.scale;
      centerOnWorld(wx, wy);
    };

    const onDown = (e: PointerEvent) => {
      draggingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      navigate(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => { if (draggingRef.current) navigate(e.clientX, e.clientY); };
    const onUp = (e: PointerEvent) => { draggingRef.current = false; try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ } };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [collapsed]);

  return (
    <div
      style={{
        position: 'absolute', bottom: 58, right: 16, zIndex: 100,
        background: 'var(--panel-translucent)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--panel-border)', borderRadius: 10,
        boxShadow: 'var(--panel-shadow)', overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif', userSelect: 'none',
      }}
    >
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          borderBottom: collapsed ? 'none' : '1px solid var(--divider)',
        }}
        title={collapsed ? 'Show minimap' : 'Hide minimap'}
      >
        <TbMap2 size={13} />
        <span style={{ flex: 1 }}>Minimap</span>
        <TbChevronDown
          size={13}
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </div>
      {!collapsed && (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: MAP_W, height: MAP_H, cursor: 'pointer' }}
        />
      )}
    </div>
  );
}
