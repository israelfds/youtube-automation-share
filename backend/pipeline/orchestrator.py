import random
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from .downloader import fetch_channel_videos, fetch_single_video, download_video, fetch_transcript
from .transcriber import transcribe_audio, segments_to_text
from .analyzer import analyze_transcript, ClipCandidate
from .cutter import cut_clip, extract_audio, burn_subtitles
from .subtitler import words_to_ass, words_to_srt, entries_to_srt
from ..database import get_db
from ..storage import get_client
from ..config import settings
from .. import log_store as log


async def run_pipeline(
    channel_url: str,
    channel_id: str,
    formats: list[Literal["short", "long"]],
    max_clips: int,
    llm_provider: str,
    openai_api_key: Optional[str],
    openai_model: str,
    llamacpp_model_path: Optional[str],
    llamacpp_n_ctx: int,
    llamacpp_n_gpu_layers: int,
    custom_prompt: Optional[str],
    whisper_model: str,
    whisper_device_override: Optional[str],
    clip_min: int = 15,
    clip_max: int = 120,
    long_min: int = 300,
    long_max: int = 600,
    sample_videos: int = 5,
    video_url: Optional[str] = None,
) -> list[str]:
    """
    Full pipeline for one channel run.
    If video_url is provided, process only that video instead of sampling the channel.
    Returns list of MongoDB clip IDs saved.
    """
    db = get_db()

    # ── 1. Fetch video(s) ─────────────────────────────────────────────────────
    if video_url:
        log.info(f"Pipeline start → specific video: {video_url}")
        video = fetch_single_video(video_url)
        if not video:
            log.warning(f"Could not fetch video info for {video_url}")
            return []
        sample = [video]
    else:
        log.info(f"Pipeline start → {channel_url}")
        videos = fetch_channel_videos(channel_url, max_videos=30)
        if not videos:
            log.warning(f"No videos found for {channel_url}")
            return []
        sample = random.sample(videos, min(sample_videos, len(videos)))
        log.info(f"Sampled {len(sample)}/{len(videos)} videos")

    # ── 2. Transcript + LLM analysis ──────────────────────────────────────────
    # (ClipCandidate, video_dict, transcript_entries, fmt)
    all_candidates: list[tuple[ClipCandidate, dict, list[dict], str]] = []

    for video in sample:
        title_short = video["title"][:55]
        log.info(f"Analyzing: {title_short}")

        entries = fetch_transcript(video["url"])
        if not entries:
            log.warning(f"No transcript — skipping {video['id']}")
            continue

        transcript_text = segments_to_text(entries)

        try:
            if "short" in formats:
                shorts = await analyze_transcript(
                    transcript_text=transcript_text,
                    transcript_entries=entries,
                    llm_provider=llm_provider,
                    openai_api_key=openai_api_key,
                    openai_model=openai_model,
                    llamacpp_model_path=llamacpp_model_path,
                    llamacpp_n_ctx=llamacpp_n_ctx,
                    llamacpp_n_gpu_layers=llamacpp_n_gpu_layers,
                    custom_prompt=custom_prompt,
                    max_clips=max_clips,
                    min_duration=clip_min,
                    max_duration=clip_max,
                )
                log.info(f"Short candidates: {len(shorts)} from '{title_short}'")
                for c in shorts:
                    all_candidates.append((c, video, entries, "short"))

            if "long" in formats:
                longs = await analyze_transcript(
                    transcript_text=transcript_text,
                    transcript_entries=entries,
                    llm_provider=llm_provider,
                    openai_api_key=openai_api_key,
                    openai_model=openai_model,
                    llamacpp_model_path=llamacpp_model_path,
                    llamacpp_n_ctx=llamacpp_n_ctx,
                    llamacpp_n_gpu_layers=llamacpp_n_gpu_layers,
                    custom_prompt=custom_prompt,
                    max_clips=2,
                    min_duration=long_min,
                    max_duration=long_max,
                )
                log.info(f"Long candidates: {len(longs)} from '{title_short}'")
                for c in longs:
                    all_candidates.append((c, video, entries, "long"))

        except Exception as e:
            log.error(f"LLM error for {video['id']}: {e}")
            continue

    if not all_candidates:
        log.warning("No candidates after LLM analysis.")
        return []

    all_candidates.sort(key=lambda x: x[0].score, reverse=True)
    top = all_candidates[:max_clips]
    log.info(f"Rendering top {len(top)} clips")

    # ── 3. Download + render ───────────────────────────────────────────────────
    clip_ids = []

    with tempfile.TemporaryDirectory(prefix="autoyt_") as tmp_dir:
        tmp = Path(tmp_dir)
        video_files: dict[str, str] = {}

        for candidate, video, entries, fmt in top:
            vid_id = video["id"]

            if vid_id not in video_files:
                log.info(f"Downloading {vid_id} …")
                try:
                    video_files[vid_id] = download_video(video["url"], str(tmp), vid_id)
                except Exception as e:
                    log.error(f"Download failed {vid_id}: {e}")
                    continue

            src = video_files[vid_id]
            slug = f"{vid_id}_{int(candidate.start)}_{int(candidate.end)}"

            try:
                log.info(f"Cutting '{candidate.title[:45]}' ({fmt}, score={candidate.score:.0f})")

                audio_path = str(tmp / f"{slug}.wav")
                extract_audio(src, audio_path, candidate.start, candidate.end)

                words = None
                try:
                    words = transcribe_audio(
                        audio_path,
                        model_size=whisper_model,
                        device_override=whisper_device_override,
                    )
                    log.info(f"Whisper: {len(words)} words")
                except Exception as e:
                    log.warning(f"Whisper failed: {e} — using YT transcript fallback")

                raw_path = str(tmp / f"{slug}_raw.mp4")
                cut_clip(src, raw_path, candidate.start, candidate.end, fmt=fmt)

                sub_path = _generate_subtitle(
                    tmp, slug, fmt, words, entries, candidate.start, candidate.end
                )

                final_path = str(tmp / f"{slug}.mp4")
                if sub_path:
                    burn_subtitles(raw_path, sub_path, final_path)
                else:
                    log.warning(f"No subtitles for {slug}")
                    final_path = raw_path

                minio_key = f"clips/{slug}.mp4"
                s3 = get_client()
                s3.upload_file(
                    final_path,
                    settings.minio_bucket,
                    minio_key,
                    ExtraArgs={"ContentType": "video/mp4"},
                )
                log.info(f"Uploaded to MinIO: {minio_key}")

                doc = {
                    "channel_id": channel_id,
                    "channel_url": channel_url,
                    "minio_key": minio_key,
                    "title": candidate.title,
                    "source_title": video["title"],
                    "source_url": video["url"],
                    "score": candidate.score,
                    "duration": round(candidate.end - candidate.start, 2),
                    "format": fmt,
                    "youtube_id": None,
                    "status": "ready",
                    "created_at": datetime.now(timezone.utc),
                }
                result = await db.clips.insert_one(doc)
                clip_ids.append(str(result.inserted_id))
                log.info(f"Saved clip: '{candidate.title}'")

            except Exception as e:
                log.error(f"Render error {slug}: {e}")
                continue

    log.info(f"Pipeline done — {len(clip_ids)} clips saved for {channel_url}")
    return clip_ids


