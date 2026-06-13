const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const youtubePlaylistParams = ['list', 'start_radio', 'index', 'pp', 'si'];

export function sanitizeMediaUrl(rawUrl) {
  const trimmedUrl = rawUrl.trim();

  try {
    const url = new URL(trimmedUrl);

    if (!youtubeHosts.has(url.hostname.toLowerCase())) {
      return trimmedUrl;
    }

    youtubePlaylistParams.forEach((param) => url.searchParams.delete(param));
    return url.toString();
  } catch {
    return trimmedUrl;
  }
}
