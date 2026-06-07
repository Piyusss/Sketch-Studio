import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sketch-theme';

function loadTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' ? 'dark' : 'light'; // default light
}

/** Reflect the active theme onto <html data-theme> so CSS variables cascade. */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

// Apply immediately on module load so there's no flash of the wrong theme.
applyTheme(loadTheme());

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: loadTheme(),

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
