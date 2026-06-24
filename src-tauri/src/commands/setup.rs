use tauri::{AppHandle, Emitter};
use serde::Serialize;
use futures_util::StreamExt;
use std::io::Write;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupProgress {
    pub name: String,
    pub progress: f64,
    pub status: String, // "downloading" | "complete" | "error"
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryCheckResult {
    pub ytdlp_found: bool,
    pub ffmpeg_found: bool,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub needs_setup: bool,
}

fn emit_progress(app: &AppHandle, name: &str, progress: f64, status: &str, message: &str) {
    let _ = app.emit("setup://progress", SetupProgress {
        name: name.to_string(),
        progress,
        status: status.to_string(),
        message: message.to_string(),
    });
}

/// Check which binaries are available without downloading anything.
#[tauri::command]
pub async fn check_setup() -> Result<BinaryCheckResult, String> {
    use crate::services::binary_resolver::{resolve_ytdlp, resolve_ffmpeg};
    let ytdlp = resolve_ytdlp();
    let ffmpeg = resolve_ffmpeg();
    let needs_setup = ytdlp.is_none();
    Ok(BinaryCheckResult {
        ytdlp_found: ytdlp.is_some(),
        ffmpeg_found: ffmpeg.is_some(),
        ytdlp_path: ytdlp,
        ffmpeg_path: ffmpeg,
        needs_setup,
    })
}

/// Download yt-dlp binary from GitHub releases with progress events.
#[tauri::command]
pub async fn download_ytdlp(app_handle: AppHandle) -> Result<String, String> {
    use crate::services::binary_resolver::get_app_bin_dir;

    let bin_dir = get_app_bin_dir()
        .ok_or_else(|| "Cannot determine app data directory".to_string())?;

    let binary_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    let dest = bin_dir.join(binary_name);

    // Use different URL for different platforms
    let url = if cfg!(windows) {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    emit_progress(&app_handle, "yt-dlp", 0.0, "downloading", "Starting download...");

    let client = reqwest::Client::builder()
        .user_agent("YT-Downloader-Tauri/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| {
        format!("Network error: {}. Check your internet connection.", e)
    })?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();

    let mut file = std::fs::File::create(&dest).map_err(|e| {
        format!("Cannot create file at {:?}: {}", dest, e)
    })?;

    let mut downloaded: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download interrupted: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let progress = (downloaded as f64 / total as f64) * 100.0;
            let mb_done = downloaded as f64 / 1_048_576.0;
            let mb_total = total as f64 / 1_048_576.0;
            emit_progress(
                &app_handle,
                "yt-dlp",
                progress,
                "downloading",
                &format!("{:.1} MB / {:.1} MB", mb_done, mb_total),
            );
        }
    }

    // On Unix, make executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&dest) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&dest, perms);
        }
    }

    emit_progress(&app_handle, "yt-dlp", 100.0, "complete", "yt-dlp downloaded successfully!");

    Ok(dest.to_string_lossy().to_string())
}

/// Download ffmpeg from a reliable source with progress events.
#[tauri::command]
pub async fn download_ffmpeg(app_handle: AppHandle) -> Result<String, String> {
    use crate::services::binary_resolver::get_app_bin_dir;

    let bin_dir = get_app_bin_dir()
        .ok_or_else(|| "Cannot determine app data directory".to_string())?;

    emit_progress(&app_handle, "ffmpeg", 0.0, "downloading", "Starting ffmpeg download...");

    // Use a smaller, pre-built ffmpeg binary from GitHub
    // yt-dlp provides a bundled ffmpeg build
    #[cfg(windows)]
    let url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
    #[cfg(not(windows))]
    let url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";

    let client = reqwest::Client::builder()
        .user_agent("YT-Downloader-Tauri/1.0")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| {
        format!("Network error downloading ffmpeg: {}", e)
    })?;

    if !response.status().is_success() {
        return Err(format!("ffmpeg download failed: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let archive_path = bin_dir.join(if cfg!(windows) { "ffmpeg.zip" } else { "ffmpeg.tar.xz" });

    let mut stream = response.bytes_stream();
    let mut file = std::fs::File::create(&archive_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download interrupted: {}", e))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let progress = (downloaded as f64 / total as f64) * 90.0; // 90% for download
            let mb_done = downloaded as f64 / 1_048_576.0;
            let mb_total = total as f64 / 1_048_576.0;
            emit_progress(
                &app_handle,
                "ffmpeg",
                progress,
                "downloading",
                &format!("{:.1} MB / {:.1} MB", mb_done, mb_total),
            );
        }
    }

    emit_progress(&app_handle, "ffmpeg", 91.0, "extracting", "Extracting ffmpeg...");

    // Extract ffmpeg.exe from the zip
    #[cfg(windows)]
    {
        extract_ffmpeg_windows(&archive_path, &bin_dir)?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        extract_ffmpeg_unix(&archive_path, &bin_dir)?;
        let ffmpeg_path = bin_dir.join("ffmpeg");
        if let Ok(meta) = std::fs::metadata(&ffmpeg_path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&ffmpeg_path, perms);
        }
    }

    // Clean up archive
    let _ = std::fs::remove_file(&archive_path);

    let binary_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let ffmpeg_path = bin_dir.join(binary_name);

    emit_progress(&app_handle, "ffmpeg", 100.0, "complete", "ffmpeg downloaded successfully!");

    Ok(ffmpeg_path.to_string_lossy().to_string())
}

#[cfg(windows)]
fn extract_ffmpeg_windows(archive_path: &std::path::Path, dest_dir: &std::path::Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        // Only extract ffmpeg.exe from the bin directory
        if name.ends_with("/bin/ffmpeg.exe") || name.ends_with("\\bin\\ffmpeg.exe") {
            let dest = dest_dir.join("ffmpeg.exe");
            let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    Err("ffmpeg.exe not found in the archive. The archive structure may have changed.".to_string())
}

#[cfg(unix)]
fn extract_ffmpeg_unix(archive_path: &std::path::Path, dest_dir: &std::path::Path) -> Result<(), String> {
    let output = std::process::Command::new("tar")
        .args(["-xf", archive_path.to_str().unwrap_or(""), "--wildcards", "*/bin/ffmpeg", "-O"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let dest = dest_dir.join("ffmpeg");
        std::fs::write(dest, &output.stdout).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
