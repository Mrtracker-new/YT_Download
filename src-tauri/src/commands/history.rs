use tauri::State;
use serde::{Deserialize, Serialize};
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub job_id: String,
    pub url: String,
    pub title: String,
    pub uploader: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<u64>,
    pub file_path: Option<String>,
    pub file_size: Option<u64>,
    pub format: String,
    pub quality: String,
    pub audio_only: bool,
    pub status: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[tauri::command]
pub async fn get_history(
    page: Option<u32>,
    page_size: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<HistoryItem>, String> {
    let db = state.db.lock().await;
    let items = db
        .get_history(page.unwrap_or(0), page_size.unwrap_or(50))
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub async fn delete_history_item(
    job_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.delete_history_item(&job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().await;
    db.clear_history().map_err(|e| e.to_string())
}
