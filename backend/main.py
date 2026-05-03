from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from . import database, storage, scheduler
from .routers import channels, settings as settings_router, clips, jobs, logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    await database.create_indexes()

    minio_ok = storage.check_connection()
    if minio_ok:
        storage.ensure_bucket()
    else:
        print("[WARN] MinIO unreachable — check docker-compose")

    await scheduler.start()

    print(f"[APP] GPU backend : {settings.gpu_backend}")
    print(f"[APP] URL         : http://0.0.0.0:{settings.port}")
    yield

    await scheduler.stop()
    await database.disconnect()


app = FastAPI(title="automation-youtube", version="0.1.0", lifespan=lifespan)

app.include_router(channels.router)
app.include_router(settings_router.router)
app.include_router(clips.router)
app.include_router(jobs.router)
app.include_router(logs.router)


@app.get("/api/health")
async def health():
    db = database.get_db()
    await db.command("ping")
    minio_ok = storage.check_connection()
    return {
        "status": "ok",
        "mongodb": "ok",
        "minio": "ok" if minio_ok else "error",
        "gpu_backend": settings.gpu_backend,
    }


# Serve React SPA — registered last so API routes take priority
_dist = Path(__file__).parent.parent / "frontend" / "dist"

if _dist.exists():
    _assets = _dist / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        return FileResponse(str(_dist / "index.html"))
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "Frontend not built — run: cd frontend && npm run build"}
