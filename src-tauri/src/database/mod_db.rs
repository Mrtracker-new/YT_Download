use crate::commands::history::HistoryItem;
use crate::commands::settings::AppSettings;
use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::PathBuf;

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Opens (or creates) the SQLite database in the app data directory.
    pub fn new() -> Result<Self> {
        let db_path = Self::db_path();

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create app data directory")?;
        }

        let conn = Connection::open(&db_path).context("Failed to open database")?;

        // Enable WAL mode for better concurrent access
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self { conn };
        db.run_migrations()?;

        // Enforce the history retention policy on startup so stale rows are
        // pruned even if the app was closed when they expired.
        if let Ok(s) = db.get_settings() {
            let _ = db.prune_history(s.keep_history, s.history_retention_days);
        }

        Ok(db)
    }

    fn db_path() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
            .join("com.mrtracker.ytdownloader")
            .join("data.db")
    }

    fn run_migrations(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS history (
                job_id       TEXT PRIMARY KEY,
                url          TEXT NOT NULL,
                title        TEXT NOT NULL,
                uploader     TEXT,
                thumbnail    TEXT,
                duration     INTEGER,
                file_path    TEXT,
                file_size    INTEGER,
                format       TEXT DEFAULT 'mp4',
                quality      TEXT DEFAULT '720p',
                audio_only   INTEGER DEFAULT 0,
                status       TEXT DEFAULT 'completed',
                created_at   INTEGER NOT NULL,
                completed_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
        ",
        )?;
        Ok(())
    }

    // ─── Settings ─────────────────────────────────────────────────────────────

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1")?;
        let result: rusqlite::Result<String> = stmt.query_row(params![key], |row| row.get(0));
        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings> {
        let mut settings = AppSettings::default();

        let keys = [
            "downloadDir",
            "maxConcurrentDownloads",
            "fileNameTemplate",
            "ytdlpPath",
            "ffmpegPath",
            "theme",
            "showNotifications",
            "autoUpdateBinaries",
            "keepHistory",
            "historyRetentionDays",
            "cookieBrowser",
            "cookieFile",
            "skippedAppVersion",
            "lastYtdlpUpdateCheck",
        ];

        for key in &keys {
            if let Ok(Some(value)) = self.get_setting(key) {
                match *key {
                    "downloadDir" => settings.download_dir = value,
                    "maxConcurrentDownloads" => {
                        settings.max_concurrent_downloads = value.parse().unwrap_or(2)
                    }
                    "fileNameTemplate" => settings.file_name_template = value,
                    "ytdlpPath" => settings.ytdlp_path = value,
                    "ffmpegPath" => settings.ffmpeg_path = value,
                    "theme" => settings.theme = value,
                    "showNotifications" => settings.show_notifications = value == "true",
                    "autoUpdateBinaries" => settings.auto_update_binaries = value == "true",
                    "keepHistory" => settings.keep_history = value != "false",
                    "historyRetentionDays" => {
                        settings.history_retention_days = value.parse().unwrap_or(30)
                    }
                    "cookieBrowser" => settings.cookie_browser = value,
                    "cookieFile" => settings.cookie_file = value,
                    "skippedAppVersion" => settings.skipped_app_version = value,
                    "lastYtdlpUpdateCheck" => settings.last_ytdlp_update_check = value,
                    _ => {}
                }
            }
        }

        Ok(settings)
    }

    pub fn save_settings(&self, s: &AppSettings) -> Result<()> {
        self.set_setting("downloadDir", &s.download_dir)?;
        self.set_setting(
            "maxConcurrentDownloads",
            &s.max_concurrent_downloads.to_string(),
        )?;
        self.set_setting("fileNameTemplate", &s.file_name_template)?;
        self.set_setting("ytdlpPath", &s.ytdlp_path)?;
        self.set_setting("ffmpegPath", &s.ffmpeg_path)?;
        self.set_setting("theme", &s.theme)?;
        self.set_setting(
            "showNotifications",
            if s.show_notifications {
                "true"
            } else {
                "false"
            },
        )?;
        self.set_setting(
            "autoUpdateBinaries",
            if s.auto_update_binaries {
                "true"
            } else {
                "false"
            },
        )?;
        self.set_setting("keepHistory", if s.keep_history { "true" } else { "false" })?;
        self.set_setting(
            "historyRetentionDays",
            &s.history_retention_days.to_string(),
        )?;
        self.set_setting("cookieBrowser", &s.cookie_browser)?;
        self.set_setting("cookieFile", &s.cookie_file)?;
        self.set_setting("skippedAppVersion", &s.skipped_app_version)?;
        self.set_setting("lastYtdlpUpdateCheck", &s.last_ytdlp_update_check)?;

        // Apply the retention policy immediately so changing these settings
        // takes effect without waiting for the next startup.
        self.prune_history(s.keep_history, s.history_retention_days)?;
        Ok(())
    }

    // ─── History ──────────────────────────────────────────────────────────────

    pub fn insert_history(&self, item: &HistoryItem) -> Result<()> {
        // Respect the "keep history" toggle — don't record when disabled.
        if self.get_setting("keepHistory")?.as_deref() == Some("false") {
            return Ok(());
        }

        self.conn.execute(
            "INSERT OR REPLACE INTO history
                (job_id, url, title, uploader, thumbnail, duration, file_path, file_size,
                 format, quality, audio_only, status, created_at, completed_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                item.job_id,
                item.url,
                item.title,
                item.uploader,
                item.thumbnail,
                item.duration.map(|d| d as i64),
                item.file_path,
                item.file_size.map(|s| s as i64),
                item.format,
                item.quality,
                item.audio_only as i32,
                item.status,
                item.created_at,
                item.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_history(&self, page: u32, page_size: u32) -> Result<Vec<HistoryItem>> {
        let offset = page * page_size;
        let mut stmt = self.conn.prepare(
            "SELECT job_id, url, title, uploader, thumbnail, duration, file_path, file_size,
                    format, quality, audio_only, status, created_at, completed_at
             FROM history
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let items = stmt.query_map(params![page_size as i64, offset as i64], |row| {
            Ok(HistoryItem {
                job_id: row.get(0)?,
                url: row.get(1)?,
                title: row.get(2)?,
                uploader: row.get(3)?,
                thumbnail: row.get(4)?,
                duration: row.get::<_, Option<i64>>(5)?.map(|d| d as u64),
                file_path: row.get(6)?,
                file_size: row.get::<_, Option<i64>>(7)?.map(|s| s as u64),
                format: row.get(8)?,
                quality: row.get(9)?,
                audio_only: row.get::<_, i32>(10)? != 0,
                status: row.get(11)?,
                created_at: row.get(12)?,
                completed_at: row.get(13)?,
            })
        })?;

        let result: rusqlite::Result<Vec<_>> = items.collect();
        Ok(result?)
    }

    pub fn delete_history_item(&self, job_id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM history WHERE job_id = ?1", params![job_id])?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM history", [])?;
        Ok(())
    }

    /// Enforces the history retention policy.
    /// - `keep_history == false` → wipe all history.
    /// - `retention_days > 0`    → drop rows older than that many days.
    /// - `retention_days == 0`   → keep forever (no-op when keeping history).
    pub fn prune_history(&self, keep_history: bool, retention_days: u32) -> Result<()> {
        if !keep_history {
            self.conn.execute("DELETE FROM history", [])?;
            return Ok(());
        }

        if retention_days > 0 {
            let cutoff =
                chrono::Utc::now().timestamp_millis() - (retention_days as i64) * 86_400_000;
            self.conn
                .execute("DELETE FROM history WHERE created_at < ?1", params![cutoff])?;
        }

        Ok(())
    }
}
