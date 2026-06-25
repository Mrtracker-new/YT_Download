use serde::{Deserialize, Serialize};
use tokio::sync::watch;

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
            title: "Fetching…".to_string(),
            thumbnail: None,
            uploader: None,
            duration: None,
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
}
