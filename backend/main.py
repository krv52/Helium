import json
import mimetypes
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from yt_dlp import YoutubeDL

try:
    from .url_utils import sanitize_media_url
except ImportError:
    from url_utils import sanitize_media_url

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOADS_DIR = Path("downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

WINDOWS_FORBIDDEN_CHARS = r'<>:"/\|?*'
ALLOWED_MODES = {"video", "audio", "thumbnail"}
ALLOWED_FILE_EXTENSIONS = {
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".flac",
    ".m4a",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}
VIDEO_FORMATS = {"mp4", "webm"}
AUDIO_FORMATS = {"mp3", "m4a"}
THUMBNAIL_FORMATS = {"jpg", "webp", "original"}
QUALITIES = {"best", "worst", "1080", "720", "480", "360"}

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


def codec_exists(value: str | None) -> bool:
    return bool(value and value != "none")


def media_capabilities(info: dict) -> tuple[bool, bool, list[str]]:
    formats = info.get("formats") or []
    has_video = any(codec_exists(item.get("vcodec")) for item in formats)
    has_audio = any(codec_exists(item.get("acodec")) for item in formats)

    if not formats:
        has_video = codec_exists(info.get("vcodec"))
        has_audio = codec_exists(info.get("acodec"))

    if has_video and has_audio:
        available_modes = ["video", "audio", "thumbnail"]
    elif has_audio:
        available_modes = ["audio", "thumbnail"]
    elif has_video:
        available_modes = ["video", "thumbnail"]
    else:
        available_modes = ["thumbnail"]

    return has_video, has_audio, available_modes


def format_ext_available(info: dict, requested_ext: str, media_type: str) -> bool:
    formats = info.get("formats") or []

    if not formats:
        return info.get("ext") == requested_ext

    if media_type == "video":
        return any(
            item.get("ext") == requested_ext and codec_exists(item.get("vcodec"))
            for item in formats
        )

    return any(
        item.get("ext") == requested_ext and codec_exists(item.get("acodec"))
        for item in formats
    )


def metadata_response(info: dict) -> dict:
    has_video, has_audio, available_modes = media_capabilities(info)
    formats = info.get("formats") or []
    available_formats = sorted(
        {
            item.get("ext")
            for item in formats
            if item.get("ext") and item.get("ext") != "unknown_video"
        }
    )
    audio_streams = [
        item.get("format_id")
        for item in formats
        if codec_exists(item.get("acodec")) and not codec_exists(item.get("vcodec"))
    ]
    subtitles = sorted((info.get("subtitles") or {}).keys())

    return {
        "extractor": info.get("extractor"),
        "webpage_url": info.get("webpage_url"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "title": info.get("title"),
        "has_video": has_video,
        "has_audio": has_audio,
        "available_modes": available_modes,
        "available_formats": available_formats,
        "container": info.get("ext"),
        "codec": info.get("vcodec") or info.get("acodec"),
        "resolution": info.get("resolution"),
        "fps": info.get("fps"),
        "filesize": info.get("filesize") or info.get("filesize_approx"),
        "bitrate": info.get("tbr") or info.get("abr") or info.get("vbr"),
        "uploader": info.get("uploader"),
        "upload_date": info.get("upload_date"),
        "audio_streams": audio_streams,
        "subtitles": subtitles,
    }


def run_ffprobe(file_path: Path) -> dict:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(file_path),
    ]

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail="ffprobe is not installed or not available in PATH.",
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            status_code=400,
            detail=exc.stderr.strip() or "ffprobe could not inspect this file.",
        ) from exc

    return json.loads(completed.stdout)


def create_video_thumbnail(file_path: Path, base_name: str) -> str | None:
    thumbnail_path = UPLOADS_DIR / f"{base_name}.jpg"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(file_path),
        "-ss",
        "00:00:01",
        "-frames:v",
        "1",
        str(thumbnail_path),
    ]

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None

    if thumbnail_path.exists():
        return f"/uploads/{thumbnail_path.name}"

    return None


def stream_codec_list(streams: list[dict], codec_type: str) -> list[str]:
    return sorted(
        {
            stream.get("codec_name")
            for stream in streams
            if stream.get("codec_type") == codec_type and stream.get("codec_name")
        }
    )


