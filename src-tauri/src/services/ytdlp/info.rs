use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;
use crate::services::binary_resolver::resolve_ytdlp;
use crate::commands::video::{VideoInfo, VideoFormat, SubtitleTrack, PlaylistInfo, PlaylistItem};

/// Raw yt-dlp JSON output structure
#[derive(Debug, Deserialize)]
struct YtDlpRawInfo {
    id: Option<String>,
    title: Option<String>,
    uploader: Option<String>,
    channel: Option<String>,
    duration: Option<f64>,
    thumbnail: Option<String>,
    description: Option<String>,
    formats: Option<Vec<YtDlpRawFormat>>,
    subtitles: Option<HashMap<String, Vec<YtDlpRawSubtitle>>>,
    automatic_captions: Option<HashMap<String, Vec<YtDlpRawSubtitle>>>,
    // Playlist fields
    entries: Option<Vec<YtDlpRawPlaylistEntry>>,
    #[allow(dead_code)]
    playlist_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct YtDlpRawFormat {
    format_id: Option<String>,
    ext: Option<String>,
    height: Option<u32>,
    width: Option<u32>,
    vcodec: Option<String>,
    acodec: Option<String>,
    filesize: Option<u64>,
    tbr: Option<f64>,
}

#[derive(Debug, Deserialize, Clone)]
struct YtDlpRawSubtitle {
    ext: Option<String>,
    url: Option<String>,
    name: Option<String>,
}

/// A thumbnail object in yt-dlp's flat playlist entries (thumbnails[] array)
#[derive(Debug, Deserialize, Clone)]
struct YtDlpRawThumbnail {
    url: Option<String>,
    #[allow(dead_code)]
    height: Option<u32>,
    #[allow(dead_code)]
    width: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct YtDlpRawPlaylistEntry {
    id: Option<String>,
    title: Option<String>,
    url: Option<String>,
    webpage_url: Option<String>,
    duration: Option<f64>,
    // Flat playlist entries use `thumbnails` (array), not `thumbnail` (string)
    thumbnail: Option<String>,
    thumbnails: Option<Vec<YtDlpRawThumbnail>>,
    uploader: Option<String>,
    channel: Option<String>,
}

/// Fetches full video information from yt-dlp.
pub async fn fetch_video_info(url: &str) -> Result<VideoInfo> {
    let ytdlp = resolve_ytdlp().ok_or_else(|| anyhow!("yt-dlp not found. Please check Settings to configure the path or it will be downloaded automatically."))?;

    let args = vec![
        "--dump-json".to_string(),
        "--no-warnings".to_string(),
        "--no-check-certificates".to_string(),
        "--skip-download".to_string(),
        "--no-playlist".to_string(),
        "--socket-timeout".to_string(), "15".to_string(),
        "--retries".to_string(), "2".to_string(),
        "--extractor-retries".to_string(), "1".to_string(),
        "--no-check-formats".to_string(),
        "--geo-bypass".to_string(),
        url.to_string(),
    ];

    let output = Command::new(&ytdlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|e| anyhow!("Failed to spawn yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("yt-dlp failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Err(anyhow!("yt-dlp returned no output"));
    }

    let raw: YtDlpRawInfo = serde_json::from_str(stdout.trim())
        .map_err(|e| anyhow!("Failed to parse yt-dlp output: {}", e))?;

    parse_video_info(raw)
}

/// Fetches full playlist information using --dump-single-json.
///
/// yt-dlp `--dump-single-json` outputs a single JSON object containing:
///   { id, title, uploader, entries: [ { id, title, url/webpage_url, duration, thumbnail, uploader } ] }
///
/// This is more reliable than `--flat-playlist --dump-json` (one-line-per-entry format)
/// which can break on large playlists, truncated output, or non-YouTube sites.
pub async fn fetch_playlist_info(url: &str) -> Result<PlaylistInfo> {
    // Derive the host once — used for platform-aware entry URL construction
    let playlist_host = url::Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
        .unwrap_or_default();
    let ytdlp = resolve_ytdlp().ok_or_else(|| anyhow!("yt-dlp not found. Please go to Settings to download it."))?;

    let output = Command::new(&ytdlp)
        .args(&[
            "--dump-single-json",      // Single JSON object for the whole playlist
            "--flat-playlist",         // Don't fetch full info for each entry (fast)
            "--no-warnings",
            "--no-check-certificates",
            "--socket-timeout", "30",
            "--retries", "3",
            "--extractor-retries", "2",
            "--geo-bypass",
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|e| anyhow!("Failed to spawn yt-dlp: {}", e))?;

    // Capture stderr for better error messages
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        // Extract the most useful error line from stderr
        let error_line = stderr
            .lines()
            .find(|l| l.contains("ERROR") || l.contains("error") || l.contains("Unable"))
            .unwrap_or(stderr.trim());
        return Err(anyhow!("{}", if error_line.is_empty() { "yt-dlp failed with no output" } else { error_line }));
    }

    if stdout.trim().is_empty() {
        return Err(anyhow!(
            "yt-dlp returned no output. The URL may not be a playlist, or the playlist may be private/unavailable.\nURL: {}",
            url
        ));
    }

    // Parse the single JSON object
    let raw: YtDlpRawInfo = serde_json::from_str(stdout.trim())
        .map_err(|e| anyhow!(
            "Failed to parse yt-dlp playlist output: {}.\nFirst 200 chars: {}",
            e,
            &stdout[..stdout.len().min(200)]
        ))?;

    // Extract playlist-level metadata BEFORE consuming raw.entries (Rust ownership)
    let playlist_id = raw.id.unwrap_or_default();
    let playlist_title = raw.title.unwrap_or_else(|| "Unknown Playlist".to_string());
    let playlist_uploader = raw.uploader.or(raw.channel).unwrap_or_else(|| "Unknown".to_string());
    let playlist_thumbnail = raw.thumbnail;
    let entries_raw = raw.entries.unwrap_or_default();

    if entries_raw.is_empty() {
        return Err(anyhow!(
            "Playlist '{}' has no accessible entries. It may be empty, private, or region-locked.",
            playlist_title
        ));
    }

    let entries: Vec<PlaylistItem> = entries_raw
        .into_iter()
        .filter(|e| e.id.is_some()) // Skip null/unavailable entries
        .filter_map(|e| {
            let id = e.id.clone().unwrap_or_default();

            // Prefer webpage_url → url field → platform-aware fallback.
            // NEVER fall back to a YouTube URL for non-YouTube content — that causes
            // yt-dlp to invoke the YouTube extractor on a Vimeo/other numeric ID,
            // producing "Incomplete YouTube ID" errors.
            let video_url = e.webpage_url.clone()
                .or_else(|| e.url.clone())
                .filter(|u| !u.is_empty() && u.starts_with("http"));

            let video_url = match video_url {
                Some(u) => u,
                None => {
                    // Build a platform-correct fallback URL from the playlist host
                    build_fallback_url(&playlist_host, &id)?
                }
            };

            Some(PlaylistItem {
                id,
                title: e.title.clone().unwrap_or_else(|| "[Unavailable]".to_string()),
                url: video_url,
                duration: e.duration.map(|d| d as u64),
                thumbnail: e.thumbnail.clone().or_else(|| {
                    // Flat playlist entries provide thumbnails[] array, not thumbnail string
                    e.thumbnails.as_ref()
                        .and_then(|ts| ts.last())
                        .and_then(|t| t.url.clone())
                }),
                uploader: e.uploader.clone().or_else(|| e.channel.clone()),
            })
        })
        .collect();

    let entry_count = entries.len();

    Ok(PlaylistInfo {
        id: playlist_id,
        title: playlist_title,
        uploader: playlist_uploader,
        thumbnail: playlist_thumbnail,
        entry_count,
        entries,
    })
}

/// Build a platform-correct video URL from a playlist host and video ID.
/// Returns None if the platform is unknown (entry will be silently skipped).
///
/// This prevents the catastrophic mistake of constructing a YouTube URL
/// (https://youtube.com/watch?v=<VIMEO_ID>) for non-YouTube playlists,
/// which causes yt-dlp to invoke the YouTube extractor and fail with
/// "Incomplete YouTube ID" errors.
fn build_fallback_url(host: &str, id: &str) -> Option<String> {
    if id.is_empty() {
        return None;
    }
    if host.contains("youtube") || host.contains("youtu.be") {
        Some(format!("https://www.youtube.com/watch?v={}", id))
    } else if host.contains("vimeo") {
        Some(format!("https://vimeo.com/{}", id))
    } else if host.contains("soundcloud") {
        // SoundCloud track URLs can't be reliably reconstructed from ID alone
        None
    } else if host.contains("dailymotion") {
        Some(format!("https://www.dailymotion.com/video/{}", id))
    } else if host.contains("bilibili") {
        Some(format!("https://www.bilibili.com/video/{}", id))
    } else {
        // Unknown platform — skip rather than guess. yt-dlp will fail
        // if given the wrong URL format.
        None
    }
}

fn parse_video_info(raw: YtDlpRawInfo) -> Result<VideoInfo> {
    let id = raw.id.ok_or_else(|| anyhow!("Missing video ID"))?;
    let title = raw.title.ok_or_else(|| anyhow!("Missing video title"))?;

    let formats: Vec<VideoFormat> = raw.formats.unwrap_or_default().into_iter().map(|f| VideoFormat {
        format_id: f.format_id.unwrap_or_default(),
        ext: f.ext.unwrap_or_default(),
        quality: f.height.map(|h| format!("{}p", h)).unwrap_or_else(|| "unknown".to_string()),
        filesize: f.filesize,
        vcodec: f.vcodec,
        acodec: f.acodec,
        height: f.height,
        width: f.width,
        tbr: f.tbr,
    }).collect();

    // Collect unique available qualities with video codec
    let mut seen_heights = std::collections::HashSet::new();
    let mut available_qualities: Vec<String> = formats
        .iter()
        .filter(|f| {
            f.height.is_some()
                && f.vcodec.as_deref().map_or(false, |v| v != "none" && !v.is_empty())
        })
        .filter_map(|f| f.height.map(|h| format!("{}p", h)))
        .filter(|q| seen_heights.insert(q.clone()))
        .collect();

    // Sort descending (4K first)
    available_qualities.sort_by(|a, b| {
        let an: u32 = a.replace('p', "").parse().unwrap_or(0);
        let bn: u32 = b.replace('p', "").parse().unwrap_or(0);
        bn.cmp(&an)
    });

    let subtitles: HashMap<String, Vec<SubtitleTrack>> = raw.subtitles.unwrap_or_default()
        .into_iter()
        .map(|(lang, tracks)| {
            let converted = tracks.into_iter().map(|t| SubtitleTrack {
                ext: t.ext.unwrap_or_default(),
                url: t.url,
                name: t.name,
            }).collect();
            (lang, converted)
        })
        .collect();

    let automatic_captions: HashMap<String, Vec<SubtitleTrack>> = raw.automatic_captions.unwrap_or_default()
        .into_iter()
        .map(|(lang, tracks)| {
            let converted = tracks.into_iter().map(|t| SubtitleTrack {
                ext: t.ext.unwrap_or_default(),
                url: t.url,
                name: t.name,
            }).collect();
            (lang, converted)
        })
        .collect();

    Ok(VideoInfo {
        video_id: id,
        title,
        uploader: raw.uploader.or(raw.channel).unwrap_or_else(|| "Unknown".to_string()),
        duration: raw.duration.map(|d| d as u64).unwrap_or(0),
        thumbnail: raw.thumbnail.unwrap_or_default(),
        description: raw.description.unwrap_or_default(),
        formats,
        available_qualities,
        subtitles,
        automatic_captions,
    })
}
