import React from 'react';
import { TbSun, TbMoon } from 'react-icons/tb';
import { useThemeStore } from '../store/themeStore';

/**
 * Floating light/dark theme toggle. Sits at bottom-left, just right of the
 * BgPicker swatch. Themes only the app chrome — the canvas background is
 * controlled independently via the BgPicker.
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        position: 'absolute', bottom: 16, left: 56, zIndex: 100,
        width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--panel-border)',
        background: 'var(--panel-translucent)',
        backdropFilter: 'blur(8px)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--panel-shadow)',
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
