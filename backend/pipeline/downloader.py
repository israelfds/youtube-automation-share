from pathlib import Path
import yt_dlp


def fetch_channel_videos(channel_url: str, max_videos: int = 30) -> list[dict]:
    """Fetch recent video metadata from a YouTube channel (no download)."""
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "playlist_end": max_videos,
        "ignoreerrors": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False) or {}
        entries = info.get("entries") or []
        return [
            {
                "id": e.get("id"),
                "url": f"https://www.youtube.com/watch?v={e.get('id')}",
                "title": e.get("title", ""),
                "duration": e.get("duration"),
            }
            for e in entries
            if e and e.get("id")
        ]


def download_video(video_url: str, output_dir: str, video_id: str) -> str:
    """Download best quality video (≤1080p). Returns path to mp4 file."""
    output_tmpl = str(Path(output_dir) / f"{video_id}.%(ext)s")
    ydl_opts = {
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
        return YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
    except Exception:
        return None
