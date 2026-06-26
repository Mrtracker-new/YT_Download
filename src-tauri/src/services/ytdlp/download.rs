use anyhow::{anyhow, Result};
use serde::Serialize;
use std::process::Stdio;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::watch;

use crate::security::url_validator::sanitize_for_logging;
use crate::services::binary_resolver::{resolve_ffmpeg, resolve_ytdlp};
use crate::services::download_manager::job::ControlSignal;
use crate::services::ytdlp::progress::{parse_progress_line, ProcessingStatus};

// ─── Event Payloads ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEventPayload {
    pub job_id: String,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub total_size: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteEventPayload {
    pub job_id: String,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEventPayload {
    pub job_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelledEventPayload {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PausedEventPayload {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumedEventPayload {
    pub job_id: String,
}

// ─── Download Args ─────────────────────────────────────────────────────────────

pub struct DownloadArgs {
    pub job_id: String,
    pub url: String,
    pub quality: String,
    pub audio_only: bool,
    pub subtitle_enabled: bool,
    pub subtitle_language: String,
    pub subtitle_mode: String, // "embed" | "sidecar"
    pub subtitle_include_auto: bool,
    pub output_dir: String,
    pub file_name_template: String,
    /// Browser to pull cookies from (e.g. "chrome", "edge", "firefox"). Empty = none.
    pub cookie_browser: String,
    /// Path to a cookies.txt file. When non-empty, passed via `--cookies` and takes
    /// precedence over `cookie_browser` (bulletproof on Windows where browser cookie
    /// decryption can fail). Empty = fall back to browser extraction.
    pub cookie_file: String,
    /// Preferred video codec: "auto" | "h264" | "vp9" | "av1". Empty/"auto" = no constraint.
    pub video_codec: String,
    /// Audio output format for audio-only downloads: "mp3" | "opus" | "m4a" | "flac" | "wav".
    pub audio_format: String,
    /// Audio bitrate in kbps for lossy audio formats (e.g. "192"). Ignored for flac/wav.
    pub audio_quality: String,
    /// Embed the video thumbnail as cover art (audio) / poster (video).
    pub embed_thumbnail: bool,
    /// SponsorBlock categories to remove (e.g. ["sponsor", "intro"]). Empty = disabled.
    pub sponsorblock_categories: Vec<String>,
}

impl DownloadArgs {
    /// True when a cookies.txt file is configured.
    fn has_cookie_file(&self) -> bool {
        !self.cookie_file.trim().is_empty()
    }

    /// True when a browser is configured for cookie extraction.
    fn has_cookie_browser(&self) -> bool {
        !self.cookie_browser.is_empty() && self.cookie_browser != "none"
    }
}

/// Map a user-facing codec choice to the yt-dlp `vcodec` prefix used in `-f` filters.
/// Returns None for "auto"/empty (no codec constraint).
fn vcodec_prefix(codec: &str) -> Option<&'static str> {
    match codec.trim().to_lowercase().as_str() {
        "h264" | "avc" | "avc1" => Some("avc1"),
        "vp9" => Some("vp9"),
        "av1" | "av01" => Some("av01"),
        _ => None, // "auto", "", or unknown → let yt-dlp pick the best
    }
}

/// Build the `--audio-quality` value for the chosen audio format.
/// Lossless formats (flac/wav) ignore bitrate → use yt-dlp's best ("0").
/// Lossy formats take a kbps value (e.g. "192" → "192K"); falls back to "192K".
fn audio_quality_arg(audio_format: &str, bitrate: &str) -> String {
    match audio_format.trim().to_lowercase().as_str() {
        "flac" | "wav" => "0".to_string(),
        _ => {
            let b = bitrate.trim();
            if b.is_empty() || !b.chars().all(|c| c.is_ascii_digit()) {
                "192K".to_string()
            } else {
                format!("{}K", b)
            }
        }
    }
}

// ─── Public entry point ────────────────────────────────────────────────────────

/// Executes a yt-dlp download, emitting Tauri events for progress.
///
/// # Control mechanism
/// `control_rx` is a `watch::Receiver<ControlSignal>` that the manager sends to:
///   - `ControlSignal::Pause`  → kill process, preserve partial files, return `Err("__paused__")`
///   - `ControlSignal::Cancel` → kill process, delete partial files, return `Err("__cancelled__")`
///
/// The watcher uses `tokio::select!` for immediate reaction (no polling delay).
///
/// # Process killing (Windows)
/// Instead of `taskkill /F /T` (which spawns a new process), we use Windows Job Objects:
/// the spawned yt-dlp process is immediately assigned to a Job Object. Calling
/// `TerminateJobObject` atomically kills yt-dlp and every child (e.g., ffmpeg) it spawned,
/// including processes that were forked after assignment. This is the correct OS-level approach.
///
/// # Process killing (Unix)
/// We send SIGKILL to the process group so ffmpeg children are killed along with yt-dlp.
pub async fn run_download(
    args: DownloadArgs,
    app_handle: AppHandle,
    control_rx: watch::Receiver<ControlSignal>,
) -> Result<String> {
    let ytdlp =
        resolve_ytdlp().ok_or_else(|| anyhow!("yt-dlp not found. Please go to Settings."))?;
    let ffmpeg = resolve_ffmpeg();

    let mut cmd_args: Vec<String> = Vec::new();

    // ── Output format & quality ────────────────────────────────────────────────
    if args.audio_only {
        let audio_format = if args.audio_format.trim().is_empty() {
            "mp3".to_string()
        } else {
            args.audio_format.trim().to_string()
        };
        cmd_args.extend([
            "-x".to_string(),
            "--audio-format".to_string(),
            audio_format.clone(),
            "--audio-quality".to_string(),
            audio_quality_arg(&audio_format, &args.audio_quality),
        ]);
        // Cover art: embed the thumbnail into the audio container.
        if args.embed_thumbnail {
            cmd_args.push("--embed-thumbnail".to_string());
        }
    } else {
        // Optional codec constraint (e.g. avc1/vp9/av01) injected into each video selector.
        let vcodec = vcodec_prefix(&args.video_codec);
        let vfilter = vcodec
            .map(|c| format!("[vcodec^={}]", c))
            .unwrap_or_default();

        let quality_height = args.quality.replace('p', "");
        let height_filter = if !quality_height.is_empty() && quality_height != "best" {
            format!("[height<={}]", quality_height)
        } else {
            String::new()
        };

        // bestvideo<codec><height>+bestaudio / fallbacks that progressively drop constraints.
        let format_selector = format!(
            "bestvideo{vf}{hf}+bestaudio/bestvideo{hf}+bestaudio/best{hf}/best",
            vf = vfilter,
            hf = height_filter,
        );
        cmd_args.extend(["-f".to_string(), format_selector]);

        // vp9/av1 don't mux cleanly into mp4 — use mkv so the merge never fails.
        let merge_format = match vcodec {
            Some("vp9") | Some("av01") => "mkv",
            _ => "mp4",
        };
        cmd_args.extend([
            "--merge-output-format".to_string(),
            merge_format.to_string(),
        ]);

        // Embed thumbnail as a poster/cover when requested.
        if args.embed_thumbnail {
            cmd_args.push("--embed-thumbnail".to_string());
        }
    }

    // ── SponsorBlock (applies to both audio and video) ──────────────────────────
    if !args.sponsorblock_categories.is_empty() {
        cmd_args.extend([
            "--sponsorblock-remove".to_string(),
            args.sponsorblock_categories.join(","),
        ]);
    }

    // ── Subtitles ──────────────────────────────────────────────────────────────
    if args.subtitle_enabled && !args.audio_only {
        if args.subtitle_include_auto {
            cmd_args.push("--write-auto-subs".to_string());
        }
        cmd_args.extend([
            "--write-subs".to_string(),
            "--sub-lang".to_string(),
            args.subtitle_language.clone(),
        ]);
        if args.subtitle_mode == "embed" {
            cmd_args.push("--embed-subs".to_string());
        } else {
            cmd_args.extend(["--convert-subs".to_string(), "srt".to_string()]);
        }
    }

    // ── Output path ────────────────────────────────────────────────────────────
    let output_template = format!(
        "{}/{}",
        args.output_dir.trim_end_matches(['/', '\\']),
        args.file_name_template
    );
    cmd_args.extend(["-o".to_string(), output_template]);

    // ── ffmpeg location ────────────────────────────────────────────────────────
    if let Some(ref ffmpeg_path) = ffmpeg {
        cmd_args.extend(["--ffmpeg-location".to_string(), ffmpeg_path.clone()]);
    }

    // ── Speed & reliability flags ──────────────────────────────────────────────
    cmd_args.extend([
        "--newline".to_string(),
        "--progress".to_string(),
        "--concurrent-fragments".to_string(),
        "4".to_string(),
        "--buffer-size".to_string(),
        "16K".to_string(),
        "--no-warnings".to_string(),
        "--no-check-certificates".to_string(),
        "--retries".to_string(),
        "5".to_string(),
        "--fragment-retries".to_string(),
        "5".to_string(),
        "--file-access-retries".to_string(),
        "3".to_string(),
        "--geo-bypass".to_string(),
        "--socket-timeout".to_string(),
        "30".to_string(),
        "--add-metadata".to_string(),
        "--no-playlist".to_string(),
        // NOTE: no --continue here. Resuming with --continue on corrupted partial
        // files causes ffmpeg to get stuck during merge. Restart cleanly every time.
        "--no-part".to_string(),
    ]);

    // ── Cookies (file takes precedence, applies to every site) ─────────────────
    // A cookies.txt file is the bulletproof path: works for any site and sidesteps
    // Windows browser-cookie decryption failures (Chrome/Edge App-Bound Encryption).
    if args.has_cookie_file() {
        cmd_args.extend(["--cookies".to_string(), args.cookie_file.trim().to_string()]);
    }

    // ── Platform-specific flags ────────────────────────────────────────────────
    let url_host = url::Url::parse(&args.url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
        .unwrap_or_default();

    if url_host.contains("vimeo") {
        cmd_args.extend([
            "--add-header".to_string(),
            "Referer:https://vimeo.com/".to_string(),
            "--add-header".to_string(),
            "Origin:https://vimeo.com".to_string(),
        ]);
    } else if url_host.contains("instagram") {
        // Referer always helps; cookies only when a browser is explicitly configured.
        // Empty = no cookies → public reels/posts download fine and avoid DPAPI decrypt errors.
        cmd_args.extend([
            "--add-header".to_string(),
            "Referer:https://www.instagram.com/".to_string(),
        ]);
        // Browser cookies only when no cookies.txt file is set (file already added above).
        if !args.has_cookie_file() && args.has_cookie_browser() {
            cmd_args.extend([
                "--cookies-from-browser".to_string(),
                args.cookie_browser.clone(),
            ]);
        }
    } else if (url_host.contains("twitter") || url_host.contains("x.com"))
        && !args.has_cookie_file()
        && args.has_cookie_browser()
    {
        cmd_args.extend([
            "--cookies-from-browser".to_string(),
            args.cookie_browser.clone(),
        ]);
    }

    // ── URL (always last) ──────────────────────────────────────────────────────
    cmd_args.push(args.url.clone());

    log::info!(
        "yt-dlp job {} starting ({} args): {}",
        args.job_id,
        cmd_args.len(),
        sanitize_for_logging(&args.url)
    );

    // ── Spawn yt-dlp ──────────────────────────────────────────────────────────
    // On Windows: set CREATE_NO_WINDOW so yt-dlp/ffmpeg run silently.
    // The process will be attached to a Job Object immediately after spawn.
    #[cfg(windows)]
    let mut child = {
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new(&ytdlp)
            .args(&cmd_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn yt-dlp: {}", e))?
    };

    #[cfg(not(windows))]
    let mut child = Command::new(&ytdlp)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| anyhow!("Failed to spawn yt-dlp: {}", e))?;

    // Get the OS PID before moving child into the wait call.
    let child_pid = child.id();

    // ── Assign to Windows Job Object ──────────────────────────────────────────
    // This must happen immediately after spawn, before yt-dlp has a chance to
    // fork ffmpeg. Once assigned, TerminateJobObject kills the whole tree atomically.
    #[cfg(windows)]
    let job_object_handle = create_job_object_for_pid(child_pid);
    #[cfg(not(windows))]
    let job_object_handle: Option<()> = None;

    let stdout = child.stdout.take().expect("stdout pipe missing");
    let stderr = child.stderr.take().expect("stderr pipe missing");

    // ── Shared output-file tracker (parsed from yt-dlp stdout) ────────────────
    let output_path: Arc<StdMutex<Option<String>>> = Arc::new(StdMutex::new(None));
    let output_path_writer = output_path.clone();

    // ── Stdout task: parse progress + track output file ───────────────────────
    let job_id_for_stdout = args.job_id.clone();
    let app_for_stdout = app_handle.clone();
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut last_progress = -1f64;

        while let Ok(Some(line)) = reader.next_line().await {
            // Track where yt-dlp writes the output file
            if let Some(dest) = extract_destination(&line) {
                if let Ok(mut guard) = output_path_writer.lock() {
                    *guard = Some(dest);
                }
            }

            // Parse and emit progress events
            if let Some(update) = parse_progress_line(&line) {
                let changed = (update.progress - last_progress).abs() >= 0.5
                    || update.status != ProcessingStatus::Downloading;

                if changed {
                    last_progress = update.progress;
                    let _ = app_for_stdout.emit(
                        "download://progress",
                        ProgressEventPayload {
                            job_id: job_id_for_stdout.clone(),
                            progress: update.progress,
                            speed: update.speed,
                            eta: update.eta,
                            status: update.status.as_str().to_string(),
                            total_size: update.total_size,
                        },
                    );
                }
            }
        }
    });

    // ── Stderr task: collect error lines concurrently ─────────────────────────
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut lines = Vec::new();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                lines.push(line);
            }
        }
        lines
    });

    // ── Control watcher: reacts immediately to watch channel changes ──────────
    //
    // Unlike the old 100ms poll loop, tokio::select! wakes immediately when the
    // sender calls `control_tx.send(ControlSignal::Pause/Cancel)`. This eliminates
    // the race where a progress event could arrive after the paused event.
    //
    // The watcher task owns a clone of job_object_handle (on Windows) and child_pid
    // so it can terminate the process tree without touching any shared mutex.
    let jid_for_watcher = args.job_id.clone();
    let app_for_watcher = app_handle.clone();
    let output_dir_for_watcher = args.output_dir.clone();

    // We need to pass the Job Object handle across the spawn boundary.
    // On Windows: wrap the raw HANDLE in a thread-safe newtype.
    // On non-Windows: the Option<()> handle is already trivially Send.
    #[cfg(windows)]
    let watcher_job_handle = job_object_handle.map(SendableHandle);
    #[cfg(not(windows))]
    let watcher_job_handle = job_object_handle;

    let mut watcher_rx = control_rx.clone();
    let control_watcher = tokio::spawn(async move {
        // Wait for any signal that is NOT Run.
        // changed() resolves as soon as the sender calls send() with any value.
        loop {
            // Wait for the value in the channel to change
            if watcher_rx.changed().await.is_err() {
                // Sender was dropped (manager shut down) — stop without killing
                break;
            }
            let signal = watcher_rx.borrow().clone();
            match signal {
                ControlSignal::Run => continue, // spurious wakeup, keep waiting
                ControlSignal::Pause => {
                    log::info!(
                        "Job {} received Pause signal — terminating process tree",
                        jid_for_watcher
                    );
                    kill_process_tree(child_pid, watcher_job_handle);
                    // Emit paused event from inside the watcher so it happens
                    // AFTER the process is dead — no race with progress events.
                    let _ = app_for_watcher.emit(
                        "download://paused",
                        PausedEventPayload {
                            job_id: jid_for_watcher.clone(),
                        },
                    );
                    break;
                }
                ControlSignal::Cancel => {
                    log::info!(
                        "Job {} received Cancel signal — terminating process tree",
                        jid_for_watcher
                    );
                    kill_process_tree(child_pid, watcher_job_handle);
                    cleanup_temp_files(&output_dir_for_watcher);
                    let _ = app_for_watcher.emit(
                        "download://cancelled",
                        CancelledEventPayload {
                            job_id: jid_for_watcher.clone(),
                        },
                    );
                    break;
                }
            }
        }
    });

    // Wait for process to finish (may be killed by the control watcher)
    let status = child
        .wait()
        .await
        .map_err(|e| anyhow!("Failed to wait for yt-dlp: {}", e))?;

    // Shut down helper tasks cleanly
    control_watcher.abort();
    stdout_task.await.ok();
    let stderr_lines = stderr_task.await.unwrap_or_default();

    // Check the final signal state to determine why the process exited
    let final_signal = control_rx.borrow().clone();
    match final_signal {
        ControlSignal::Pause => {
            // Process was killed for pause — partial files preserved intentionally.
            return Err(anyhow!("__paused__"));
        }
        ControlSignal::Cancel => {
            // Cleanup already done inside the watcher task.
            return Err(anyhow!("__cancelled__"));
        }
        ControlSignal::Run => {
            // Process exited on its own — check exit code.
        }
    }

    if !status.success() {
        let error_lines: Vec<_> = stderr_lines
            .iter()
            .filter(|l| l.to_lowercase().contains("error"))
            .cloned()
            .collect();
        let msg = if error_lines.is_empty() {
            stderr_lines
                .last()
                .cloned()
                .unwrap_or_else(|| "Download failed (unknown error)".to_string())
        } else {
            error_lines.join("; ")
        };
        return Err(anyhow!("{}", msg));
    }

    // ── Resolve final output file ──────────────────────────────────────────────
    // 1st choice: path we parsed from "[download] Destination:" lines
    let parsed = output_path.lock().ok().and_then(|g| g.clone());
    if let Some(p) = parsed {
        if std::path::Path::new(&p).exists() {
            return Ok(p);
        }
    }
    // 2nd choice: most recently modified media file in output directory
    find_most_recent_media_file(&args.output_dir)
}

