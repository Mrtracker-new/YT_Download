import { useEffect, useRef } from 'react';
import { useQueueStore } from '../store/queueStore';
import { useSettingsStore } from '../store/settingsStore';
import { notify } from '../services/notifications';
import {
  onDownloadProgress,
  onDownloadComplete,
  onDownloadError,
  onDownloadCancelled,
  onDownloadPaused,
  onDownloadResumed,
  onQueueUpdated,
  IS_TAURI,
  type UnlistenFn,
} from '../services/tauriApi';

/**
 * Hook that subscribes to all Tauri download events and syncs them into Zustand.
 * Mount ONCE at the App level. No-ops safely when running outside Tauri (e.g., browser).
 *
 * Event flow (two separate data shapes):
 *   download://progress  → updateProgress    (guards paused/cancelled status)
 *   download://complete  → markComplete
 *   download://error     → markError
 *   download://cancelled → markCancelled     (emitted AFTER process is dead)
 *   download://paused    → markPaused        (emitted AFTER process is dead — no race)
 *   download://resumed   → markResumed
 *   queue://updated      → applyQueuePatch   (compact patch — NEVER full DownloadJob)
 *
 * IMPORTANT: `queue://updated` sends a QueuePatch (compact status-only DTO), NOT a
 * full QueueState. Always use applyQueuePatch for events, setQueueState for getQueue().
 */
export function useQueue() {
  const updateProgress = useQueueStore((s) => s.updateProgress);
  const markComplete = useQueueStore((s) => s.markComplete);
  const markError = useQueueStore((s) => s.markError);
  const markCancelled = useQueueStore((s) => s.markCancelled);
  const markPaused = useQueueStore((s) => s.markPaused);
  const markResumed = useQueueStore((s) => s.markResumed);
  const applyQueuePatch = useQueueStore((s) => s.applyQueuePatch);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    if (!IS_TAURI) return;

    let cancelled = false;

    const setup = async () => {
      const unlisteners = await Promise.all([
        onDownloadProgress((payload) => {
          if (!cancelled) updateProgress(payload);
        }),
        onDownloadComplete((payload) => {
          if (cancelled) return;
          // Capture title BEFORE markComplete (job stays in store, but read it now).
          const job = useQueueStore.getState().jobs.find((j) => j.jobId === payload.jobId);
          markComplete(payload.jobId, payload.filePath);
          if (useSettingsStore.getState().settings.showNotifications) {
            void notify('Download complete', job?.title ?? 'Your download has finished.');
          }
        }),
        onDownloadError((payload) => {
          if (!cancelled) markError(payload.jobId, payload.error);
        }),
        onDownloadCancelled((payload) => {
          if (!cancelled) markCancelled(payload.jobId);
        }),
        onDownloadPaused((payload) => {
          if (!cancelled) markPaused(payload.jobId);
        }),
        onDownloadResumed((payload) => {
          if (!cancelled) markResumed(payload.jobId);
        }),
        // Use applyQueuePatch — NOT setQueueState — because queue://updated sends
        // compact QueueJobPatch objects, not full DownloadJob objects.
        onQueueUpdated((patch) => {
          if (!cancelled) applyQueuePatch(patch);
        }),
      ]);

      if (!cancelled) {
        unlistenersRef.current = unlisteners;
      } else {
        unlisteners.forEach((fn) => fn());
      }
    };

    setup().catch(console.error);

    return () => {
      cancelled = true;
      unlistenersRef.current.forEach((fn) => fn());
      unlistenersRef.current = [];
    };
  }, [updateProgress, markComplete, markError, markCancelled, markPaused, markResumed, applyQueuePatch]);

  return {
    jobs: useQueueStore((s) => s.jobs),
    activeCount: useQueueStore((s) => s.activeCount),
    maxConcurrent: useQueueStore((s) => s.maxConcurrent),
  };
}