def local_file_metadata_response(file_path: Path, original_filename: str) -> dict:
    probe_data = run_ffprobe(file_path)
    streams = probe_data.get("streams") or []
    format_data = probe_data.get("format") or {}
    video_streams = [stream for stream in streams if stream.get("codec_type") == "video"]
    audio_streams = [stream for stream in streams if stream.get("codec_type") == "audio"]
    first_video = video_streams[0] if video_streams else {}
    first_audio = audio_streams[0] if audio_streams else {}
    suffix = file_path.suffix.lower()
    is_image = suffix in {".jpg", ".jpeg", ".png", ".webp"}
    has_video = bool(video_streams) and not is_image
    has_audio = bool(audio_streams)
    preview_type = "image" if is_image else "audio" if has_audio and not has_video else "video"
    thumbnail = f"/uploads/{file_path.name}" if is_image else None

    if has_video:
        thumbnail = create_video_thumbnail(file_path, file_path.stem)

    duration = float(format_data["duration"]) if format_data.get("duration") else None
    bitrate = (
        float(format_data["bit_rate"]) / 1000
        if format_data.get("bit_rate")
        else None
    )
    width = first_video.get("width")
    height = first_video.get("height")
    resolution = f"{width}x{height}" if width and height else None
    fps = None
    frame_rate = first_video.get("avg_frame_rate") or first_video.get("r_frame_rate")

    if frame_rate and frame_rate != "0/0":
        numerator, denominator = frame_rate.split("/")
        fps = round(float(numerator) / float(denominator), 2)

    codecs = stream_codec_list(streams, "video") + stream_codec_list(streams, "audio")

    return {
        "source_kind": "file",
        "title": original_filename,
        "filename": original_filename,
        "display_name": original_filename,
        "extractor": "Local file",
        "webpage_url": None,
        "local_path": f"uploads/{file_path.name}",
        "file_type": mimetypes.guess_type(original_filename)[0],
        "duration": duration,
        "thumbnail": thumbnail,
        "preview_type": preview_type,
        "has_video": has_video,
        "has_audio": has_audio,
        "available_modes": [],
        "available_formats": [suffix.lstrip(".").lower()] if suffix else [],
        "container": suffix.lstrip(".").lower() or format_data.get("format_name"),
        "streams": [stream.get("codec_type") for stream in streams if stream.get("codec_type")],
        "codec": ", ".join(codecs) if codecs else None,
        "codecs": codecs,
        "resolution": resolution,
        "fps": fps,
        "filesize": file_path.stat().st_size,
        "bitrate": bitrate,
        "uploader": None,
        "upload_date": None,
        "audio_streams": [
            stream.get("codec_name") or f"audio-{index + 1}"
            for index, stream in enumerate(audio_streams)
        ],
        "subtitles": [],
        "color_space": first_video.get("color_space"),
        "audio_channels": first_audio.get("channels"),
        "sample_rate": first_audio.get("sample_rate"),
    }


def safe_filename(title: str | None, max_length: int = 90) -> str:
    clean_title = title or "helium-download"
    translation = str.maketrans({char: "_" for char in WINDOWS_FORBIDDEN_CHARS})
    clean_title = clean_title.translate(translation)
    clean_title = re.sub(r"[\x00-\x1f]+", "", clean_title)
    clean_title = re.sub(r"\s+", " ", clean_title).strip(" .")

    if not clean_title:
        clean_title = "helium-download"

    return clean_title[:max_length].rstrip(" .")


def find_downloaded_file(base_name: str) -> Path:
    files = sorted(
        [path for path in DOWNLOADS_DIR.iterdir() if path.is_file() and path.stem == base_name],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )

    if not files:
        raise HTTPException(status_code=500, detail="Downloaded file was not found.")

    return files[0]


def video_format_selector(file_format: str, quality: str | None) -> str:
    if quality == "worst":
        return f"worst[ext={file_format}]"

    if quality and quality != "best":
        height_filter = f"[height<={quality}]"
    else:
        height_filter = ""

    if file_format == "webm":
        return (
            f"bestvideo{height_filter}[ext=webm]+bestaudio[ext=webm]/"
            f"best{height_filter}[ext=webm]"
        )

    return (
        f"bestvideo{height_filter}[ext=mp4]+bestaudio[ext=m4a]/"
        f"best{height_filter}[ext=mp4]"
    )


def download_with_ytdlp(url: str, ydl_options: dict, base_name: str) -> Path:
    try:
        with YoutubeDL(ydl_options) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"yt-dlp download failed: {exc}") from exc

    requested_downloads = info.get("requested_downloads") or []
    for item in requested_downloads:
        filepath = item.get("filepath")
        if filepath and Path(filepath).exists():
            return Path(filepath)

    filename = info.get("_filename")
    if filename and Path(filename).exists():
        return Path(filename)

    return find_downloaded_file(base_name)


def ensure_requested_extension(file_path: Path, requested_ext: str) -> None:
    actual_ext = file_path.suffix.lower().lstrip(".")

    if actual_ext != requested_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Requested {requested_ext} could not be produced for this URL.",
        )


