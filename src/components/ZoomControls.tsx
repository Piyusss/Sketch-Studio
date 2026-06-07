import React, { useEffect, useRef } from 'react';
import { TbMinus, TbPlus, TbMaximize } from 'react-icons/tb';
import { useCanvasStore } from '../store/canvasStore';
import { cameraHandle, zoomBy, resetZoom, zoomToFit } from '../engine/cameraControl';

const ZOOM_STEP_IN = 1.25;
const ZOOM_STEP_OUT = 0.8;

/**
 * Bottom-right zoom cluster: − / live-percent / + plus a "fit to content"
 * button. Reads the live camera every frame and writes the percent straight to
 * the DOM, so it never triggers React re-renders during pan/zoom.
 */
export function ZoomControls() {
  const percentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      const cam = cameraHandle.current;
      if (cam && percentRef.current) {
        const pct = Math.round(cam.zoom * 100);
        if (pct !== last) {
          last = pct;
          percentRef.current.textContent = `${pct}%`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const wrap: React.CSSProperties = {
    position: 'absolute', bottom: 16, right: 16, zIndex: 100,
    display: 'flex', alignItems: 'center',
    background: 'var(--panel-translucent)', backdropFilter: 'blur(8px)',
    border: '1px solid var(--panel-border)', borderRadius: 8,
    boxShadow: 'var(--panel-shadow)', userSelect: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, border: 'none', background: 'transparent',
    color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 8,
  };

  const hoverOn = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; };
  const hoverOff = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; };

  return (
    <div style={wrap}>
      <button style={iconBtn} title="Zoom out (Ctrl -)" onClick={() => zoomBy(ZOOM_STEP_OUT)}
        onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <TbMinus size={15} />
      </button>

      <button
        ref={percentRef}
        title="Reset to 100%"
        onClick={() => resetZoom()}
        style={{
          minWidth: 46, height: 30, border: 'none', background: 'transparent',
          color: 'var(--text-primary)', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}
        onMouseEnter={hoverOn} onMouseLeave={hoverOff}
      >
        100%
      </button>

      <button style={iconBtn} title="Zoom in (Ctrl +)" onClick={() => zoomBy(ZOOM_STEP_IN)}
        onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <TbPlus size={15} />
      </button>

      <div style={{ width: 1, height: 18, background: 'var(--divider)' }} />

      <button style={iconBtn} title="Fit to content (Shift+1)"
        onClick={() => zoomToFit(Object.values(useCanvasStore.getState().objects))}
        onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <TbMaximize size={15} />
      </button>
    </div>
  );
}
