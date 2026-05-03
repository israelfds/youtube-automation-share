import asyncio
from collections import deque
from datetime import datetime, timezone

_buffer: deque = deque(maxlen=500)
_subscribers: list[asyncio.Queue] = []


def _emit(level: str, message: str) -> None:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
    }
    _buffer.append(entry)
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(entry)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _unsubscribe(q)


def info(msg: str) -> None:
    print(f"[INFO] {msg}")
    _emit("INFO", msg)


def warning(msg: str) -> None:
    print(f"[WARN] {msg}")
    _emit("WARNING", msg)


def error(msg: str) -> None:
    print(f"[ERROR] {msg}")
    _emit("ERROR", msg)


def get_recent() -> list[dict]:
    return list(_buffer)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.append(q)
    return q


def _unsubscribe(q: asyncio.Queue) -> None:
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


# alias for external callers
unsubscribe = _unsubscribe
