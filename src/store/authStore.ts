import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoaded: boolean;

  loadFromStorage: () => void;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

const TOKEN_KEY = 'sketch-auth-token';
const USER_KEY  = 'sketch-auth-user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoaded: false,

  loadFromStorage: () => {
    const token   = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AuthUser;
        set({ token, user, isLoaded: true });
        return;
      } catch { /* corrupted — fall through */ }
    }
    set({ isLoaded: true });
  },

  signIn: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isLoaded: true });
  },

  signOut: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isLoaded: true });
  },
}));
