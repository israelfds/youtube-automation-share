import subprocess
from pathlib import Path
from typing import Literal


def cut_clip(
    source_path: str,
    output_path: str,
    start: float,
    end: float,
    fmt: Literal["short", "long"] = "short",
) -> str:
    """Cut and reformat clip. short=9:16 crop, long=16:9 scale."""
    duration = end - start

    if fmt == "short":
        vf = (
            "crop=ih*9/16:ih,"
            "scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black"
        )
    else:
        vf = (
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black"
        )

    _ffmpeg([
        "-ss", str(start),
        "-i", source_path,
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ])
    return output_path


def extract_audio(
    source_path: str,
    output_path: str,
    start: float,
    end: float,
) -> str:
    """Extract audio segment as 16kHz mono WAV (Whisper input)."""
    _ffmpeg([
        "-ss", str(start),
        "-i", source_path,
        "-t", str(end - start),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_path,
    ])
    return output_path


def burn_subtitles(
    video_path: str,
    subtitle_path: str,
    output_path: str,
) -> str:
    """Burn ASS or SRT subtitles into video."""
    ext = Path(subtitle_path).suffix.lower()
    vf = f"ass={subtitle_path}" if ext == ".ass" else f"subtitles={subtitle_path}"

    _ffmpeg([
        "-i", video_path,
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        output_path,
    ])
    return output_path


def _ffmpeg(args: list[str]) -> None:
    cmd = ["ffmpeg", "-y"] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg error:\n{result.stderr[-600:]}")
