import { invoke } from '@tauri-apps/api/core';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppUpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null; // first 500 chars of the GitHub release body
  pubDate: string | null;
  releaseUrl: string; // HTML URL opened in the browser on click
}

export interface YtdlpUpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
}

// ─── Command wrappers ─────────────────────────────────────────────────────────

/** Check GitHub for a newer app release. Rejects on network/parse error. */
export async function checkAppUpdate(): Promise<AppUpdateInfo> {
  return invoke<AppUpdateInfo>('check_app_update');
}

/** Check GitHub for a newer yt-dlp release vs the local binary. */
export async function checkYtdlpUpdate(): Promise<YtdlpUpdateInfo> {
  return invoke<YtdlpUpdateInfo>('check_ytdlp_update');
}

/** Open a release page (or any URL) in the default browser. */
export async function openReleasePage(url: string): Promise<void> {
  return invoke<void>('open_release_page', { url });
}

/** Re-download yt-dlp. Drives the existing `setup://progress` event stream. */
export async function updateYtdlp(): Promise<string> {
  return invoke<string>('update_ytdlp');
}