// ─── Windows Job Object ────────────────────────────────────────────────────────

/// On Windows, wraps a raw HANDLE so it can be sent across tokio::spawn boundaries.
/// SAFETY: We own this handle exclusively and never share it across threads simultaneously.
#[cfg(windows)]
struct SendableHandle(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
// SAFETY: HANDLE is essentially a *mut c_void. We control its lifetime and only
// call TerminateJobObject from one thread at a time.
unsafe impl Send for SendableHandle {}

/// Create a Windows Job Object and assign the spawned process to it.
/// Returns the Job Object HANDLE; ownership is transferred to the caller.
/// On failure (e.g., PID already dead), logs a warning and returns None.
#[cfg(windows)]
fn create_job_object_for_pid(pid: Option<u32>) -> Option<windows::Win32::Foundation::HANDLE> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
    };

    let pid = pid?;

    unsafe {
        // Create an anonymous Job Object
        let job = match CreateJobObjectW(None, windows::core::PCWSTR::null()) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("CreateJobObjectW failed: {}", e);
                return None;
            }
        };

        // Set JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE so the process tree dies
        // even if our process exits unexpectedly (belt-and-suspenders).
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let _ = windows::Win32::System::JobObjects::SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );

        // Open the yt-dlp process with sufficient rights to assign to the Job Object
        let proc_handle = match OpenProcess(
            PROCESS_TERMINATE | PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION,
            false,
            pid,
        ) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("OpenProcess({}) failed: {}", pid, e);
                let _ = CloseHandle(job);
                return None;
            }
        };

        // Assign yt-dlp to the Job Object — any process it forks (ffmpeg) is
        // automatically assigned to the same Job Object.
        if let Err(e) = AssignProcessToJobObject(job, proc_handle) {
            log::warn!("AssignProcessToJobObject failed: {}", e);
            let _ = CloseHandle(proc_handle);
            let _ = CloseHandle(job);
            return None;
        }

        let _ = CloseHandle(proc_handle);
        Some(job)
    }
}

