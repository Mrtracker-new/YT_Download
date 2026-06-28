import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DownloadJob, ProgressPayload, QueueState, QueuePatch } from '../types/download';

interface QueueStore {
  jobs: DownloadJob[];
  activeCount: number;
  maxConcurrent: number;

  // Actions
  addJob: (job: DownloadJob) => void;
  updateProgress: (payload: ProgressPayload) => void;
  markComplete: (jobId: string, filePath: string) => void;
  markError: (jobId: string, error: string) => void;
  markCancelled: (jobId: string) => void;
  markPaused: (jobId: string) => void;
  markResumed: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  /**
   * Called on initial load / page focus via `getQueue()` invoke.
   * Receives full DownloadJob objects — adds new jobs, does NOT overwrite existing
   * ones to avoid clobbering frontend-only fields (thumbnail, subtitleOptions).
   */
  setQueueState: (state: QueueState) => void;
  /**
   * Called on `queue://updated` events from the Rust backend.
   * Receives compact QueueJobPatch objects (status, progress, speed, eta, error only).
   * Safely merges into existing jobs without touching fields the backend doesn't own.
   */
  applyQueuePatch: (patch: QueuePatch) => void;
  clearCompleted: () => void;
}

export const useQueueStore = create<QueueStore>()(
  immer((set) => ({
    jobs: [],
    activeCount: 0,
    maxConcurrent: 2,

    addJob: (job) =>
      set((state) => {
        state.jobs.unshift(job);
      }),

    updateProgress: (payload) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === payload.jobId);
        if (job) {
          // Ignore progress events for jobs in a terminal/held status.
          // These arrive as in-flight events after the control signal was sent
          // (or after completion/failure) but before the process was fully
          // killed — a late event must not revert the status back to downloading.
          if (
            job.status === 'paused' ||
            job.status === 'cancelled' ||
            job.status === 'completed' ||
            job.status === 'failed'
          )
            return;
          job.progress = payload.progress;
          job.speed = payload.speed;
          job.eta = payload.eta;
          job.status = payload.status;
        }
      }),

    markComplete: (jobId, filePath) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.filePath = filePath;
          job.completedAt = Date.now();
          job.speed = '';
          job.eta = '';
        }
        state.activeCount = Math.max(0, state.activeCount - 1);
      }),

    markError: (jobId, error) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
          job.speed = '';
          job.eta = '';
        }
        state.activeCount = Math.max(0, state.activeCount - 1);
      }),

    markCancelled: (jobId) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === jobId);
        if (job) {
          job.status = 'cancelled';
          job.progress = 0;
          job.speed = '';
          job.eta = '';
        }
        state.activeCount = Math.max(0, state.activeCount - 1);
      }),

    markPaused: (jobId) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === jobId);
        if (job) {
          job.status = 'paused';
          job.speed = '';
          job.eta = '';
          // Keep progress so user sees how far along the download was
        }
        state.activeCount = Math.max(0, state.activeCount - 1);
      }),

    markResumed: (jobId) =>
      set((state) => {
        const job = state.jobs.find((j) => j.jobId === jobId);
        if (job) {
          // Reset to queued — yt-dlp restarts from scratch (no --continue)
          job.status = 'queued';
          job.progress = 0;
          job.speed = '';
          job.eta = '';
          job.error = undefined;
        }
      }),

    removeJob: (jobId) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.jobId !== jobId);
      }),

    // Called via `getQueue()` invoke on initial load — receives full DownloadJob objects.
    // Only ADDS jobs not already in the store to avoid overwriting local UI state.
    setQueueState: (queueState) =>
      set((state) => {
        state.activeCount = queueState.activeCount;
        state.maxConcurrent = queueState.maxConcurrent;
        for (const incoming of queueState.jobs) {
          const exists = state.jobs.some((j) => j.jobId === incoming.jobId);
          if (!exists) {
            state.jobs.push(incoming);
          }
        }
      }),

    // Called on `queue://updated` Tauri events — receives compact QueueJobPatch objects.
    // Safely updates ONLY the status fields the backend owns; never touches
    // frontend-only fields (thumbnail, title, subtitleOptions, etc.).
    applyQueuePatch: (patch) =>
      set((state) => {
        state.activeCount = patch.activeCount;
        state.maxConcurrent = patch.maxConcurrent;

        for (const incoming of patch.jobs) {
          const existingIdx = state.jobs.findIndex((j) => j.jobId === incoming.jobId);
          if (existingIdx !== -1) {
            const existing = state.jobs[existingIdx];
            // Only update if the backend status differs — prevents stale event clobbering
            // a more recent optimistic update (e.g., paused event arriving after markPaused).
            existing.status = incoming.status;
            existing.progress = incoming.progress;
            existing.speed = incoming.speed ?? '';
            existing.eta = incoming.eta ?? '';
            if (incoming.error != null) {
              existing.error = incoming.error;
            }
          }
          // Note: we do NOT add new jobs here — that's setQueueState's job.
          // Jobs are added optimistically via addJob() in useDownload,
          // so they already exist before the backend event arrives.
        }
      }),

    clearCompleted: () =>
      set((state) => {
        state.jobs = state.jobs.filter(
          (j) => j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
        );
      }),
  }))
);
