from fastapi import APIRouter

from ..scheduler import get_scheduler, sync_jobs

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
async def list_jobs() -> list[dict]:
    sched = get_scheduler()
    result = []
    for job in sched.get_jobs():
        nxt = job.next_run_time
        result.append({
            "id": job.id,
            "name": job.name or job.id,
            "next_run": nxt.isoformat() if nxt else None,
        })
    return result


@router.post("/sync")
async def sync() -> dict:
    await sync_jobs()
    return {"status": "synced"}
