import { useState, useCallback } from 'react';
import { useQueueStore } from '../store/queueStore';
import { getVideoInfo, startDownload } from '../services/tauriApi';
import type { VideoInfo, SubtitleOptions } from '../types/video';
import type { DownloadJob, AdvancedOptions } from '../types/download';
import { DEFAULT_ADVANCED_OPTIONS } from '../types/download';

/**
 * Hook that manages the full download flow:
 * 1. Fetch video info
 * 2. Start download via Tauri (returns job_id)
 * 3. Add job to Zustand queue store
 *
 * Progress updates arrive via Tauri events (handled in useQueue).
 */
export function useDownload() {
  const addJob = useQueueStore((s) => s.addJob);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchVideoInfo = useCallback(async (url: string) => {
    setIsFetching(true);
    setFetchError(null);
    setVideoInfo(null);
    try {
      const info = await getVideoInfo(url);
      setVideoInfo(info);
      return info;
    } catch (err) {
      // Tauri returns Err(String) as a raw string, not an Error object
      const msg = typeof err === 'string'
        ? err
        : (err instanceof Error ? err.message : null) ?? 'Failed to fetch video info';
      setFetchError(msg);
      return null;
    } finally {
      setIsFetching(false);
    }
  }, []);

  const queueDownload = useCallback(
    async (opts: {
      url: string;
      quality: string;
      audioOnly: boolean;
      subtitleOptions: SubtitleOptions;
      advanced?: AdvancedOptions;
    }): Promise<string | null> => {
      try {
        const advanced = opts.advanced ?? DEFAULT_ADVANCED_OPTIONS;
        const jobId = await startDownload({
          url: opts.url,
          quality: opts.quality,
          audioOnly: opts.audioOnly,
          subtitleOptions: opts.subtitleOptions,
          advanced,
        });

        // Optimistically add to UI queue
        const job: DownloadJob = {
          jobId,
          url: opts.url,
          title: videoInfo?.title ?? 'Fetching…',
          thumbnail: videoInfo?.thumbnail,
          uploader: videoInfo?.uploader,
          duration: videoInfo?.duration,
          quality: opts.quality,
          audioOnly: opts.audioOnly,
          subtitleOptions: opts.subtitleOptions,
          format: opts.audioOnly ? 'mp3' : 'mp4',
          status: 'queued',
          progress: 0,
          speed: '',
          eta: '',
          createdAt: Date.now(),
        };

        addJob(job);
        return jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start download';
        throw new Error(msg);
      }
    },
    [videoInfo, addJob]
  );

  const clearVideoInfo = useCallback(() => {
    setVideoInfo(null);
    setFetchError(null);
  }, []);

  return {
    videoInfo,
    isFetching,
    fetchError,
    fetchVideoInfo,
    queueDownload,
    clearVideoInfo,
  };
}
