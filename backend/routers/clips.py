from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import settings
from ..database import get_db
from ..storage import get_client

router = APIRouter(prefix="/api/clips", tags=["clips"])


def _out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.get("")
async def list_clips(
    format: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    days: int = Query(7),
    limit: int = Query(50),
) -> list[dict]:
    db = get_db()
    query: dict = {}

    if format:
        query["format"] = format
    if status:
        query["status"] = status
    if days:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query["created_at"] = {"$gte": since}

    docs = await (
        db.clips.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    )
    return [_out(d) for d in docs]


@router.get("/stats")
async def clip_stats() -> dict:
    db = get_db()
    today = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total = await db.clips.count_documents({})
    today_clips = await db.clips.count_documents({"created_at": {"$gte": today}})
    published = await db.clips.count_documents({"status": "published"})
    yt_shorts = await db.yt_uploads.count_documents(
        {"date": today_str, "format": "short"}
    )
    yt_longs = await db.yt_uploads.count_documents(
        {"date": today_str, "format": "long"}
    )

    return {
        "total": total,
        "today": today_clips,
        "published": published,
        "yt_shorts_today": yt_shorts,
        "yt_longs_today": yt_longs,
    }


@router.delete("/{clip_id}", status_code=204)
async def delete_clip(clip_id: str) -> None:
    db = get_db()
    doc = await db.clips.find_one({"_id": ObjectId(clip_id)})
    if not doc:
        return

    if doc.get("minio_key"):
        try:
            get_client().delete_object(
                Bucket=settings.minio_bucket, Key=doc["minio_key"]
            )
        except Exception:
            pass

    await db.clips.delete_one({"_id": ObjectId(clip_id)})


@router.get("/{clip_id}/stream")
async def stream_clip(clip_id: str):
    """Proxy video bytes from MinIO for in-browser preview."""
    db = get_db()
    doc = await db.clips.find_one({"_id": ObjectId(clip_id)})
    if not doc or not doc.get("minio_key"):
        raise HTTPException(404, "Clip not found")

    s3 = get_client()
    obj = s3.get_object(Bucket=settings.minio_bucket, Key=doc["minio_key"])

    return StreamingResponse(
        obj["Body"].iter_chunks(chunk_size=256 * 1024),
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )
