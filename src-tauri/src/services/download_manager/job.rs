use serde::{Deserialize, Serialize};
use tokio::sync::watch;

use crate::database::PersistedQueueJob;

/// Signals sent through the per-job watch channel to control the download task.
/// Using a watch channel instead of AtomicBool gives us:
///   - Immediate delivery (no 100ms poll delay)
///   - A typed discriminant so Pause vs Cancel have distinct cleanup paths
///   - Proper async-aware signaling via tokio::select!
#[derive(Debug, Clone, PartialEq)]
pub enum ControlSignal {
    /// Normal operation — keep downloading.
    Run,
    /// User paused — kill process but preserve partial files for inspect/retry.
    Pause,
    /// User cancelled — kill process and delete all partial/temp files.
    Cancel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum JobStatus {
    Queued,
    Downloading,
    Merging,
    Converting,
    Finalizing,
    Completed,
    Failed,
    Cancelled,
    Paused,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Downloading => "downloading",
            Self::Merging => "merging",
            Self::Converting => "converting",
            Self::Finalizing => "finalizing",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Paused => "paused",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled)
    }

    pub fn is_active(&self) -> bool {
        matches!(
            self,
            Self::Downloading | Self::Merging | Self::Converting | Self::Finalizing
        )
    }
}

/// Options used to create a new download job
#[derive(Debug, Clone)]
pub struct DownloadOptions {
    pub job_id: String,
    pub url: String,
    pub quality: String,
    pub audio_only: bool,
    pub subtitle_enabled: bool,
    pub subtitle_language: String,
    pub subtitle_mode: String,
    pub subtitle_include_auto: bool,
    pub output_dir: String,
    pub file_name_template: String,
    /// Browser to pull cookies from for sites that require login (e.g. Instagram, Twitter).
    /// Passed as-is to yt-dlp's `--cookies-from-browser` flag.
    /// Supported values: "chrome", "edge", "firefox", "brave", "opera", "safari"
    pub cookie_browser: String,
    /// Path to a Netscape-format cookies.txt file. Passed to yt-dlp's `--cookies`.
    /// Takes precedence over `cookie_browser` when non-empty.
    pub cookie_file: String,
    /// Preferred video codec: "auto" | "h264" | "vp9" | "av1". Empty/"auto" = no constraint.
    pub video_codec: String,
    /// Audio output format for audio-only downloads: "mp3" | "opus" | "m4a" | "flac" | "wav".
    pub audio_format: String,
    /// Audio bitrate in kbps for lossy audio formats (e.g. "192"). Ignored for flac/wav.
    pub audio_quality: String,
    /// Embed the video thumbnail as cover art (audio) / poster (video).
    pub embed_thumbnail: bool,
    /// SponsorBlock categories to remove (e.g. ["sponsor", "intro"]). Empty = disabled.
    pub sponsorblock_categories: Vec<String>,
    // ── Display metadata (from the frontend video-info fetch) ──────────────────
    // Carried so the queue can show real titles/thumbnails after a restart.
    /// Video title. None falls back to "Fetching…".
    pub title: Option<String>,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub duration: Option<u64>,
}

/// Represents a single download job in the manager
#[derive(Debug, Clone)]
pub struct DownloadJob {
    pub job_id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub duration: Option<u64>,
    pub quality: String,
    pub audio_only: bool,
    pub format: String,
    pub status: JobStatus,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub error: Option<String>,
    pub file_path: Option<String>,
    pub file_size: Option<u64>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    // Original options for retry
    pub opts: DownloadOptions,
    /// The sending half of the per-job control channel.
    /// Call `control_tx.send(ControlSignal::Pause)` or `::Cancel` to stop the task.
    /// Each `start_job` call replaces this with a fresh channel.
    pub control_tx: watch::Sender<ControlSignal>,
}

impl DownloadJob {
    pub fn new(opts: DownloadOptions) -> Self {
        let format = if opts.audio_only {
            "mp3".to_string()
        } else {
            "mp4".to_string()
        };
        let now = chrono::Utc::now().timestamp_millis();
        // Dummy channel — replaced by a live channel each time start_job() is called.
        // The initial value is Run so receivers see no signal until the manager acts.
        let (control_tx, _) = watch::channel(ControlSignal::Run);

        Self {
            job_id: opts.job_id.clone(),
            url: opts.url.clone(),
            title: opts
                .title
                .clone()
                .filter(|t| !t.is_empty())
                .unwrap_or_else(|| "Fetching…".to_string()),
            thumbnail: opts.thumbnail.clone(),
            uploader: opts.uploader.clone(),
            duration: opts.duration,
            quality: opts.quality.clone(),
            audio_only: opts.audio_only,
            format,
            status: JobStatus::Queued,
            progress: 0.0,
            speed: String::new(),
            eta: String::new(),
            error: None,
            file_path: None,
            file_size: None,
            created_at: now,
            completed_at: None,
            control_tx,
            opts,
        }
    }

