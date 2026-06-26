use crate::security::path_validator::{validate_job_id, validate_path};
use crate::security::url_validator::validate_url;
use crate::services::download_manager::DownloadOptions;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOptions {
    pub enabled: bool,
    pub language: String,
    pub mode: String, // "embed" | "sidecar"
    pub include_auto: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedOptions {
    /// "auto" | "h264" | "vp9" | "av1"
    pub video_codec: String,
    /// "mp3" | "opus" | "m4a" | "flac" | "wav"
    pub audio_format: String,
    /// Bitrate in kbps for lossy audio (e.g. "192").
    pub audio_quality: String,
    /// Embed the thumbnail as cover art / poster.
    pub embed_thumbnail: bool,
    /// SponsorBlock categories to remove. Empty = disabled.
    pub sponsorblock_categories: Vec<String>,
}

impl Default for AdvancedOptions {
    fn default() -> Self {
        Self {
            video_codec: "auto".to_string(),
            audio_format: "mp3".to_string(),
            audio_quality: "192".to_string(),
            embed_thumbnail: false,
            sponsorblock_categories: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadOptions {
    pub url: String,
    pub quality: String,
    pub audio_only: bool,
    pub subtitle_options: SubtitleOptions,
    pub output_dir: Option<String>,
    /// Advanced format options. Optional for backward compatibility — defaults applied when absent.
    #[serde(default)]
    pub advanced: Option<AdvancedOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadJobDto {
    pub job_id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub duration: Option<u64>,
    pub quality: String,
    pub audio_only: bool,
    pub format: String,
    pub status: String,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub error: Option<String>,
    pub file_path: Option<String>,
    pub file_size: Option<u64>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueStateDto {
    pub jobs: Vec<DownloadJobDto>,
    pub active_count: usize,
    pub max_concurrent: usize,
}

#[tauri::command]
pub async fn start_download(
    opts: StartDownloadOptions,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let validated_url = validate_url(&opts.url).map_err(|e| e.to_string())?;

    let job_id = Uuid::new_v4().to_string();

    // Get settings for output directory
    let db = state.db.lock().await;
    let download_dir = db
        .get_setting("downloadDir")
        .unwrap_or_default()
        .unwrap_or_default();
    let file_name_template = db
        .get_setting("fileNameTemplate")
        .unwrap_or_default()
        .unwrap_or_else(|| "%(title)s.%(ext)s".to_string());
    let cookie_browser = db
        .get_setting("cookieBrowser")
        .unwrap_or_default()
        .unwrap_or_else(|| "none".to_string());
    let cookie_file = db
        .get_setting("cookieFile")
        .unwrap_or_default()
        .unwrap_or_default();
    drop(db);

    // Resolve the trusted base download directory (allowed root for path validation).
    let base_dir = if !download_dir.is_empty() {
        download_dir.clone()
    } else {
        dirs::download_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
            .to_string_lossy()
            .to_string()
    };

    // Per-download override, if any; otherwise the base directory.
    let output_dir = opts
        .output_dir
        .filter(|d| !d.is_empty())
        .unwrap_or_else(|| base_dir.clone());

    // canonicalize() requires the paths to exist, so create them before validating.
    std::fs::create_dir_all(&base_dir).map_err(|e| format!("Cannot create base dir: {}", e))?;
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    // Reject path traversal that escapes the trusted base directory.
    let output_dir = validate_path(&output_dir, &base_dir)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let advanced = opts.advanced.unwrap_or_default();

    let download_opts = DownloadOptions {
        job_id: job_id.clone(),
        url: validated_url,
        quality: opts.quality,
        audio_only: opts.audio_only,
        subtitle_enabled: opts.subtitle_options.enabled,
        subtitle_language: opts.subtitle_options.language,
        subtitle_mode: opts.subtitle_options.mode,
        subtitle_include_auto: opts.subtitle_options.include_auto,
        output_dir,
        file_name_template,
        cookie_browser,
        cookie_file,
        video_codec: advanced.video_codec,
        audio_format: advanced.audio_format,
        audio_quality: advanced.audio_quality,
        embed_thumbnail: advanced.embed_thumbnail,
        sponsorblock_categories: advanced.sponsorblock_categories,
    };

    let mut manager = state.download_manager.lock().await;
    manager
        .add_download(
            download_opts,
            app_handle,
            state.db.clone(),
            state.download_manager.clone(),
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(job_id)
}

#[tauri::command]
pub async fn cancel_download(
    job_id: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    validate_job_id(&job_id).map_err(|e| e.to_string())?;
    let mut manager = state.download_manager.lock().await;
    manager
        .cancel_download(&job_id, &app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_download(
    job_id: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    validate_job_id(&job_id).map_err(|e| e.to_string())?;
    let mut manager = state.download_manager.lock().await;
    manager
        .pause_download(&job_id, &app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_download(
    job_id: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    validate_job_id(&job_id).map_err(|e| e.to_string())?;
    let mut manager = state.download_manager.lock().await;
    manager
        .resume_download(
            &job_id,
            app_handle,
            state.db.clone(),
            state.download_manager.clone(),
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retry_download(
    job_id: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    validate_job_id(&job_id).map_err(|e| e.to_string())?;
    let mut manager = state.download_manager.lock().await;
    manager
        .retry_download(
            &job_id,
            app_handle,
            state.db.clone(),
            state.download_manager.clone(),
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_queue(state: State<'_, AppState>) -> Result<QueueStateDto, String> {
    let manager = state.download_manager.lock().await;
    let jobs = manager.get_all_jobs();
    let active_count = manager.active_count();
    let max_concurrent = manager.max_concurrent();

    let job_dtos = jobs
        .into_iter()
        .map(|j| DownloadJobDto {
            job_id: j.job_id,
            url: j.url,
            title: j.title,
            thumbnail: j.thumbnail,
            uploader: j.uploader,
            duration: j.duration,
            quality: j.quality,
            audio_only: j.audio_only,
            format: j.format,
            status: format!("{:?}", j.status).to_lowercase(),
            progress: j.progress,
            speed: j.speed,
            eta: j.eta,
            error: j.error,
            file_path: j.file_path,
            file_size: j.file_size,
            created_at: j.created_at,
            completed_at: j.completed_at,
        })
        .collect();

    Ok(QueueStateDto {
        jobs: job_dtos,
        active_count,
        max_concurrent,
    })
}
