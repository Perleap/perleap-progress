/** Parsed YouTube video reference */
export interface ParsedYoutubeUrl {
  videoId: string;
  /** Canonical watch URL for storage */
  watchUrl: string;
}

const YOUTUBE_HOST_RE = /^(?:www\.|m\.)?youtube\.com$|^youtu\.be$/i;

function extractVideoId(hostname: string, pathname: string, search: string): string | null {
  if (/^youtu\.be$/i.test(hostname)) {
    const id = pathname.replace(/^\//, '').split('/')[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  if (pathname === '/watch' || pathname.startsWith('/watch/')) {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const id = params.get('v');
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  const embedMatch = pathname.match(/^\/embed\/([\w-]{11})/);
  if (embedMatch) return embedMatch[1];

  const shortsMatch = pathname.match(/^\/shorts\/([\w-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

/** Parse a YouTube URL into video id and normalized watch URL. */
export function parseYoutubeUrl(input: string): ParsedYoutubeUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (!YOUTUBE_HOST_RE.test(url.hostname)) return null;

  const videoId = extractVideoId(url.hostname, url.pathname, url.search);
  if (!videoId) return null;

  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/** Privacy-enhanced embed URL for iframe playback */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function isYoutubeUrl(input: string): boolean {
  return parseYoutubeUrl(input) !== null;
}
