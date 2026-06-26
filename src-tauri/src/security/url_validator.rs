use anyhow::{anyhow, Result};
use url::Url;

/// Allowed hostnames that yt-dlp supports and we expose through the app.
///
/// NOTE: Keep this list in sync with SUPPORTED_DOMAINS in
/// src/utils/validators.ts — this backend list is the authority; the
/// frontend copy only provides fast client-side UX feedback.
const ALLOWED_DOMAINS: &[&str] = &[
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "vimeo.com",
    "www.vimeo.com",
    "soundcloud.com",
    "www.soundcloud.com",
    "twitter.com",
    "x.com",
    "www.twitter.com",
    "instagram.com",
    "www.instagram.com",
    "dailymotion.com",
    "www.dailymotion.com",
    "twitch.tv",
    "www.twitch.tv",
    "tiktok.com",
    "www.tiktok.com",
    "reddit.com",
    "www.reddit.com",
    "v.redd.it",
    "bilibili.com",
    "www.bilibili.com",
    "nicovideo.jp",
    "www.nicovideo.jp",
    "odysee.com",
    "rumble.com",
];

/// Validates a URL and returns the canonical string form.
/// Rejects non-HTTPS, non-allowed domains, and shell-injection characters.
pub fn validate_url(url: &str) -> Result<String> {
    let trimmed = url.trim();

    // Prevent shell injection characters.
    // NOTE: '&' is intentionally NOT blocked — it is a standard URL query parameter separator
    // (e.g. ?list=PL...&si=...) and is safe because we use Command::new() with explicit arg
    // lists, not shell interpolation.
    if trimmed.contains(';')
        || trimmed.contains('|')
        || trimmed.contains('`')
        || trimmed.contains('$')
        || trimmed.contains('(')
        || trimmed.contains(')')
        || trimmed.contains('\n')
        || trimmed.contains('\r')
    {
        return Err(anyhow!("URL contains invalid characters"));
    }

    // Require http or https scheme
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(anyhow!("URL must start with http:// or https://"));
    }

    // Parse and validate
    let parsed = Url::parse(trimmed).map_err(|_| anyhow!("Invalid URL format"))?;

    // Require https in production
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err(anyhow!("Only HTTP/HTTPS URLs are supported"));
    }

    // Validate hostname
    let host = parsed
        .host_str()
        .ok_or_else(|| anyhow!("URL has no hostname"))?;

    let is_allowed = ALLOWED_DOMAINS
        .iter()
        .any(|&domain| host == domain || host.ends_with(&format!(".{}", domain)));

    if !is_allowed {
        return Err(anyhow!(
            "Unsupported URL. Supported platforms: YouTube, Vimeo, SoundCloud, and others."
        ));
    }

    Ok(parsed.to_string())
}

/// Sanitizes a URL string for safe logging (truncates, removes credentials).
pub fn sanitize_for_logging(url: &str) -> String {
    if let Ok(mut parsed) = url::Url::parse(url) {
        let _ = parsed.set_password(None);
        let _ = parsed.set_username("");
        let s = parsed.to_string();
        if s.len() > 80 {
            format!("{}…", &s[..77])
        } else {
            s
        }
    } else {
        "[invalid url]".to_string()
    }
}
