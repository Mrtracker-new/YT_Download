import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { VideoInfo, PlaylistInfo } from '../types/video';
import type { DownloadOptions, DownloadJob, QueueState, QueuePatch, ProgressPayload } from '../types/download';
import type { AppSettings, BinaryStatus } from '../types/settings';

// ─── Environment Detection ─────────────────────────────────────────────────────
// In Tauri v2, __TAURI_INTERNALS__ is always available in the WebView.
// In a browser, it is undefined. This flag is set once at module load time.
export const IS_TAURI: boolean = typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

// ─── Video Commands ────────────────────────────────────────────────────────────

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  return invoke<VideoInfo>('get_video_info', { url });
}

export async function getPlaylistInfo(url: string): Promise<PlaylistInfo> {
  return invoke<PlaylistInfo>('get_playlist_info', { url });
}

// ─── Download Commands ─────────────────────────────────────────────────────────

export async function startDownload(opts: DownloadOptions): Promise<string> {
  return invoke<string>('start_download', { opts });
}

export async function cancelDownload(jobId: string): Promise<void> {
  return invoke<void>('cancel_download', { jobId });
}

export async function pauseDownload(jobId: string): Promise<void> {
  return invoke<void>('pause_download', { jobId });
}

export async function resumeDownload(jobId: string): Promise<void> {
  return invoke<void>('resume_download', { jobId });
}

export async function retryDownload(jobId: string): Promise<void> {
  return invoke<void>('retry_download', { jobId });
}

export async function getQueue(): Promise<QueueState> {
  return invoke<QueueState>('get_queue');
}

// ─── History Commands ──────────────────────────────────────────────────────────

export async function getHistory(page = 0, pageSize = 50): Promise<DownloadJob[]> {
  return invoke<DownloadJob[]>('get_history', { page, pageSize });
}

export async function deleteHistoryItem(jobId: string): Promise<void> {
  return invoke<void>('delete_history_item', { jobId });
}

export async function clearHistory(): Promise<void> {
  return invoke<void>('clear_history');
}

// ─── Settings Commands ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// ─── System Commands ───────────────────────────────────────────────────────────

export async function openFolder(path: string): Promise<void> {
  return invoke<void>('open_folder', { path });
}

export async function checkBinaries(): Promise<BinaryStatus> {
  return invoke<BinaryStatus>('check_binaries');
}

export async function selectFolder(): Promise<string | null> {
  return invoke<string | null>('select_folder');
}

export async function selectCookieFile(): Promise<string | null> {
  return invoke<string | null>('select_cookie_file');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

export type { UnlistenFn };

export function onDownloadProgress(
  callback: (payload: ProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<ProgressPayload>('download://progress', (event) =>
    callback(event.payload)
  );
}

export function onDownloadComplete(
  callback: (payload: { jobId: string; filePath: string; fileName: string }) => void
): Promise<UnlistenFn> {
  return listen<{ jobId: string; filePath: string; fileName: string }>(
    'download://complete',
    (event) => callback(event.payload)
  );
}

export function onDownloadError(
  callback: (payload: { jobId: string; error: string }) => void
): Promise<UnlistenFn> {
  return listen<{ jobId: string; error: string }>(
    'download://error',
    (event) => callback(event.payload)
  );
}

export function onDownloadCancelled(
  callback: (payload: { jobId: string }) => void
): Promise<UnlistenFn> {
  return listen<{ jobId: string }>(
    'download://cancelled',
    (event) => callback(event.payload)
  );
}

export function onDownloadPaused(
  callback: (payload: { jobId: string }) => void
): Promise<UnlistenFn> {
  return listen<{ jobId: string }>(
    'download://paused',
    (event) => callback(event.payload)
  );
}

export function onDownloadResumed(
  callback: (payload: { jobId: string }) => void
): Promise<UnlistenFn> {
  return listen<{ jobId: string }>(
    'download://resumed',
    (event) => callback(event.payload)
  );
}

export function onQueueUpdated(
  callback: (payload: QueuePatch) => void
): Promise<UnlistenFn> {
  return listen<QueuePatch>('queue://updated', (event) =>
    callback(event.payload)
  );
}

// ─── Setup Commands ───────────────────────────────────────────────────────────

export interface SetupProgress {
  name: string;
  progress: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message: string;
}

export interface BinaryCheckResult {
  ytdlpFound: boolean;
  ffmpegFound: boolean;
  ffprobeFound: boolean;
  ytdlpPath: string | null;
  ffmpegPath: string | null;
  needsSetup: boolean;
}

export async function checkSetup(): Promise<BinaryCheckResult> {
  return invoke<BinaryCheckResult>('check_setup');
}

export async function downloadYtdlp(): Promise<string> {
  return invoke<string>('download_ytdlp');
}

export async function downloadFfmpeg(): Promise<string> {
  return invoke<string>('download_ffmpeg');
}

export function onSetupProgress(
  callback: (payload: SetupProgress) => void
): Promise<UnlistenFn> {
  return listen<SetupProgress>('setup://progress', (event) =>
    callback(event.payload)
  );
}
