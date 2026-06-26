// Video information returned by yt-dlp --dump-json
export interface VideoInfo {
  videoId: string;
  title: string;
  uploader: string;
  duration: number; // seconds
  thumbnail: string;
  description: string;
  formats: VideoFormat[];
  availableQualities: string[]; // e.g. ['2160p', '1080p', '720p', '480p']
  subtitles: Record<string, SubtitleTrack[]>;
  automaticCaptions: Record<string, SubtitleTrack[]>;
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  quality: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  height?: number;
  width?: number;
  tbr?: number; // total bitrate
}

export interface SubtitleTrack {
  ext: string;
  url?: string;
  name?: string;
}

export interface SubtitleOptions {
  enabled: boolean;
  language: string; // BCP-47 code, e.g. 'en', 'hi', or 'all'
  mode: 'embed' | 'sidecar';
  includeAuto: boolean;
}

// Playlist item from yt-dlp --flat-playlist
export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  uploader: string;
  thumbnail?: string;
  entryCount: number;
  entries: PlaylistItem[];
}