// ─── Process Tree Termination ──────────────────────────────────────────────────

/// Kill the entire process tree rooted at the spawned yt-dlp process.
///
/// Windows: Uses `TerminateJobObject` (via the Job Object created at spawn time)
///   which atomically kills yt-dlp AND all forked children (ffmpeg, etc.).
///   Falls back to a direct `TerminateProcess` call if the Job Object is unavailable.
///
/// Unix: Sends SIGKILL to the process group so every child receives the signal.
#[cfg(windows)]
fn kill_process_tree(pid: Option<u32>, job: Option<SendableHandle>) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::JobObjects::TerminateJobObject;
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    // Preferred path: terminate via Job Object (kills whole tree atomically)
    if let Some(SendableHandle(job_handle)) = job {
        unsafe {
            let _ = TerminateJobObject(job_handle, 1);
            let _ = CloseHandle(job_handle);
        }
        return;
    }

    // Fallback: terminate just the direct yt-dlp process (ffmpeg may linger)
    if let Some(pid) = pid {
        unsafe {
            if let Ok(proc) = OpenProcess(PROCESS_TERMINATE, false, pid) {
                let _ = TerminateProcess(proc, 1);
                let _ = CloseHandle(proc);
            }
        }
    }
}

#[cfg(not(windows))]
fn kill_process_tree(pid: Option<u32>, _job: Option<()>) {
    use nix::sys::signal::{killpg, Signal};
    use nix::unistd::Pid;
    if let Some(p) = pid {
        let _ = killpg(Pid::from_raw(p as i32), Signal::SIGKILL);
    }
}

