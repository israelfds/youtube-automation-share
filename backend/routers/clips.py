import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import settings
from ..database import get_db
from ..storage import get_client
from ..pipeline.uploader import upload_video

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


@router.post("/{clip_id}/upload")
async def manual_upload(clip_id: str) -> dict:
    db = get_db()
    doc = await db.clips.find_one({"_id": ObjectId(clip_id)})
    if not doc:
        raise HTTPException(404, "Clip not found")

    if doc.get("status") == "published":
        raise HTTPException(400, "Clip already published")

    cfg = (await db.app_settings.find_one({"_id": "main"})) or {}
    client_id = cfg.get("youtube_client_id")
    client_secret = cfg.get("youtube_client_secret")
    refresh_token = cfg.get("youtube_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        raise HTTPException(400, "Credenciais do YouTube não configuradas")

    s3 = get_client()
    minio_key = doc.get("minio_key")
    if not minio_key:
        raise HTTPException(404, "Arquivo de vídeo não encontrado no MinIO")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_file = os.path.join(tmp_dir, "upload.mp4")
        try:
            s3.download_file(settings.minio_bucket, minio_key, tmp_file)
        except Exception as e:
            raise HTTPException(500, f"Erro ao baixar do MinIO: {e}")

        try:
            yt_id = upload_video(
                video_path=tmp_file,
                title=doc.get("title", "Clip").replace('"', ''),
                description=doc.get("description", "Cortado com AutoYT"),
                tags=["podcast", "cortes", "viral"],
                client_id=client_id,
                client_secret=client_secret,
                refresh_token=refresh_token,
                is_short=(doc.get("format") == "short"),
                privacy="public"
            )
        except Exception as e:
            raise HTTPException(500, f"Erro no YouTube: {e}")

    await db.clips.update_one(
        {"_id": ObjectId(clip_id)},
        {"$set": {"status": "published", "yt_id": yt_id}}
    )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.yt_uploads.insert_one({
        "date": today_str,
        "format": doc.get("format", "short"),
        "clip_id": clip_id,
        "yt_id": yt_id,
        "channel_id": doc.get("channel_id")
    })

    return {"ok": True, "yt_id": yt_id}


@router.post("/{clip_id}/thumbnail")
async def generate_thumbnail(clip_id: str) -> dict:
    from openai import AsyncOpenAI
    import httpx

    db = get_db()
    doc = await db.clips.find_one({"_id": ObjectId(clip_id)})
    if not doc:
        raise HTTPException(404, "Clip not found")

    cfg = (await db.app_settings.find_one({"_id": "main"})) or {}
    api_key = cfg.get("openai_api_key")
    if not api_key:
        raise HTTPException(400, "OpenAI API Key não configurada")

    client = AsyncOpenAI(api_key=api_key)
    title = doc.get("title", "")
    desc = doc.get("description", "")
    
    prompt = f"Crie uma thumbnail atrativa estilo YouTube para um vídeo sobre: {title}. Estilo vibrante, cores contrastantes, sem texto longo, visual impactante."

    try:
        resp = await client.images.generate(
            model="dall-e-3",
            prompt=prompt[:1000],
            size="1024x1024" if doc.get("format") == "long" else "1024x1792",
            quality="standard",
            n=1,
        )
        img_url = resp.data[0].url
    except Exception as e:
        raise HTTPException(500, f"Erro na OpenAI: {e}")

    # Download image
    try:
        async with httpx.AsyncClient() as hc:
            img_res = await hc.get(img_url)
            img_res.raise_for_status()
            img_bytes = img_res.content
    except Exception as e:
        raise HTTPException(500, f"Erro ao baixar imagem gerada: {e}")

    # Save to MinIO
    minio_key = f"thumbnails/{clip_id}.png"
    s3 = get_client()
    try:
        s3.put_object(
            Bucket=settings.minio_bucket,
            Key=minio_key,
            Body=img_bytes,
            ContentType="image/png"
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao salvar no MinIO: {e}")

    await db.clips.update_one(
        {"_id": ObjectId(clip_id)},
        {"$set": {"thumbnail_key": minio_key}}
    )

    return {"ok": True, "thumbnail_key": minio_key}


@router.get("/{clip_id}/thumbnail_image")
async def get_thumbnail_image(clip_id: str):
    db = get_db()
    doc = await db.clips.find_one({"_id": ObjectId(clip_id)})
    if not doc or not doc.get("thumbnail_key"):
        raise HTTPException(404, "Thumbnail not found")

    s3 = get_client()
    obj = s3.get_object(Bucket=settings.minio_bucket, Key=doc["thumbnail_key"])

    return StreamingResponse(
        obj["Body"].iter_chunks(chunk_size=1024 * 1024),
        media_type="image/png"
    )
