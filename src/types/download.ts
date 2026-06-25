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

export type VideoCodec = 'auto' | 'h264' | 'vp9' | 'av1';
export type AudioFormat = 'mp3' | 'opus' | 'm4a' | 'flac' | 'wav';
export type AudioBitrate = '128' | '192' | '256' | '320';
export type SponsorBlockCategory =
  | 'sponsor'
  | 'intro'
  | 'outro'
  | 'selfpromo'
  | 'interaction'
  | 'music_offtopic';

/** Advanced per-download format options (codec, audio, thumbnail, SponsorBlock). */
export interface AdvancedOptions {
  videoCodec: VideoCodec;
  audioFormat: AudioFormat;
  audioQuality: AudioBitrate;   // kbps for lossy formats; ignored for flac/wav
  embedThumbnail: boolean;
  sponsorblockCategories: SponsorBlockCategory[]; // empty = SponsorBlock disabled
}

export const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  videoCodec: 'auto',
  audioFormat: 'mp3',
  audioQuality: '192',
  embedThumbnail: false,
  sponsorblockCategories: [],
};

export interface DownloadOptions {
  url: string;
  quality: string;
  audioOnly: boolean;
  subtitleOptions: SubtitleOptions;
  outputDir?: string;     // overrides settings if provided
  advanced: AdvancedOptions;
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
