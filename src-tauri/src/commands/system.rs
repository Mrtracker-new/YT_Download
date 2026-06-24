use crate::services::binary_resolver::{get_binary_version, resolve_ffmpeg, resolve_ytdlp};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryInfo {
    pub name: String,
    pub path: Option<String>,
    pub version: Option<String>,
    pub found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryStatus {
    pub ytdlp: BinaryInfo,
    pub ffmpeg: BinaryInfo,
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    // Security: only allow opening directories, not arbitrary paths
    let path = std::path::Path::new(&path);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn check_binaries(state: State<'_, AppState>) -> Result<BinaryStatus, String> {
    let db = state.db.lock().await;
    let ytdlp_override = db
        .get_setting("ytdlpPath")
        .unwrap_or_default()
        .unwrap_or_default();
    let ffmpeg_override = db
        .get_setting("ffmpegPath")
        .unwrap_or_default()
        .unwrap_or_default();
    drop(db);

    let ytdlp_path = if !ytdlp_override.is_empty() {
        Some(ytdlp_override.clone())
    } else {
        resolve_ytdlp()
    };

    let ffmpeg_path = if !ffmpeg_override.is_empty() {
        Some(ffmpeg_override.clone())
    } else {
        resolve_ffmpeg()
    };

    let ytdlp_version = ytdlp_path
        .as_ref()
        .and_then(|p| get_binary_version(p, &["--version"]));
    let ffmpeg_version = ffmpeg_path.as_ref().and_then(|p| {
        get_binary_version(p, &["-version"]).map(|v| v.lines().next().unwrap_or("").to_string())
    });

    Ok(BinaryStatus {
        ytdlp: BinaryInfo {
            name: "yt-dlp".to_string(),
            found: ytdlp_path.is_some(),
            path: ytdlp_path,
            version: ytdlp_version,
        },
        ffmpeg: BinaryInfo {
            name: "ffmpeg".to_string(),
            found: ffmpeg_path.is_some(),
            path: ffmpeg_path,
            version: ffmpeg_version,
        },
    })
}

#[tauri::command]
pub async fn select_folder(app_handle: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app_handle.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn select_cookie_file(app_handle: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file = app_handle
        .dialog()
        .file()
        .add_filter("Cookies", &["txt"])
        .blocking_pick_file();
    Ok(file.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn get_default_download_dir() -> Result<String, String> {
    let dir = dirs::download_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default());
    Ok(dir.to_string_lossy().to_string())
}
