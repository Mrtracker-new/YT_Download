import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    immer((set) => ({
      settings: DEFAULT_SETTINGS,
      isLoaded: false,

      setSettings: (settings) =>
        set((state) => {
          state.settings = settings;
          state.isLoaded = true;
        }),

      updateSetting: (key, value) =>
        set((state) => {
          (state.settings as Record<string, unknown>)[key] = value;
        }),

      setLoaded: (loaded) =>
        set((state) => {
          state.isLoaded = loaded;
        }),
    })),
    {
      name: 'yt-downloader-settings',
      // Only persist theme locally for instant load; rest comes from Rust/SQLite
      partialize: (state) => ({
        settings: { theme: state.settings.theme },
      }),
    }
  )
);
