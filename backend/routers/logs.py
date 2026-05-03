import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..log_store import get_recent, subscribe, unsubscribe

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def get_logs() -> list[dict]:
    return get_recent()


@router.get("/stream")
async def stream_logs():
    """Server-Sent Events stream of log entries."""
    queue = subscribe()

    async def gen():
        # Replay last 50 buffered entries
        for entry in get_recent()[-50:]:
            yield f"data: {json.dumps(entry)}\n\n"

        try:
            while True:
                try:
                    entry = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(entry)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
