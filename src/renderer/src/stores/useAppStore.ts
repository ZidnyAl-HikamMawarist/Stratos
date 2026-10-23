import { create } from 'zustand';
import {
  StratosTheme,
  StratosLocale,
  StratosScreen,
  AppMetadata,
} from '../../../shared/types';
import { translations, Translations } from '../i18n';

interface AppState {
  theme: StratosTheme;
  locale: StratosLocale;
  currentScreen: StratosScreen;
  metadata: AppMetadata | null;
  t: Translations;

  workspaceMode: 'ide' | 'opencode';
  setWorkspaceMode: (mode: 'ide' | 'opencode') => void;
  setTheme: (theme: StratosTheme) => void;
  toggleTheme: () => void;
  setLocale: (locale: StratosLocale) => void;
  setCurrentScreen: (screen: StratosScreen) => void;
  setMetadata: (meta: AppMetadata) => void;
  initialize: () => Promise<void>;
}

const STORAGE_KEY_THEME = 'stratos_theme';
const STORAGE_KEY_LOCALE = 'stratos_locale';

// Read initial stored values or fallback to PRD defaults
const getInitialTheme = (): StratosTheme => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    return stored === 'nordic' ? 'nordic' : 'obsidian';
  }
  return 'obsidian';
};

const getInitialLocale = (): StratosLocale => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY_LOCALE);
    return stored === 'en-US' ? 'en-US' : 'id-ID';
  }
  return 'id-ID';
};

export const useAppStore = create<AppState>((set, get) => ({
  theme: getInitialTheme(),
  locale: getInitialLocale(),
  currentScreen: 'launcher',
  workspaceMode: 'ide',
  metadata: null,
  t: translations[getInitialLocale()],

  setWorkspaceMode: (mode: 'ide' | 'opencode') => {
    set({ workspaceMode: mode });
  },

  setTheme: (theme: StratosTheme) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    }
    // Apply class to html/body if document is defined
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'nordic') {
        root.classList.add('nordic');
        root.classList.remove('obsidian');
      } else {
        root.classList.add('obsidian');
        root.classList.remove('nordic');
      }
    }
    // Also notify main process via preload if available
    if (typeof window !== 'undefined' && window.stratos?.theme) {
      window.stratos.theme.set(theme).catch(() => {});
    }
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'obsidian' ? 'nordic' : 'obsidian';
    get().setTheme(nextTheme);
  },

  setLocale: (locale: StratosLocale) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LOCALE, locale);
    }
    if (typeof window !== 'undefined' && window.stratos?.locale) {
      window.stratos.locale.set(locale).catch(() => {});
    }
    set({
      locale,
      t: translations[locale],
    });
  },

  setCurrentScreen: (screen: StratosScreen) => {
    set({ currentScreen: screen });
  },

  setMetadata: (metadata: AppMetadata) => {
    set({ metadata });
  },

  initialize: async () => {
    const initialTheme = get().theme;
    const initialLocale = get().locale;

    get().setTheme(initialTheme);
    get().setLocale(initialLocale);

    // Fetch live metadata from Electron Main through the secure Preload bridge
    if (typeof window !== 'undefined' && window.stratos?.getAppMetadata) {
      try {
        const meta = await window.stratos.getAppMetadata();
        set({ metadata: meta });
      } catch (err) {
        console.warn('[Store] Could not retrieve app metadata from Electron:', err);
      }
    }
  },
}));
