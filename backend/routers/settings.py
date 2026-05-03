from fastapi import APIRouter

from ..database import get_db
from ..models import AppSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])

_SENSITIVE = {"openai_api_key", "youtube_client_secret", "youtube_refresh_token"}
_MASK = "••••••••"


@router.get("")
async def get_settings() -> dict:
    db = get_db()
    doc = (await db.app_settings.find_one({"_id": "main"})) or {}
    doc.pop("_id", None)
    for k in _SENSITIVE:
        if doc.get(k):
            doc[k] = _MASK
    return doc


@router.put("")
async def save_settings(body: AppSettings) -> dict:
    db = get_db()
    data = body.model_dump(exclude_none=True)

    # Preserve existing values when frontend sends back masked placeholder
    existing = (await db.app_settings.find_one({"_id": "main"})) or {}
    for k in _SENSITIVE:
        if data.get(k) == _MASK:
            if existing.get(k):
                data[k] = existing[k]
            else:
                data.pop(k, None)

    await db.app_settings.replace_one(
        {"_id": "main"},
        {"_id": "main", **data},
        upsert=True,
    )
    return {"status": "saved"}


@router.post("/test-youtube")
async def test_youtube() -> dict:
    from ..pipeline.uploader import test_credentials

    db = get_db()
    cfg = (await db.app_settings.find_one({"_id": "main"})) or {}

    client_id = cfg.get("youtube_client_id")
    client_secret = cfg.get("youtube_client_secret")
    refresh_token = cfg.get("youtube_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        return {"ok": False, "error": "Credenciais não configuradas"}

    ok = test_credentials(client_id, client_secret, refresh_token)
    return {"ok": ok, "error": None if ok else "Credenciais inválidas"}
