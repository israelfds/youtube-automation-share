import shutil
from pathlib import Path
import yt_dlp


def _detect_js_runtime() -> str | None:
    """Return the first available JS runtime that yt-dlp can use."""
    for name in ("deno", "node", "bun"):
        if shutil.which(name):
            return name
    return None


# Shared base opts — ensures yt-dlp always finds a JS runtime
_JS_RUNTIME = _detect_js_runtime()
_YDL_BASE: dict = {}
if _JS_RUNTIME:
    _YDL_BASE["js_runtimes"] = {_JS_RUNTIME: {}}
    _YDL_BASE["remote_components"] = {"ejs:github": {}}


def fetch_channel_videos(channel_url: str, max_videos: int = 30) -> list[dict]:
    """Fetch recent video metadata from a YouTube channel (no download).
    If a single video URL is provided instead of a channel, returns that video.
    """
    ydl_opts = {
        **_YDL_BASE,
        "quiet": True,
        "extract_flat": True,
        "playlist_end": max_videos,
        "ignoreerrors": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False) or {}
        entries = info.get("entries") or []
        results = [
            {
                "id": e.get("id"),
                "url": f"https://www.youtube.com/watch?v={e.get('id')}",
                "title": e.get("title", ""),
                "duration": e.get("duration"),
            }
            for e in entries
            if e and e.get("id")
        ]

    # Fallback: URL is a single video, not a channel/playlist
    if not results and info.get("id"):
        results = [
            {
                "id": info["id"],
                "url": f"https://www.youtube.com/watch?v={info['id']}",
                "title": info.get("title", ""),
                "duration": info.get("duration"),
            }
        ]

    return results


def fetch_single_video(video_url: str) -> dict | None:
    """Fetch metadata for a single YouTube video URL."""
    ydl_opts = {**_YDL_BASE, "quiet": True, "extract_flat": True, "ignoreerrors": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False) or {}
    vid_id = info.get("id")
    if not vid_id:
        return None
    return {
        "id": vid_id,
        "url": f"https://www.youtube.com/watch?v={vid_id}",
        "title": info.get("title", video_url),
        "duration": info.get("duration"),
    }


def download_video(video_url: str, output_dir: str, video_id: str) -> str:
    """Download best quality video (≤1080p). Returns path to mp4 file."""
    output_tmpl = str(Path(output_dir) / f"{video_id}.%(ext)s")
    ydl_opts = {
        **_YDL_BASE,
        "format": (
            "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=1080]+bestaudio/best[height<=1080]"
        ),
        "outtmpl": output_tmpl,
        "quiet": True,
        "merge_output_format": "mp4",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

    matches = list(Path(output_dir).glob(f"{video_id}.*"))
    if not matches:
        raise FileNotFoundError(f"Downloaded file not found for {video_id}")
    return str(matches[0])


def fetch_transcript(video_url: str, languages: list[str] | None = None) -> list[dict] | None:
    """
    Fetch transcript from YouTube.
    Returns list of {"text", "start", "duration"} or None if unavailable.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        langs = languages or ["pt", "pt-BR", "pt-br", "en"]
        video_id = video_url.split("v=")[-1].split("&")[0]

        api = YouTubeTranscriptApi()
        result = api.fetch(video_id, languages=langs)
        return [
            {"text": s.text, "start": s.start, "duration": s.duration}
            for s in result.snippets
        ]
    except Exception:
        return None