// ─── Temp File Cleanup (cancel path only) ─────────────────────────────────────

/// Remove yt-dlp temporary files from the output directory after a cancel.
/// On pause we intentionally skip this — partial files are left in place.
/// yt-dlp writes intermediate stream files named like `Video.f137.mp4` and
/// `Video.f140.m4a`. Leaving them after cancel causes merge confusion on retry.
fn cleanup_temp_files(output_dir: &str) {
    let path = std::path::Path::new(output_dir);
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }

            let ext = p
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            let name = p.to_string_lossy().to_lowercase();

            if ext == "part"
                || ext == "ytdl"
                || ext == "temp"
                || name.ends_with(".ytdl")
                || is_ytdlp_stream_fragment(&p)
            {
                let _ = std::fs::remove_file(&p);
                log::debug!("Cleaned up temp file: {:?}", p);
            }
        }
    }
}

/// Returns true if the path looks like a yt-dlp intermediate stream fragment.
/// Pattern: `Title.fNNN.ext` where NNN is one or more digits (the format code).
fn is_ytdlp_stream_fragment(path: &std::path::Path) -> bool {
    let stem = match path.file_stem().and_then(|s| s.to_str()) {
        Some(s) => s,
        None => return false,
    };
    if let Some(dot_pos) = stem.rfind('.') {
        let after_dot = &stem[dot_pos + 1..];
        return after_dot.starts_with('f')
            && after_dot.len() > 1
            && after_dot[1..].chars().all(|c| c.is_ascii_digit());
    }
    false
}

