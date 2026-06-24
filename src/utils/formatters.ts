/**
 * Format seconds into human-readable duration string.
 * Examples: 65 → "1:05", 3661 → "1:01:01"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format download speed string.
 * Input: "2.5MiB/s" → "2.5 MB/s"
 */
export function formatSpeed(speed: string): string {
  if (!speed || speed === '0' || speed === 'Unknown' || speed === 'Complete') return '';
  return speed
    .replace('MiB/s', ' MB/s')
    .replace('KiB/s', ' KB/s')
    .replace('GiB/s', ' GB/s')
    .replace('B/s', ' B/s');
}

/**
 * Format file size in bytes to human-readable.
 * Examples: 1048576 → "1.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format a unix millisecond timestamp to a readable date.
 */
export function formatDate(ms: number): string {
  if (!ms) return '—';
  const date = new Date(ms);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate a string to a max length, appending "…" if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
