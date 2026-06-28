import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store/settingsStore';
import { saveSettings, IS_TAURI } from '../services/tauriApi';
import {
  checkAppUpdate,
  checkYtdlpUpdate,
  type AppUpdateInfo,
  type YtdlpUpdateInfo,
} from '../services/updaterService';

const STARTUP_DELAY_MS = 3000;

export interface UpdateState {
  appUpdate: AppUpdateInfo | null;
  ytdlpUpdate: YtdlpUpdateInfo | null;
  ytdlpUpdating: boolean;
  dismissAppUpdate: () => void;
  skipAppVersion: (version: string) => void;
  startYtdlpUpdate: () => void;
  onYtdlpDone: () => void;
}

/**
 * Owns the whole startup update lifecycle: checks both the app and yt-dlp for
 * newer releases ~3s after launch, surfaces a banner (app) and a toast (yt-dlp),
 * and persists the user's "skip this version" choice. All checks fail silently —
 * offline or rate-limited launches show no UI.
 */
export function useUpdateChecker(): UpdateState {
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [ytdlpUpdate, setYtdlpUpdate] = useState<YtdlpUpdateInfo | null>(null);
  const [ytdlpUpdating, setYtdlpUpdating] = useState(false);

  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const skippedVersion = settings.skippedAppVersion;

  const startYtdlpUpdate = () => setYtdlpUpdating(true);

  // Stable refs so the one-shot startup effect reads the latest values without
  // re-running when settings change.
  const startYtdlpUpdateRef = useRef(startYtdlpUpdate);
  startYtdlpUpdateRef.current = startYtdlpUpdate;
  const skippedVersionRef = useRef(skippedVersion);
  skippedVersionRef.current = skippedVersion;

  useEffect(() => {
    if (!IS_TAURI) return;

    const timer = setTimeout(async () => {
      const [app, ytdlp] = await Promise.allSettled([
        checkAppUpdate(),
        checkYtdlpUpdate(),
      ]);

      if (app.status === 'fulfilled' && app.value.available) {
        // Hide the banner if the user already skipped this exact version.
        if (app.value.latestVersion !== skippedVersionRef.current) {
          setAppUpdate(app.value);
        }
      } else if (app.status === 'rejected') {
        console.warn('App update check failed:', app.reason);
      }

      if (ytdlp.status === 'fulfilled' && ytdlp.value.available) {
        setYtdlpUpdate(ytdlp.value);
        showYtdlpUpdateToast(ytdlp.value, () => startYtdlpUpdateRef.current());
      } else if (ytdlp.status === 'rejected') {
        console.warn('yt-dlp update check failed:', ytdlp.reason);
      }
    }, STARTUP_DELAY_MS);

    return () => clearTimeout(timer);
    // Intentionally run once on mount — refs keep handlers fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissAppUpdate = () => setAppUpdate(null);

  const skipAppVersion = (version: string) => {
    const updated = { ...settings, skippedAppVersion: version };
    setSettings(updated);
    saveSettings(updated).catch(console.error);
    setAppUpdate(null);
  };

  const onYtdlpDone = () => {
    setYtdlpUpdating(false);
    setYtdlpUpdate(null);
  };

  return {
    appUpdate,
    ytdlpUpdate,
    ytdlpUpdating,
    dismissAppUpdate,
    skipAppVersion,
    startYtdlpUpdate,
    onYtdlpDone,
  };
}

/** Sketch-styled toast offering to update yt-dlp. */
function showYtdlpUpdateToast(info: YtdlpUpdateInfo, onUpdate: () => void) {
  toast(
    (t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>yt-dlp update available</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.85 }}>
          {info.currentVersion} → {info.latestVersion}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            className="sketch-button"
            onClick={() => {
              toast.dismiss(t.id);
              onUpdate();
            }}
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.95rem' }}
          >
            Update yt-dlp
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: '"Patrick Hand", cursive',
              fontWeight: 600,
              background: 'transparent',
              border: '2px dashed rgba(128,128,128,0.6)',
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              color: 'inherit',
            }}
          >
            Later
          </button>
        </div>
      </div>
    ),
    { duration: 12000 }
  );
}