/// Extract output file path from yt-dlp's stdout lines.
fn extract_destination(line: &str) -> Option<String> {
    if let Some(rest) = line.strip_prefix("[download] Destination: ") {
        let p = rest.trim().to_string();
        if !p.is_empty() {
            return Some(p);
        }
    }
    if line.contains("] Destination: ") {
        if let Some(pos) = line.find("] Destination: ") {
            let p = line[pos + 15..].trim().to_string();
            if !p.is_empty() {
                return Some(p);
            }
        }
    }
    if line.contains("Merging formats into ") {
        if let Some(pos) = line.find("Merging formats into ") {
            let raw = line[pos + 21..].trim().trim_matches('"').to_string();
            if !raw.is_empty() {
                return Some(raw);
            }
        }
    }
    None
}

/// Find the most recently modified media file in a directory (fallback).
fn find_most_recent_media_file(dir: &str) -> Result<String> {
    let path = std::path::Path::new(dir);
    if !path.exists() {
        return Err(anyhow!("Output directory does not exist: {}", dir));
    }
    let media_exts = [
        "mp4", "mkv", "webm", "mp3", "m4a", "ogg", "opus", "flac", "wav", "avi", "mov",
    ];
    let mut best: Option<(std::time::SystemTime, std::path::PathBuf)> = None;
    for entry in std::fs::read_dir(path).map_err(|e| anyhow!("Cannot read output dir: {}", e))? {
        let entry = entry?;
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if !media_exts.contains(&ext.as_str()) {
            continue;
        }
        if is_ytdlp_stream_fragment(&p) {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                let is_newer = best.as_ref().is_none_or(|(t, _)| modified > *t);
                if is_newer {
                    best = Some((modified, p));
                }
            }
        }
    }
    best.map(|(_, p)| p.to_string_lossy().to_string())
        .ok_or_else(|| {
            anyhow!(
                "No output file found in {}. The download may have failed silently.",
                dir
            )
        })
}
