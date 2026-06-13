# Helium

> Helium is a lightweight media toolkit combining yt-dlp, ffprobe and FFmpeg in a modern web interface.

## Features

- Download video from supported websites
- Download audio
- Download thumbnails
- Analyze media URLs
- Analyze local media files
- View detailed metadata
- Advanced technical information
- Modern dark UI

## Supported Platforms

Thanks to yt-dlp support, Helium can work with:

- YouTube
- SoundCloud
- TikTok
- Vimeo
- Twitch

and many more.

## Tech Stack

Frontend:

- React
- Vite

Backend:

- FastAPI
- yt-dlp
- FFmpeg
- ffprobe

## Installation

Requirements:

- Python 3.11+
- Node.js 20+
- FFmpeg
- ffprobe

Install dependencies:

```bash
pip install -r requirements.txt

cd frontend
npm install
```

## Running Helium

Recommended:

```bash
start.bat
```

Manual startup:

Backend:

```bash
py -m uvicorn backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

## Development

Backend:

```bash
py -m uvicorn backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Roadmap

Planned:

- Local file conversion
- Batch processing
- Download queue
- Advanced conversion options

## License

MIT
