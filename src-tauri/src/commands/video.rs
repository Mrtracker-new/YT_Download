use crate::security::url_validator::validate_url;
use crate::services::ytdlp::info::{fetch_playlist_info, fetch_video_info};
use anyhow::Result;
use serde::{Deserialize, Serialize};

// ─── Types mirroring the frontend TypeScript types ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub quality: String,
    pub filesize: Option<u64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub height: Option<u32>,
    pub width: Option<u32>,
    pub tbr: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    pub ext: String,
    pub url: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub video_id: String,
    pub title: String,
    pub uploader: String,
    pub duration: u64,
    pub thumbnail: String,
    pub description: String,
    pub formats: Vec<VideoFormat>,
    pub available_qualities: Vec<String>,
    pub subtitles: std::collections::HashMap<String, Vec<SubtitleTrack>>,
    pub automatic_captions: std::collections::HashMap<String, Vec<SubtitleTrack>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<u64>,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub thumbnail: Option<String>,
    pub entry_count: usize,
    pub entries: Vec<PlaylistItem>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    // Validate URL first (security)
    let validated_url = validate_url(&url).map_err(|e| e.to_string())?;

    let info = fetch_video_info(&validated_url)
        .await
        .map_err(|e| format!("Failed to fetch video info: {}", e))?;

    Ok(info)
}

#[tauri::command]
pub async fn get_playlist_info(url: String) -> Result<PlaylistInfo, String> {
    let validated_url = validate_url(&url).map_err(|e| e.to_string())?;

    let info = fetch_playlist_info(&validated_url)
        .await
        .map_err(|e| format!("Failed to fetch playlist: {}", e))?;

    Ok(info)
}
