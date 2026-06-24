import type { SubtitleOptions } from './video';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'merging'
  | 'converting'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface ProgressPayload {
  jobId: string;
  progress: number;      // 0–100
  speed: string;         // e.g. "2.5MiB/s"
  eta: string;           // e.g. "00:30"
  status: DownloadStatus;
  totalSize?: string;    // e.g. "123.4MiB"
}

export interface DownloadJob {
  jobId: string;
  url: string;
  title: string;
  thumbnail?: string;
  uploader?: string;
  duration?: number;
  quality: string;        // e.g. '1080p', 'best', 'audio'
  audioOnly: boolean;
  subtitleOptions: SubtitleOptions;
  outputPath?: string;
  filePath?: string;      // set on completion
  fileSize?: number;      // bytes
  format: string;         // 'mp4' | 'mp3'
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  createdAt: number;      // unix ms
  completedAt?: number;   // unix ms
}

export interface DownloadOptions {
  url: string;
  quality: string;
  audioOnly: boolean;
  subtitleOptions: SubtitleOptions;
  outputDir?: string;     // overrides settings if provided
}

export interface QueueState {
  jobs: DownloadJob[];
  activeCount: number;
  maxConcurrent: number;
}

/**
 * Compact status-patch payload sent by `queue://updated` events.
 * Matches the Rust `QueueUpdatedPayload` / `QueueJobDto` structs exactly.
 * Only contains fields that the manager tracks — no subtitle options or full metadata.
 */
export interface QueueJobPatch {
  jobId: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  error?: string | null;
}

export interface QueuePatch {
  jobs: QueueJobPatch[];
  activeCount: number;
  maxConcurrent: number;
}
