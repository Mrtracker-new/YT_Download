use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};

/// Validates a file path is within an allowed root directory.
/// Prevents path traversal attacks.
pub fn validate_path(path: &str, allowed_root: &str) -> Result<PathBuf> {
    let path = Path::new(path);
    let root = Path::new(allowed_root);

    // Canonicalize to resolve any .. components
    let canonical_path = path
        .canonicalize()
        .map_err(|e| anyhow!("Cannot resolve path: {}", e))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| anyhow!("Cannot resolve root: {}", e))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err(anyhow!("Path traversal detected: access denied"));
    }

    Ok(canonical_path)
}

/// Validates a download job ID is a valid UUID v4.
/// Prevents injection via job ID.
pub fn validate_job_id(job_id: &str) -> Result<()> {
    if job_id.is_empty() || job_id.len() > 36 {
        return Err(anyhow!("Invalid job ID length"));
    }
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    if !job_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err(anyhow!("Job ID contains invalid characters"));
    }
    Ok(())
}

/// Creates a safe filename by removing path traversal components and dangerous characters.
pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|&c| {
            c != '/'
                && c != '\\'
                && c != ':'
                && c != '*'
                && c != '?'
                && c != '"'
                && c != '<'
                && c != '>'
                && c != '|'
                && c != '\0'
        })
        .collect::<String>()
        .trim()
        .to_string()
        .chars()
        .take(200)
        .collect()
}
