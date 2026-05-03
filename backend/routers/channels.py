import asyncio
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_db
from ..models import ChannelCreate
from .. import scheduler

router = APIRouter(prefix="/api/channels", tags=["channels"])


def _out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.get("")
async def list_channels() -> list[dict]:
    db = get_db()
    docs = await db.channels.find().sort("created_at", -1).to_list(length=200)
    return [_out(d) for d in docs]


@router.post("", status_code=201)
async def create_channel(body: ChannelCreate) -> dict:
    db = get_db()
    doc = body.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.channels.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    await scheduler.sync_jobs()
    return doc


@router.patch("/{channel_id}")
async def update_channel(channel_id: str, body: ChannelCreate) -> dict:
    db = get_db()
    updated = await db.channels.find_one_and_update(
        {"_id": ObjectId(channel_id)},
        {"$set": body.model_dump(exclude_unset=True)},
        return_document=True,
    )
    if not updated:
        raise HTTPException(404, "Channel not found")
    await scheduler.sync_jobs()
    return _out(updated)


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(channel_id: str) -> None:
    db = get_db()
    result = await db.channels.delete_one({"_id": ObjectId(channel_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Channel not found")
    await scheduler.sync_jobs()


class RunRequest(BaseModel):
    video_url: Optional[str] = None


@router.post("/{channel_id}/run")
async def run_now(channel_id: str, body: RunRequest = RunRequest()) -> dict:
    """Trigger full pipeline for this channel immediately. Optionally process a specific video."""
    db = get_db()
    ch = await db.channels.find_one({"_id": ObjectId(channel_id)})
    if not ch:
        raise HTTPException(404, "Channel not found")

    app_cfg = await db.app_settings.find_one({"_id": "main"}) or {}

    async def _bg():
        await scheduler._run_channel(channel_id, ch["url"], ch, app_cfg, video_url=body.video_url)

    asyncio.create_task(_bg())
    return {"status": "started", "channel_id": channel_id, "video_url": body.video_url}
