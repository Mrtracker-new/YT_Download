use crate::security::path_validator::validate_filename_template;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub download_dir: String,
    pub max_concurrent_downloads: u32,
    pub file_name_template: String,
    pub ytdlp_path: String,
    pub ffmpeg_path: String,
    pub theme: String,
    pub show_notifications: bool,
    pub auto_update_binaries: bool,
    pub keep_history: bool,
    pub history_retention_days: u32,
    /// Browser to use for cookie extraction on sites that require login (e.g. instagram, twitter).
    /// Passed to yt-dlp's --cookies-from-browser. Supported: chrome, edge, firefox, brave, opera, safari
    pub cookie_browser: String,
    /// Path to a Netscape-format cookies.txt file. Passed to yt-dlp's --cookies.
    /// Takes precedence over cookie_browser when non-empty. Bulletproof on Windows
    /// where browser cookie decryption can fail (Chrome/Edge App-Bound Encryption).
    pub cookie_file: String,
    /// App version the user chose to skip (e.g. "1.2.0"). When the latest release
    /// matches this, the update banner stays hidden. Empty = never skipped.
    pub skipped_app_version: String,
    /// ISO timestamp of the last yt-dlp update check. Not used for throttling
    /// (checks are startup-only) — kept for future use.
    pub last_ytdlp_update_check: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_dir: String::new(),
            max_concurrent_downloads: 2,
            file_name_template: "%(title)s.%(ext)s".to_string(),
            ytdlp_path: String::new(),
            ffmpeg_path: String::new(),
            theme: "dark".to_string(),
            show_notifications: true,
            auto_update_binaries: false,
            keep_history: true,
            history_retention_days: 30,
            cookie_browser: "none".to_string(),
            cookie_file: String::new(),
            skipped_app_version: String::new(),
            last_ytdlp_update_check: String::new(),
        }
    }
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().await;
    let settings = db.get_settings().unwrap_or_default();
    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    validate_filename_template(&settings.file_name_template).map_err(|e| e.to_string())?;
    let db = state.db.lock().await;
    db.save_settings(&settings).map_err(|e| e.to_string())
}
