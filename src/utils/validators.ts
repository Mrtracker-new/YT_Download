/**
 * Client-side URL validator for supported platforms.
 * The Rust backend also validates — this is just for fast UX feedback.
 */

const SUPPORTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'vimeo.com',
  'www.vimeo.com',
  'soundcloud.com',
  'www.soundcloud.com',
  'twitter.com',
  'x.com',
  'www.twitter.com',
  'instagram.com',
  'www.instagram.com',
  'dailymotion.com',
  'www.dailymotion.com',
  'twitch.tv',
  'www.twitch.tv',
  'reddit.com',
  'www.reddit.com',
  'tiktok.com',
  'www.tiktok.com',
];

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return SUPPORTED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function isPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.searchParams.has('list');
  } catch {
    return false;
  }
}
