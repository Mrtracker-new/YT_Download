use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const APP_REPO: &str = "Mrtracker-new/YT_Download";
const YTDLP_REPO: &str = "yt-dlp/yt-dlp";
const RELEASES_PAGE: &str = "https://github.com/Mrtracker-new/YT_Download/releases";
const CHECK_TIMEOUT_SECS: u64 = 8;

// ── Types ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>, // first 500 chars of body
    pub pub_date: Option<String>,
    pub release_url: String, // HTML URL — opened in browser on click
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpUpdateInfo {
    pub available: bool,
    pub current_version: String, // from `yt-dlp --version`
    pub latest_version: String,  // from GitHub releases API tag_name
}

/// Subset of the GitHub releases API payload we care about.
#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    html_url: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────

/// Strip a leading `v` from a tag (`v1.2.0` → `1.2.0`).
fn strip_v(tag: &str) -> &str {
    tag.strip_prefix('v').unwrap_or(tag)
}

/// Compare two dotted version strings numerically segment by segment.
/// Works for semver (`1.2.0`) and yt-dlp date tags (`2024.12.13`).
/// Returns true when `latest` is strictly newer than `current`.
fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |s: &str| -> Vec<u64> {
        s.split('.')
            .map(|seg| {
                // Take the leading numeric portion of each segment so a trailing
                // suffix (e.g. a build tag) doesn't poison the comparison.
                let digits: String = seg.chars().take_while(|c| c.is_ascii_digit()).collect();
                digits.parse::<u64>().unwrap_or(0)
            })
            .collect()
    };

    let l = parse(latest);
    let c = parse(current);
    let len = l.len().max(c.len());

    for i in 0..len {
        let lv = l.get(i).copied().unwrap_or(0);
        let cv = c.get(i).copied().unwrap_or(0);
        if lv != cv {
            return lv > cv;
        }
    }
    false
}

/// Fetch the latest release of a GitHub repo. GitHub requires a User-Agent
/// header; without it the API returns 403.
async fn fetch_latest_release(repo: &str) -> Result<GithubRelease, String> {
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");

    let client = reqwest::Client::builder()
        .user_agent("YT-Downloader-Tauri/1.0")
        .timeout(std::time::Duration::from_secs(CHECK_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", response.status()));
    }

    response
        .json::<GithubRelease>()
        .await
        .map_err(|e| format!("Failed to parse release JSON: {e}"))
}

// ── Commands ─────────────────────────────────────────────────

/// Check whether a newer app release exists on GitHub.
/// Fails silently (returns Err) on any network/parse error — the frontend
/// treats a rejected promise as "no update" and shows no UI.
#[tauri::command]
pub async fn check_app_update() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let release = fetch_latest_release(APP_REPO).await?;
    let latest = strip_v(&release.tag_name).to_string();
    let available = is_newer(&latest, &current_version);

    let release_notes = release.body.map(|b| {
        let mut notes: String = b.chars().take(500).collect();
        if b.chars().count() > 500 {
            notes.push('…');
        }
        notes
    });

    Ok(AppUpdateInfo {
        available,
        current_version,
        latest_version: Some(latest),
        release_notes,
        pub_date: release.published_at,
        release_url: release.html_url.unwrap_or_else(|| RELEASES_PAGE.to_string()),
    })
}

/// Check whether a newer yt-dlp release exists vs the locally installed binary.
#[tauri::command]
pub async fn check_ytdlp_update() -> Result<YtdlpUpdateInfo, String> {
    use crate::services::binary_resolver::{get_binary_version, resolve_ytdlp};

    // Resolve the local binary and read its version. A missing binary is not an
    // error here — we return `available: false` with an "unknown" version so the
    // startup check stays silent rather than surfacing noise.
    let current_version = resolve_ytdlp()
        .and_then(|path| get_binary_version(&path, &["--version"]))
        .map(|v| strip_v(v.trim()).to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if current_version == "unknown" {
        return Ok(YtdlpUpdateInfo {
            available: false,
            current_version,
            latest_version: String::new(),
        });
    }

    let release = fetch_latest_release(YTDLP_REPO).await?;
    let latest_version = strip_v(&release.tag_name).to_string();
    let available = is_newer(&latest_version, &current_version);

    Ok(YtdlpUpdateInfo {
        available,
        current_version,
        latest_version,
    })
}

/// Open a release page (or any URL) in the user's default browser.
/// Falls back to the repo releases page when the given URL is empty.
#[tauri::command]
pub async fn open_release_page(app_handle: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let target = if url.trim().is_empty() {
        RELEASES_PAGE.to_string()
    } else {
        url
    };

    app_handle
        .opener()
        .open_url(target, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Update yt-dlp by re-downloading the latest binary. Thin wrapper over the
/// existing setup download logic so the `setup://progress` event stream — and
/// therefore the frontend progress bar — works without any changes.
#[tauri::command]
pub async fn update_ytdlp(app_handle: AppHandle) -> Result<String, String> {
    crate::commands::setup::download_ytdlp(app_handle).await
}
