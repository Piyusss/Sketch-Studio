import React from 'react';
import { TbSun, TbMoon } from 'react-icons/tb';
import { useThemeStore } from '../store/themeStore';

/**
 * Light/dark theme toggle.
 *
 * `variant="floating"` (default) sits at bottom-left, just right of the
 * BgPicker swatch, for the canvas editor chrome.
 *
 * `variant="inline"` drops the absolute positioning so it can sit inline
 * inside a nav/header bar (LandingPage, DocsPage) — same look and behaviour,
 * just laid out by its parent instead of pinned to the viewport corner.
 *
 * Either way it themes only the surrounding chrome — the canvas background
 * itself is controlled independently via the BgPicker.
 */
export function ThemeToggle({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';
  const floating = variant === 'floating';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        ...(floating
          ? { position: 'absolute', bottom: 16, left: 56, zIndex: 100, boxShadow: 'var(--panel-shadow)' }
          : { position: 'relative', boxShadow: 'none' }),
        width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--panel-border)',
        background: 'var(--panel-translucent)',
        backdropFilter: 'blur(8px)',
        color: 'var(--text-secondary)',
        cursor: 'pointer', padding: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-bg)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-translucent)'; }}
    >
      {isDark ? <TbSun size={16} /> : <TbMoon size={16} />}
    </button>
  );
}
