pub mod commands;
pub mod database;
pub mod security;
pub mod services;

use std::sync::Arc;
use tokio::sync::Mutex;

use database::Database;
use services::download_manager::DownloadManager;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub download_manager: Arc<Mutex<DownloadManager>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let db = Arc::new(Mutex::new(
        Database::new().expect("Failed to initialize database"),
    ));

    let download_manager = Arc::new(Mutex::new(DownloadManager::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: db.clone(),
            download_manager: download_manager.clone(),
        })
        .invoke_handler(tauri::generate_handler![
            // Video commands
            commands::video::get_video_info,
            commands::video::get_subtitle_langs,
            commands::video::get_playlist_info,
            // Download commands
            commands::download::start_download,
            commands::download::cancel_download,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::retry_download,
            commands::download::get_queue,
            // History commands
            commands::history::get_history,
            commands::history::delete_history_item,
            commands::history::clear_history,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            // System commands
            commands::system::open_folder,
            commands::system::check_binaries,
            commands::system::select_folder,
            commands::system::select_cookie_file,
            commands::system::get_default_download_dir,
            // Setup commands
            commands::setup::check_setup,
            commands::setup::download_ytdlp,
            commands::setup::download_ffmpeg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