def thumbnail_extension(thumbnail_url: str, content_type: str | None) -> str:
    url_path = urllib.parse.urlparse(thumbnail_url).path
    suffix = Path(url_path).suffix.lower().lstrip(".")

    if suffix in {"jpg", "jpeg", "png", "webp"}:
        return "jpg" if suffix == "jpeg" else suffix

    guessed_extension = mimetypes.guess_extension(content_type or "")
    if guessed_extension:
        return guessed_extension.lstrip(".").replace("jpeg", "jpg")

    return "jpg"


def select_thumbnail_url(info: dict, requested_format: str) -> str | None:
    thumbnails = info.get("thumbnails") or []

    if requested_format != "original":
        for thumbnail in reversed(thumbnails):
            if thumbnail.get("ext") == requested_format and thumbnail.get("url"):
                return thumbnail["url"]

    return info.get("thumbnail")


@app.get("/")
def root():
    return {"status": "Helium online"}


@app.get("/info")
def info(url: str):
    sanitized_url = sanitize_media_url(url)

    try:
        with YoutubeDL({"quiet": True}) as ydl:
            data = ydl.extract_info(sanitized_url, download=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read video info: {exc}") from exc

    return metadata_response(data)


@app.post("/file/info")
def file_info(file: UploadFile = File(...)):
    original_filename = Path(file.filename or "local-media").name
    suffix = Path(original_filename).suffix.lower() or ".bin"

    if suffix not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = UPLOADS_DIR / stored_name

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    return local_file_metadata_response(file_path, original_filename)


@app.post("/file/convert")
def file_convert():
    # TODO: Use ffmpeg to convert media, extract audio, and compress files.
    raise HTTPException(
        status_code=501,
        detail="Local file conversion is not implemented yet.",
    )


@app.get("/download")
def download(
    url: str,
    mode: str = "video",
    format: str | None = None,
    quality: str | None = None,
):
    url = sanitize_media_url(url)

    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode.")

    if quality and quality not in QUALITIES:
        raise HTTPException(status_code=400, detail="Invalid quality.")

    try:
        with YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
            metadata = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read video metadata: {exc}") from exc

    _, _, available_modes = media_capabilities(metadata)

    if mode not in available_modes:
        if mode == "video":
            raise HTTPException(status_code=400, detail="Video is not available for this URL.")
        if mode == "audio":
            raise HTTPException(status_code=400, detail="Audio is not available for this URL.")
        raise HTTPException(status_code=400, detail=f"{mode.title()} is not available for this URL.")

    base_name = safe_filename(metadata.get("title"))
    output_template = str(DOWNLOADS_DIR / f"{base_name}.%(ext)s")

    if mode == "video":
        file_format = format or "mp4"

        if file_format not in VIDEO_FORMATS:
            raise HTTPException(status_code=400, detail="Invalid video format.")

        if not format_ext_available(metadata, file_format, "video"):
            raise HTTPException(
                status_code=400,
                detail=f"Video format {file_format} is not available for this URL.",
            )

        ydl_options = {
            "format": video_format_selector(file_format, quality),
            "merge_output_format": file_format,
            "outtmpl": output_template,
            "quiet": True,
            "noplaylist": True,
        }
        file_path = download_with_ytdlp(url, ydl_options, base_name)
        ensure_requested_extension(file_path, file_format)
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/octet-stream",
        )

    if mode == "audio":
        file_format = format or "m4a"

        if file_format not in AUDIO_FORMATS:
            raise HTTPException(status_code=400, detail="Invalid audio format.")

        ydl_options = {
            "format": "bestaudio[ext=m4a]",
            "outtmpl": output_template,
            "quiet": True,
            "noplaylist": True,
        }

        if file_format == "m4a" and not format_ext_available(metadata, "m4a", "audio"):
            raise HTTPException(
                status_code=400,
                detail="Audio format m4a is not available for this URL.",
            )

        if file_format == "mp3":
            ydl_options["format"] = "bestaudio/best"
            ydl_options["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "0",
                }
            ]

        file_path = download_with_ytdlp(url, ydl_options, base_name)
        ensure_requested_extension(file_path, file_format)
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/octet-stream",
        )

    thumbnail_format = format or "original"

    if thumbnail_format not in THUMBNAIL_FORMATS:
        raise HTTPException(status_code=400, detail="Invalid thumbnail format.")

    thumbnail_url = select_thumbnail_url(metadata, thumbnail_format)

    if not thumbnail_url:
        raise HTTPException(status_code=404, detail="Thumbnail was not found.")

    try:
        request = urllib.request.Request(
            thumbnail_url,
            headers={"User-Agent": "Helium/1.0"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
            content_type = response.headers.get("Content-Type")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Thumbnail download failed: {exc}") from exc

    extension = (
        thumbnail_extension(thumbnail_url, content_type)
        if thumbnail_format == "original"
        else thumbnail_format
    )
    file_path = DOWNLOADS_DIR / f"{base_name}.{extension}"
    file_path.write_bytes(content)

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=content_type or "application/octet-stream",
    )
