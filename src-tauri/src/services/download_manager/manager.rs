use anyhow::{anyhow, Result};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, Mutex};
use tokio::task::JoinHandle;

use super::job::{ControlSignal, DownloadJob, DownloadOptions, JobStatus};
use crate::database::Database;
use crate::services::ytdlp::download::{
    run_download, CompleteEventPayload, DownloadArgs, ErrorEventPayload, ResumedEventPayload,
};

// ─── Queue-state event payload (sent to frontend after every state change) ─────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueJobDto {
    job_id: String,
    status: String,
    progress: f64,
    speed: String,
    eta: String,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueUpdatedPayload {
    active_count: usize,
    max_concurrent: usize,
    jobs: Vec<QueueJobDto>,
}

// ─── Manager ───────────────────────────────────────────────────────────────────

pub struct DownloadManager {
    pub jobs: HashMap<String, DownloadJob>,
    /// Tokio task handles for active downloads.
    /// The handle stays here until the task self-removes (after process exit + cleanup).
    /// We NEVER abort() these handles — that would prevent the kill watcher from running.
    active_handles: HashMap<String, JoinHandle<()>>,
    max_concurrent: usize,
    queue_order: Vec<String>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            jobs: HashMap::new(),
            active_handles: HashMap::new(),
            max_concurrent: 3,
            queue_order: Vec::new(),
        }
    }

    pub fn active_count(&self) -> usize {
        self.active_handles.len()
    }

    pub fn max_concurrent(&self) -> usize {
        self.max_concurrent
    }

    pub fn get_all_jobs(&self) -> Vec<DownloadJob> {
        let mut jobs: Vec<DownloadJob> = self.jobs.values().cloned().collect();
        jobs.sort_by(|a, b| {
            let priority = |j: &DownloadJob| -> i32 {
                match j.status {
                    JobStatus::Downloading
                    | JobStatus::Merging
                    | JobStatus::Converting
                    | JobStatus::Finalizing => 0,
                    JobStatus::Queued => 1,
                    JobStatus::Paused => 2,
                    _ => 3,
                }
            };
            priority(a)
                .cmp(&priority(b))
                .then(b.created_at.cmp(&a.created_at))
        });
        jobs
    }

    // ── Queue state broadcast ──────────────────────────────────────────────────

    /// Emit a `queue://updated` event so the frontend always has an authoritative
    /// view of job statuses after any state change. This is the single source of
    /// truth — it fixes the issue where the frontend could miss a paused/resumed
    /// transition if the optimistic UI update raced with a late progress event.
    fn emit_queue_updated(&self, app_handle: &AppHandle) {
        let payload = QueueUpdatedPayload {
            active_count: self.active_handles.len(),
            max_concurrent: self.max_concurrent,
            jobs: self
                .jobs
                .values()
                .map(|j| QueueJobDto {
                    job_id: j.job_id.clone(),
                    status: j.status.as_str().to_string(),
                    progress: j.progress,
                    speed: j.speed.clone(),
                    eta: j.eta.clone(),
                    error: j.error.clone(),
                })
                .collect(),
        };
        let _ = app_handle.emit("queue://updated", payload);
    }

    // ── Add ───────────────────────────────────────────────────────────────────

    /// Add a new job and immediately try to start it if a slot is free.
    pub async fn add_download(
        &mut self,
        opts: DownloadOptions,
        app_handle: AppHandle,
        db: Arc<Mutex<Database>>,
        self_arc: Arc<Mutex<DownloadManager>>,
    ) -> Result<()> {
        let job = DownloadJob::new(opts);
        let job_id = job.job_id.clone();

        self.queue_order.push(job_id.clone());
        self.jobs.insert(job_id.clone(), job);

        {
            let db_lock = db.lock().await;
            if let Ok(settings) = db_lock.get_settings() {
                self.max_concurrent = (settings.max_concurrent_downloads as usize).max(1);
            }
        }

        self.advance_queue(app_handle.clone(), db, self_arc);
        self.emit_queue_updated(&app_handle);
        Ok(())
    }

    // ── Advance queue ─────────────────────────────────────────────────────────

    /// Start as many queued jobs as available slots allow.
    /// SYNCHRONOUS by design — holding a tokio MutexGuard across an .await is !Send.
    /// All async work happens inside tokio::spawn, so the guard is never held
    /// across an await boundary.
    pub fn advance_queue(
        &mut self,
        app_handle: AppHandle,
        db: Arc<Mutex<Database>>,
        self_arc: Arc<Mutex<DownloadManager>>,
    ) {
        // Purge handles for tasks that have already finished
        self.active_handles.retain(|_, h| !h.is_finished());
        let available = self
            .max_concurrent
            .saturating_sub(self.active_handles.len());
        if available == 0 {
            return;
        }

        let queued_ids: Vec<String> = self
            .queue_order
            .iter()
            .filter(|id| {
                self.jobs
                    .get(*id)
                    .is_some_and(|j| j.status == JobStatus::Queued)
            })
            .take(available)
            .cloned()
            .collect();

        for job_id in queued_ids {
            self.start_job(&job_id, app_handle.clone(), db.clone(), self_arc.clone());
        }
    }

    // ── Start job ─────────────────────────────────────────────────────────────

    /// Mark a job Downloading and spawn its worker task.
    ///
    /// Creates a FRESH `watch` channel for this attempt. The sender half is stored
    /// on the job struct (replaces the old cancel_flags map). The receiver is moved
    /// into the spawned task so the download engine can react to Pause/Cancel signals.
    fn start_job(
        &mut self,
        job_id: &str,
        app_handle: AppHandle,
        db: Arc<Mutex<Database>>,
        self_arc: Arc<Mutex<DownloadManager>>,
    ) {
        let job = match self.jobs.get_mut(job_id) {
            Some(j) => j,
            None => return,
        };

        job.status = JobStatus::Downloading;
        let opts = job.opts.clone();
        let jid = job_id.to_string();

        // Create a fresh control channel for this download attempt.
        // Initial value is Run — the process starts immediately.
        let (control_tx, control_rx) = watch::channel(ControlSignal::Run);
        // Store the sender on the job so pause_download / cancel_download can signal it.
        job.control_tx = control_tx;

        let handle = tokio::spawn(async move {
            let result = run_download(
                DownloadArgs {
                    job_id: jid.clone(),
                    url: opts.url.clone(),
                    quality: opts.quality.clone(),
                    audio_only: opts.audio_only,
                    subtitle_enabled: opts.subtitle_enabled,
                    subtitle_language: opts.subtitle_language.clone(),
                    subtitle_mode: opts.subtitle_mode.clone(),
                    subtitle_include_auto: opts.subtitle_include_auto,
                    output_dir: opts.output_dir.clone(),
                    file_name_template: opts.file_name_template.clone(),
                    cookie_browser: opts.cookie_browser.clone(),
                    cookie_file: opts.cookie_file.clone(),
                },
                app_handle.clone(),
                control_rx,
            )
            .await;

            match result {
                Ok(file_path) => {
                    let file_name = std::path::Path::new(&file_path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let file_size = std::fs::metadata(&file_path).map(|m| m.len()).ok();
                    let completed_at = chrono::Utc::now().timestamp_millis();

                    let _ = app_handle.emit(
                        "download://complete",
                        CompleteEventPayload {
                            job_id: jid.clone(),
                            file_path: file_path.clone(),
                            file_name: file_name.clone(),
                        },
                    );

                    {
                        let mut mgr = self_arc.lock().await;
                        mgr.active_handles.remove(&jid);
                        if let Some(job) = mgr.jobs.get_mut(&jid) {
                            job.status = JobStatus::Completed;
                            job.progress = 100.0;
                            job.file_path = Some(file_path.clone());
                            job.file_size = file_size;
                            job.completed_at = Some(completed_at);
                        }
                        mgr.advance_queue(app_handle.clone(), db.clone(), self_arc.clone());
                        mgr.emit_queue_updated(&app_handle);
                    }

                    let db_lock = db.lock().await;
                    let _ = db_lock.insert_history(&crate::commands::history::HistoryItem {
                        job_id: jid.clone(),
                        url: opts.url.clone(),
                        title: file_name.clone(),
                        uploader: None,
                        thumbnail: None,
                        duration: None,
                        file_path: Some(file_path),
                        file_size,
                        format: if opts.audio_only {
                            "mp3".to_string()
                        } else {
                            "mp4".to_string()
                        },
                        quality: opts.quality.clone(),
                        audio_only: opts.audio_only,
                        status: "completed".to_string(),
                        created_at: chrono::Utc::now().timestamp_millis(),
                        completed_at: Some(completed_at),
                    });
                }

                Err(e) => {
                    let error_msg = e.to_string();

                    match error_msg.as_str() {
                        // ── Pause sentinel ────────────────────────────────────
                        // The download engine already emitted download://paused.
                        // We just need to update manager state and free the slot.
                        "__paused__" => {
                            let mut mgr = self_arc.lock().await;
                            mgr.active_handles.remove(&jid);
                            // Status was already set to Paused by pause_download().
                            // Do NOT advance queue here — the paused job should keep
                            // its conceptual position; advance only triggers when
                            // the user resumes or cancels.
                            mgr.emit_queue_updated(&app_handle);
                        }

                        // ── Cancel sentinel ───────────────────────────────────
                        // The download engine already emitted download://cancelled.
                        "__cancelled__" => {
                            let mut mgr = self_arc.lock().await;
                            mgr.active_handles.remove(&jid);
                            mgr.advance_queue(app_handle.clone(), db.clone(), self_arc.clone());
                            mgr.emit_queue_updated(&app_handle);
                        }

                        // ── Real error ────────────────────────────────────────
                        _ => {
                            let _ = app_handle.emit(
                                "download://error",
                                ErrorEventPayload {
                                    job_id: jid.clone(),
                                    error: error_msg.clone(),
                                },
                            );

                            {
                                let mut mgr = self_arc.lock().await;
                                mgr.active_handles.remove(&jid);
                                if let Some(job) = mgr.jobs.get_mut(&jid) {
                                    job.status = JobStatus::Failed;
                                    job.error = Some(error_msg);
                                }
                                mgr.advance_queue(app_handle.clone(), db.clone(), self_arc.clone());
                                mgr.emit_queue_updated(&app_handle);
                            }
                        }
                    }
                }
            }
        });

        self.active_handles.insert(job_id.to_string(), handle);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    /// Cancel a running or queued download.
    ///
    /// For running downloads: sends ControlSignal::Cancel through the watch channel.
    /// The download engine reacts immediately (no poll delay), kills the process tree
    /// via Job Object, deletes temp files, emits download://cancelled, then returns
    /// Err("__cancelled__"), which triggers the task cleanup in start_job's Err branch.
    ///
    /// For queued downloads: marks the job cancelled directly (no active process).
    pub async fn cancel_download(&mut self, job_id: &str, app_handle: &AppHandle) -> Result<()> {
        let job = match self.jobs.get_mut(job_id) {
            Some(j) => j,
            None => return Err(anyhow!("Job not found: {}", job_id)),
        };

        // If there's an active process, signal it. The task self-cleans via the sentinel.
        if self.active_handles.contains_key(job_id) {
            // Send Cancel signal — watcher reacts immediately
            let _ = job.control_tx.send(ControlSignal::Cancel);
            // Mark status immediately so the UI is responsive
            job.status = JobStatus::Cancelled;
            // NOTE: We intentionally do NOT emit download://cancelled here.
            // The download engine's watcher emits it AFTER the process is dead
            // to avoid a race with in-flight progress events.
        } else {
            // Queued or already stopped — cancel directly
            job.status = JobStatus::Cancelled;
            // Emit the event ourselves since there's no task to do it
            let _ = app_handle.emit(
                "download://cancelled",
                crate::services::ytdlp::download::CancelledEventPayload {
                    job_id: job_id.to_string(),
                },
            );
            self.emit_queue_updated(app_handle);
        }

        Ok(())
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    /// Pause a running download.
    ///
    /// Sends ControlSignal::Pause through the watch channel. The download engine
    /// reacts immediately: kills the process tree, preserves partial files (unlike
    /// cancel which deletes them), emits download://paused, returns Err("__paused__").
    ///
    /// The manager sets status to Paused immediately for responsive UI feedback.
    /// The queue://updated event is emitted from the task cleanup path (after the
    /// process is confirmed dead) to avoid racing with progress events.
    pub async fn pause_download(&mut self, job_id: &str, _app_handle: &AppHandle) -> Result<()> {
        let job = match self.jobs.get_mut(job_id) {
            Some(j) => j,
            None => return Err(anyhow!("Job not found: {}", job_id)),
        };

        if !self.active_handles.contains_key(job_id) {
            return Err(anyhow!("Job {} is not currently active", job_id));
        }

        // Mark paused immediately (responsive UI)
        job.status = JobStatus::Paused;

        // Signal the download engine — it will kill the process and emit download://paused
        // AFTER the process is confirmed dead (no race with progress events)
        let _ = job.control_tx.send(ControlSignal::Pause);

        Ok(())
    }

    // ── Resume ────────────────────────────────────────────────────────────────

    /// Resume a paused download.
    ///
    /// Key fix over the old implementation: we must wait for the previous task to
    /// fully exit before re-queuing the job. The old code called advance_queue
    /// immediately while the paused task's cleanup was still running, causing:
    ///   1. The slot not being freed yet (task still in active_handles)
    ///   2. advance_queue seeing 0 free slots → job stays queued forever
    ///
    /// Solution: if there's a lingering handle, await it (with a timeout) before
    /// advancing. Since we hold the manager lock, we spawn the "wait + advance" logic
    /// in a background task to avoid holding the lock across an await.
    pub async fn resume_download(
        &mut self,
        job_id: &str,
        app_handle: AppHandle,
        db: Arc<Mutex<Database>>,
        self_arc: Arc<Mutex<DownloadManager>>,
    ) -> Result<()> {
        let job = match self.jobs.get_mut(job_id) {
            Some(j) => j,
            None => return Err(anyhow!("Job not found: {}", job_id)),
        };

        if job.status != JobStatus::Paused {
            return Err(anyhow!(
                "Job {} is not paused (status: {:?})",
                job_id,
                job.status
            ));
        }

        job.status = JobStatus::Queued;
        job.progress = 0.0; // yt-dlp restarts from scratch (no --continue)
        job.speed = String::new();
        job.eta = String::new();

        // Emit resumed event so frontend can update the progress bar immediately
        let _ = app_handle.emit(
            "download://resumed",
            ResumedEventPayload {
                job_id: job_id.to_string(),
            },
        );

        // Take the lingering handle out of the map (it may still be finishing cleanup)
        let lingering_handle = self.active_handles.remove(job_id);

        self.emit_queue_updated(&app_handle);

        // Spawn a background task to:
        //   1. Wait for the old task to fully exit (max 3 seconds)
        //   2. Then acquire the manager lock and advance the queue
        // This avoids holding the manager lock across an await point.
        let jid = job_id.to_string();
        tokio::spawn(async move {
            // Wait for the previous task to finish (it's killing the process and cleaning up)
            if let Some(handle) = lingering_handle {
                let wait_result =
                    tokio::time::timeout(tokio::time::Duration::from_secs(3), handle).await;
                if wait_result.is_err() {
                    log::warn!("Job {}: previous task didn't finish within 3s on resume — proceeding anyway", jid);
                }
            }

            // Now advance the queue (old slot is free)
            let mut mgr = self_arc.lock().await;
            mgr.advance_queue(app_handle.clone(), db.clone(), self_arc.clone());
            mgr.emit_queue_updated(&app_handle);
        });

        Ok(())
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    /// Retry a failed or cancelled download.
    ///
    /// Same handle-wait pattern as resume to guarantee the previous task's slot
    /// is freed before advance_queue runs.
    pub async fn retry_download(
        &mut self,
        job_id: &str,
        app_handle: AppHandle,
        db: Arc<Mutex<Database>>,
        self_arc: Arc<Mutex<DownloadManager>>,
    ) -> Result<()> {
        let job = match self.jobs.get_mut(job_id) {
            Some(j) => j,
            None => return Err(anyhow!("Job not found: {}", job_id)),
        };

        job.status = JobStatus::Queued;
        job.progress = 0.0;
        job.error = None;
        job.speed = String::new();
        job.eta = String::new();

        let lingering_handle = self.active_handles.remove(job_id);
        self.emit_queue_updated(&app_handle);

        tokio::spawn(async move {
            if let Some(handle) = lingering_handle {
                let _ = tokio::time::timeout(tokio::time::Duration::from_secs(3), handle).await;
            }

            let mut mgr = self_arc.lock().await;
            mgr.advance_queue(app_handle.clone(), db.clone(), self_arc.clone());
            mgr.emit_queue_updated(&app_handle);
        });

        Ok(())
    }
}