async def upload_pending(
    client_id: str,
    client_secret: str,
    refresh_token: str,
    tags: list[str],
    max_shorts: int = 9,
    max_longs: int = 1,
) -> list[str]:
    """Upload today's best unuploaded clips to YouTube. Returns list of YT video IDs."""
    from .uploader import upload_video

    db = get_db()
    s3 = get_client()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uploaded = []

    for fmt, limit in [("short", max_shorts), ("long", max_longs)]:
        already = await db.yt_uploads.count_documents({"date": today, "format": fmt})
        remaining = limit - already
        if remaining <= 0:
            log.info(f"Daily quota reached for {fmt} ({limit}/{limit})")
            continue

        cursor = (
            db.clips.find({"youtube_id": None, "status": "ready", "format": fmt})
            .sort("score", -1)
            .limit(remaining)
        )
        clips = await cursor.to_list(length=remaining)
        log.info(f"Uploading {len(clips)} {fmt} clip(s) to YouTube")

        for clip in clips:
            minio_key = clip["minio_key"]
            local_path = f"/tmp/{Path(minio_key).name}"

            try:
                await db.clips.update_one(
                    {"_id": clip["_id"]}, {"$set": {"status": "uploading"}}
                )
                s3.download_file(settings.minio_bucket, minio_key, local_path)

                vid_id = upload_video(
                    video_path=local_path,
                    title=clip["title"],
                    description=f"Clipe de: {clip['source_title']}\n{clip['source_url']}",
                    tags=tags,
                    client_id=client_id,
                    client_secret=client_secret,
                    refresh_token=refresh_token,
                    is_short=(fmt == "short"),
                )

                await db.clips.update_one(
                    {"_id": clip["_id"]},
                    {"$set": {"youtube_id": vid_id, "status": "published"}},
                )
                await db.yt_uploads.insert_one(
                    {
                        "date": today,
                        "format": fmt,
                        "youtube_id": vid_id,
                        "ts": datetime.now(timezone.utc),
                    }
                )
                uploaded.append(vid_id)
                log.info(f"Published: https://youtu.be/{vid_id} — '{clip['title']}'")

            except Exception as e:
                log.error(f"Upload error for clip {clip['_id']}: {e}")
                await db.clips.update_one(
                    {"_id": clip["_id"]},
                    {"$set": {"status": "error", "error": str(e)}},
                )
            finally:
                Path(local_path).unlink(missing_ok=True)

    log.info(f"Upload done — {len(uploaded)} video(s) published")
    return uploaded


async def cleanup_old_clips(ttl_days: int = 7) -> None:
    """Delete clips older than ttl_days that are not published on YouTube."""
    from datetime import timedelta

    db = get_db()
    s3 = get_client()
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)

    cursor = db.clips.find(
        {"created_at": {"$lt": cutoff}, "youtube_id": None}
    )
    stale = await cursor.to_list(length=500)

    deleted = 0
    for clip in stale:
        if clip.get("minio_key"):
            try:
                s3.delete_object(Bucket=settings.minio_bucket, Key=clip["minio_key"])
            except Exception:
                pass
        await db.clips.delete_one({"_id": clip["_id"]})
        deleted += 1

    if deleted:
        log.info(f"Cleanup: removed {deleted} stale clip(s) older than {ttl_days}d")


# ── helpers ───────────────────────────────────────────────────────────────────

def _generate_subtitle(
    tmp: Path,
    slug: str,
    fmt: str,
    words: list[dict] | None,
    entries: list[dict],
    start: float,
    end: float,
) -> str | None:
    if words:
        if fmt == "short":
            path = str(tmp / f"{slug}.ass")
            words_to_ass(words, path, fmt="short")
        else:
            path = str(tmp / f"{slug}.srt")
            words_to_srt(words, path)
        return path

    clipped = [
        {**e, "start": e["start"] - start}
        for e in entries
        if start <= e.get("start", 0) <= end
    ]
    if clipped:
        path = str(tmp / f"{slug}_fb.srt")
        entries_to_srt(clipped, path)
        return path

    return None
