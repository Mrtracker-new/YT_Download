export type ThemeMode = 'dark' | 'light' | 'system';
export type CookieBrowser = 'none' | 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera' | 'safari';

export interface AppSettings {
  // Directories
  downloadDir: string;        // default: ~/Downloads

  // Download behavior
  maxConcurrentDownloads: number;   // 1–5, default: 2
  fileNameTemplate: string;          // yt-dlp template, default: '%(title)s.%(ext)s'

  // Binary paths (empty = auto-resolve)
  ytdlpPath: string;
  ffmpegPath: string;

  // UI preferences
  theme: ThemeMode;

  // Notifications
  showNotifications: boolean;

  // Advanced
  autoUpdateBinaries: boolean;
  keepHistory: boolean;
  historyRetentionDays: number; // 0 = forever

  // Cookie browser for sites requiring login (instagram, twitter/X)
  cookieBrowser: CookieBrowser;

  // Optional cookies.txt file path. Takes precedence over cookieBrowser.
  // Bulletproof fallback when browser cookie extraction fails (Windows Chrome/Edge).
  cookieFile: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  downloadDir: '',          // resolved at runtime to ~/Downloads
  maxConcurrentDownloads: 2,
  fileNameTemplate: '%(title)s.%(ext)s',
  ytdlpPath: '',
  ffmpegPath: '',
  theme: 'dark',
  showNotifications: true,
  autoUpdateBinaries: false,
  keepHistory: true,
  historyRetentionDays: 30,
  cookieBrowser: 'none',
  cookieFile: '',
};

export interface BinaryInfo {
  name: string;
  path: string | null;
  version: string | null;
  found: boolean;
}

export interface BinaryStatus {
  ytdlp: BinaryInfo;
  ffmpeg: BinaryInfo;
}
