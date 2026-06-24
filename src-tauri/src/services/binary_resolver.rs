use std::path::PathBuf;

/// Resolve yt-dlp binary path using multi-tier strategy:
/// 1. App data bin directory
/// 2. System PATH
pub fn resolve_ytdlp() -> Option<String> {
    let binary_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };

    // Tier 1: App data dir
    if let Some(app_data) = get_app_bin_dir() {
        let local = app_data.join(binary_name);
        if local.exists() {
            return Some(local.to_string_lossy().to_string());
        }
    }

    // Tier 2: System PATH
    which_binary(if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" })
}

/// Resolve ffmpeg binary path.
pub fn resolve_ffmpeg() -> Option<String> {
    let binary_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };

    // Tier 1: App data dir
    if let Some(app_data) = get_app_bin_dir() {
        let local = app_data.join(binary_name);
        if local.exists() {
            return Some(local.to_string_lossy().to_string());
        }
    }

    // Tier 2: System PATH
    which_binary(binary_name)
}

/// Returns the app-local bin directory (creates it if needed).
pub fn get_app_bin_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| {
        let bin = d.join("com.mrtracker.ytdownloader").join("bin");
        let _ = std::fs::create_dir_all(&bin);
        bin
    })
}

/// Find a binary in system PATH.
fn which_binary(name: &str) -> Option<String> {
    let output = std::process::Command::new(if cfg!(windows) { "where" } else { "which" })
        .arg(name)
        .output()
        .ok()?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if !path.is_empty() { Some(path) } else { None }
    } else {
        None
    }
}

/// Get the version string of a binary by running it with version flags.
pub fn get_binary_version(path: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(path)
        .args(args)
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let version = if !stdout.is_empty() { stdout } else { stderr };
    if version.is_empty() { None } else { Some(version) }
}
