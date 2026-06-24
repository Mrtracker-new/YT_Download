use regex::Regex;
use once_cell::sync::Lazy;

/// Parsed progress data from a single yt-dlp output line.
#[derive(Debug, Clone)]
pub struct ProgressUpdate {
    pub progress: f64,     // 0.0–100.0
    pub speed: String,     // e.g. "2.5MiB/s"
    pub eta: String,       // e.g. "00:30"
    pub total_size: String, // e.g. "123.4MiB"
    pub status: ProcessingStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProcessingStatus {
    Downloading,
    Merging,
    Converting,
    Finalizing,
    Complete,
}

impl ProcessingStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Downloading => "downloading",
            Self::Merging => "merging",
            Self::Converting => "converting",
            Self::Finalizing => "finalizing",
            Self::Complete => "completed",
        }
    }
}

// Pre-compiled regexes for performance
static PROGRESS_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[download\]\s+(\d+\.?\d*)%\s+of\s+~?([\d\.]+\w+)\s+at\s+([\d\.]+\w+/s)\s+ETA\s+([\d:]+)").unwrap()
});

static PROGRESS_SIMPLE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[download\]\s+(\d+\.?\d*)%").unwrap()
});

static SPEED_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"at\s+([\d\.]+\s*[KMG]?iB/s)").unwrap()
});

static ETA_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"ETA\s+(\d+:\d+(?::\d+)?)").unwrap()
});

static SIZE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"of\s+~?([\d\.]+\s*[KMG]?iB)").unwrap()
});

/// Parse a yt-dlp output line and return a ProgressUpdate if it contains progress info.
pub fn parse_progress_line(line: &str) -> Option<ProgressUpdate> {
    // Detect processing stages
    if line.contains("[Merger]") || line.contains("[MKVMerge]") {
        return Some(ProgressUpdate {
            progress: 99.0,
            speed: String::new(),
            eta: "00:00".to_string(),
            total_size: String::new(),
            status: ProcessingStatus::Merging,
        });
    }

    if line.contains("[ExtractAudio]") || line.contains("[ffmpeg]") && line.contains("audio") {
        return Some(ProgressUpdate {
            progress: 99.0,
            speed: String::new(),
            eta: "00:00".to_string(),
            total_size: String::new(),
            status: ProcessingStatus::Converting,
        });
    }

    if line.contains("[FixupM3u8]") || line.contains("[FixupDuration]") || line.contains("[EmbedSubtitle]") {
        return Some(ProgressUpdate {
            progress: 99.5,
            speed: String::new(),
            eta: "00:00".to_string(),
            total_size: String::new(),
            status: ProcessingStatus::Finalizing,
        });
    }

    // Parse download progress line
    if !line.contains("[download]") {
        return None;
    }

    // Try full regex first
    if let Some(caps) = PROGRESS_REGEX.captures(line) {
        let progress: f64 = caps[1].parse().unwrap_or(0.0);
        let total_size = caps[2].to_string();
        let speed = caps[3].to_string();
        let eta = caps[4].to_string();
        return Some(ProgressUpdate {
            progress,
            speed,
            eta,
            total_size,
            status: ProcessingStatus::Downloading,
        });
    }

    // Fallback: just extract percentage
    if let Some(caps) = PROGRESS_SIMPLE_REGEX.captures(line) {
        let progress: f64 = caps[1].parse().unwrap_or(0.0);
        let speed = SPEED_REGEX.captures(line)
            .map(|c| c[1].to_string())
            .unwrap_or_default();
        let eta = ETA_REGEX.captures(line)
            .map(|c| c[1].to_string())
            .unwrap_or_default();
        let total_size = SIZE_REGEX.captures(line)
            .map(|c| c[1].to_string())
            .unwrap_or_default();

        return Some(ProgressUpdate {
            progress,
            speed,
            eta,
            total_size,
            status: ProcessingStatus::Downloading,
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_download_progress() {
        let line = "[download]  45.3% of 123.4MiB at 2.50MiB/s ETA 00:30";
        let update = parse_progress_line(line).unwrap();
        assert!((update.progress - 45.3).abs() < 0.01);
        assert_eq!(update.status, ProcessingStatus::Downloading);
    }

    #[test]
    fn test_parse_merger() {
        let line = "[Merger] Merging formats into \"video.mp4\"";
        let update = parse_progress_line(line).unwrap();
        assert_eq!(update.status, ProcessingStatus::Merging);
    }

    #[test]
    fn test_parse_extract_audio() {
        let line = "[ExtractAudio] Destination: audio.mp3";
        let update = parse_progress_line(line).unwrap();
        assert_eq!(update.status, ProcessingStatus::Converting);
    }
}
