import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { IS_TAURI } from './tauriApi';

/**
 * Ensure OS notification permission is granted, requesting it once if needed.
 * Returns false (and never throws) when running outside Tauri or when denied.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!IS_TAURI) return false;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === 'granted';
    }
    return granted;
  } catch (err) {
    console.error('notification permission check failed:', err);
    return false;
  }
}

/**
 * Fire a desktop notification. No-ops safely outside Tauri or when permission
 * is denied. Never throws — notification failures must not break callers.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (!IS_TAURI) return;
  try {
    if (!(await ensureNotificationPermission())) return;
    sendNotification({ title, body });
  } catch (err) {
    console.error('sendNotification failed:', err);
  }
}
