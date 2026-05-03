from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from zoneinfo import ZoneInfo

from . import log_store as log

_scheduler: AsyncIOScheduler | None = None
_TZ = ZoneInfo("America/Sao_Paulo")


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone=_TZ)
    return _scheduler


async def start() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        log.info("Scheduler started.")
        await sync_jobs()


async def stop() -> None:
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
        log.info("Scheduler stopped.")


async def sync_jobs() -> None:
    """Rebuild APScheduler jobs from MongoDB channels + add system jobs."""
    sched = get_scheduler()
    from .database import get_db

    db = get_db()

    # Drop all dynamic jobs
    for job in sched.get_jobs():
        if job.id.startswith(("channel:", "upload:", "cleanup")):
            job.remove()

    channels = await db.channels.find({"active": True}).to_list(length=200)
    app_cfg = await _load_app_settings(db)

    for ch in channels:
        ch_id = str(ch["_id"])

        sched.add_job(
            _run_channel,
            CronTrigger(hour=ch.get("job_hour", 12), minute=ch.get("job_minute", 0), timezone=_TZ),
            id=f"channel:{ch_id}",
            replace_existing=True,
            args=[ch_id, ch["url"], ch, app_cfg],
        )

        sched.add_job(
            _run_upload,
            CronTrigger(hour=ch.get("upload_hour", 14), minute=ch.get("upload_minute", 0), timezone=_TZ),
            id=f"upload:{ch_id}",
            replace_existing=True,
            args=[app_cfg],
        )

    # Daily cleanup at 03:00 SP
    sched.add_job(
        _run_cleanup,
        CronTrigger(hour=3, minute=0, timezone=_TZ),
        id="cleanup:daily",
        replace_existing=True,
        args=[app_cfg],
    )

    log.info(f"Scheduler synced — {len(channels)} channel(s), cleanup job registered.")


async def _run_channel(ch_id: str, ch_url: str, ch: dict, app_cfg: dict) -> None:
    # Re-load settings at run time so changes take effect without restart
    from .database import get_db
    db = get_db()
    app_cfg = await _load_app_settings(db)

    from .pipeline.orchestrator import run_pipeline
    await run_pipeline(
        channel_url=ch_url,
        channel_id=ch_id,
        formats=ch.get("formats", ["short"]),
        max_clips=ch.get("max_clips", 6),
        llm_provider=app_cfg.get("llm_provider", "openai"),
        openai_api_key=app_cfg.get("openai_api_key"),
        openai_model=app_cfg.get("openai_model", "gpt-4o-mini"),
        llamacpp_model_path=app_cfg.get("llamacpp_model_path"),
        llamacpp_n_ctx=app_cfg.get("llamacpp_n_ctx", 4096),
        llamacpp_n_gpu_layers=app_cfg.get("llamacpp_n_gpu_layers", -1),
        custom_prompt=app_cfg.get("llm_prompt"),
        whisper_model=app_cfg.get("whisper_model", "base"),
        whisper_device_override=app_cfg.get("whisper_device_override"),
        clip_min=app_cfg.get("clip_min_duration", 15),
        clip_max=app_cfg.get("clip_max_duration", 120),
        long_min=app_cfg.get("long_clip_min_duration", 300),
        long_max=app_cfg.get("long_clip_max_duration", 600),
    )


async def _run_upload(app_cfg: dict) -> None:
    from .database import get_db
    db = get_db()
    app_cfg = await _load_app_settings(db)

    yt_id = app_cfg.get("youtube_client_id")
    yt_secret = app_cfg.get("youtube_client_secret")
    yt_token = app_cfg.get("youtube_refresh_token")

    if not all([yt_id, yt_secret, yt_token]):
        log.warning("YouTube credentials not configured — skipping upload job.")
        return

    from .pipeline.orchestrator import upload_pending
    await upload_pending(
        client_id=yt_id,
        client_secret=yt_secret,
        refresh_token=yt_token,
        tags=["podcast", "clips", "shorts"],
        max_shorts=app_cfg.get("daily_short_uploads", 9),
        max_longs=app_cfg.get("daily_long_uploads", 1),
    )


async def _run_cleanup(app_cfg: dict) -> None:
    from .database import get_db
    db = get_db()
    app_cfg = await _load_app_settings(db)
    ttl = int(app_cfg.get("clip_ttl_days", 7))

    from .pipeline.orchestrator import cleanup_old_clips
    await cleanup_old_clips(ttl_days=ttl)


async def _load_app_settings(db) -> dict:
    doc = await db.app_settings.find_one({"_id": "main"})
    return doc or {}
