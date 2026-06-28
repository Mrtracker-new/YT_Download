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

/// Validates a yt-dlp output filename template cannot escape the output directory.
///
/// The template is concatenated after `{output_dir}/` into a single `-o` argument,
/// so shell/flag injection is not possible (no shell, single argv element). The real
/// risk is path traversal: a template like `..\..\Windows\System32\x.%(ext)s` makes
/// yt-dlp resolve the relative components and write outside the validated output dir.
///
/// Allows literal text, `%(field)s` fields, and `/` or `\` subdirectory separators.
/// Rejects `..` components and absolute paths (leading separator or `X:` drive prefix).
pub fn validate_filename_template(template: &str) -> Result<()> {
    if template.trim().is_empty() {
        return Err(anyhow!("Filename template cannot be empty"));
    }

    // Reject absolute paths: leading separator, or Windows drive prefix like `C:`.
    let bytes = template.as_bytes();
    if matches!(bytes.first(), Some(b'/') | Some(b'\\')) {
        return Err(anyhow!("Filename template must be relative"));
    }
    if template.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        return Err(anyhow!("Filename template must not contain a drive prefix"));
    }

    // Reject any `..` path component (escapes the output directory).
    for component in template.split(['/', '\\']) {
        if component == ".." {
            return Err(anyhow!("Filename template must not contain '..'"));
        }
    }

    Ok(())
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