    /// Snapshot this job into a row for the persisted `download_queue` table.
    pub fn to_persisted(&self) -> PersistedQueueJob {
        PersistedQueueJob {
            job_id: self.job_id.clone(),
            url: self.url.clone(),
            title: self.title.clone(),
            thumbnail: self.thumbnail.clone(),
            uploader: self.uploader.clone(),
            duration: self.duration,
            quality: self.quality.clone(),
            audio_only: self.audio_only,
            format: self.format.clone(),
            status: self.status.as_str().to_string(),
            progress: self.progress,
            error: self.error.clone(),
            file_path: self.file_path.clone(),
            file_size: self.file_size,
            created_at: self.created_at,
            completed_at: self.completed_at,
            subtitle_enabled: self.opts.subtitle_enabled,
            subtitle_language: self.opts.subtitle_language.clone(),
            subtitle_mode: self.opts.subtitle_mode.clone(),
            subtitle_include_auto: self.opts.subtitle_include_auto,
            output_dir: self.opts.output_dir.clone(),
            file_name_template: self.opts.file_name_template.clone(),
            cookie_browser: self.opts.cookie_browser.clone(),
            cookie_file: self.opts.cookie_file.clone(),
            video_codec: self.opts.video_codec.clone(),
            audio_format: self.opts.audio_format.clone(),
            audio_quality: self.opts.audio_quality.clone(),
            embed_thumbnail: self.opts.embed_thumbnail,
            sponsorblock_categories: self.opts.sponsorblock_categories.clone(),
        }
    }

    /// Rebuild a job from a persisted row after an app restart.
    ///
    /// Jobs that were mid-download when the app closed cannot be resumed in place
    /// (yt-dlp restarts from scratch), so the caller maps active statuses to Failed.
    pub fn from_persisted(p: PersistedQueueJob) -> Self {
        let status = match p.status.as_str() {
            "queued" => JobStatus::Queued,
            "paused" => JobStatus::Paused,
            "completed" => JobStatus::Completed,
            "cancelled" => JobStatus::Cancelled,
            // downloading/merging/converting/finalizing/failed → treat as Failed:
            // an interrupted job can't continue, but stays visible for retry.
            _ => JobStatus::Failed,
        };

        let opts = DownloadOptions {
            job_id: p.job_id.clone(),
            url: p.url.clone(),
            quality: p.quality.clone(),
            audio_only: p.audio_only,
            subtitle_enabled: p.subtitle_enabled,
            subtitle_language: p.subtitle_language,
            subtitle_mode: p.subtitle_mode,
            subtitle_include_auto: p.subtitle_include_auto,
            output_dir: p.output_dir,
            file_name_template: p.file_name_template,
            cookie_browser: p.cookie_browser,
            cookie_file: p.cookie_file,
            video_codec: p.video_codec,
            audio_format: p.audio_format,
            audio_quality: p.audio_quality,
            embed_thumbnail: p.embed_thumbnail,
            sponsorblock_categories: p.sponsorblock_categories,
            title: Some(p.title.clone()),
            thumbnail: p.thumbnail.clone(),
            uploader: p.uploader.clone(),
            duration: p.duration,
        };

        let interrupted = !matches!(
            p.status.as_str(),
            "queued" | "paused" | "completed" | "cancelled" | "failed"
        );
        let error = if interrupted {
            Some("Interrupted by app restart".to_string())
        } else {
            p.error
        };

        let (control_tx, _) = watch::channel(ControlSignal::Run);

        Self {
            job_id: p.job_id,
            url: p.url,
            title: p.title,
            thumbnail: p.thumbnail,
            uploader: p.uploader,
            duration: p.duration,
            quality: p.quality,
            audio_only: p.audio_only,
            format: p.format,
            status,
            progress: if interrupted { 0.0 } else { p.progress },
            speed: String::new(),
            eta: String::new(),
            error,
            file_path: p.file_path,
            file_size: p.file_size,
            created_at: p.created_at,
            completed_at: p.completed_at,
            control_tx,
            opts,
        }
    }
}
