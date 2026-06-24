import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { getSettings, saveSettings, IS_TAURI } from '../services/tauriApi';
import type { AppSettings } from '../types/settings';

/**
 * Hook to load and persist application settings via Tauri/SQLite.
 */
export function useSettings() {
  const { settings, isLoaded, setSettings, updateSetting } = useSettingsStore();

  // Load settings from Rust/SQLite on first mount
  useEffect(() => {
    if (isLoaded || !IS_TAURI) return;
    getSettings()
      .then((s) => { if (s) setSettings(s); })
      .catch(console.error);
  }, [isLoaded, setSettings]);

  const save = useCallback(
    async (partial?: Partial<AppSettings>) => {
      const updated = partial ? { ...settings, ...partial } : settings;
      setSettings(updated);
      await saveSettings(updated);
    },
    [settings, setSettings]
  );

  return { settings, isLoaded, save, updateSetting };
}
