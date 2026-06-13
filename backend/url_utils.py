from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}

YOUTUBE_PLAYLIST_PARAMS = {
    "list",
    "start_radio",
    "index",
    "pp",
    "si",
}


def sanitize_media_url(url: str) -> str:
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower()

    if host not in YOUTUBE_HOSTS:
        return url.strip()

    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in YOUTUBE_PLAYLIST_PARAMS
    ]

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query, doseq=True),
            parsed.fragment,
        )
    )
