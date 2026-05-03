from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    assert _client is not None, "DB not connected — call connect() first"
    return _client[settings.mongodb_db]


async def connect() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    await _client.admin.command("ping")
    print(f"[DB] Connected → {settings.mongodb_uri}")


async def disconnect() -> None:
    global _client
    if _client:
        _client.close()
        _client = None


async def create_indexes() -> None:
    db = get_db()
    # clips
    await db.clips.create_index([("created_at", -1)])
    await db.clips.create_index([("status", 1)])
    await db.clips.create_index([("format", 1), ("status", 1)])
    await db.clips.create_index([("youtube_id", 1)])
    await db.clips.create_index([("channel_id", 1), ("created_at", -1)])
    # channels
    await db.channels.create_index([("active", 1)])
    # yt_uploads
    await db.yt_uploads.create_index([("date", 1), ("format", 1)])
    print("[DB] Indexes ready.")
