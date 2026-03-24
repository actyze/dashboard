"""
Tile Cache & Refresh API

Endpoints:
  GET  /api/refresh/dashboard/{id}/cache-status   — per-tile cache status
  POST /api/refresh/dashboard/{id}                — enqueue full dashboard refresh
  POST /api/refresh/tile/{tile_id}                — enqueue single tile refresh
  GET  /api/refresh/tile/{tile_id}/cache          — fetch cached result for a tile
  PUT  /api/refresh/tile/{tile_id}/cache          — write live result to cache (write-through)
  GET  /api/refresh/jobs/{job_id}                 — job progress
  GET  /api/refresh/jobs                          — recent jobs list
  POST /api/refresh/tile/{tile_id}/invalidate     — hard-clear tile cache entry
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, require_viewer, require_editor
from app.services.pg_cache_service import pg_cache_service
from app.services.refresh_service import refresh_service


class WriteTileCacheRequest(BaseModel):
    dashboard_id: str
    sql_query: str
    query_results: Dict[str, Any]
    execution_time: Optional[float] = 0
    refresh_interval_seconds: Optional[int] = 7200

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/refresh", tags=["Tile Cache & Refresh"])


# ---------------------------------------------------------------------------
# DASHBOARD-LEVEL
# ---------------------------------------------------------------------------


@router.get("/dashboard/{dashboard_id}/cache-status")
async def get_dashboard_cache_status(
    dashboard_id: str,
    current_user: dict = Depends(require_viewer),
):
    """
    Return the current cache status for every tile in a dashboard.
    Also includes the latest refresh job for this dashboard.
    """
    tile_statuses = await pg_cache_service.get_dashboard_cache_status(dashboard_id)
    latest_job = await refresh_service.get_dashboard_latest_job(dashboard_id)

    total = len(tile_statuses)
    fresh = sum(1 for t in tile_statuses if t["is_fresh"])
    stale = sum(1 for t in tile_statuses if not t["is_fresh"])

    return {
        "dashboard_id": dashboard_id,
        "summary": {
            "total_tiles": total,
            "fresh_tiles": fresh,
            "stale_tiles": stale,
            "all_fresh": total > 0 and fresh == total,
        },
        "latest_job": latest_job,
        "tiles": tile_statuses,
    }


@router.post("/dashboard/{dashboard_id}")
async def refresh_dashboard(
    dashboard_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_editor),
):
    """
    Enqueue a full refresh for all tiles in a dashboard.
    Returns a job_id that can be polled via GET /api/refresh/jobs/{job_id}.
    """
    result = await refresh_service.enqueue_dashboard_refresh(
        dashboard_id=dashboard_id,
        triggered_by="api",
        created_by=str(current_user.get("id")) if current_user else None,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to enqueue refresh"))

    # Kick off processing immediately in background instead of waiting for scheduler
    background_tasks.add_task(_run_process_now)
    return result


@router.get("/dashboard/{dashboard_id}/latest-job")
async def get_dashboard_latest_job(
    dashboard_id: str,
    current_user: dict = Depends(require_viewer),
):
    """Return the most recent refresh job for this dashboard."""
    job = await refresh_service.get_dashboard_latest_job(dashboard_id)
    if not job:
        return {"dashboard_id": dashboard_id, "job": None}
    return {"dashboard_id": dashboard_id, "job": job}


# ---------------------------------------------------------------------------
# TILE-LEVEL
# ---------------------------------------------------------------------------


@router.get("/tile/{tile_id}/cache")
async def get_tile_cache(
    tile_id: str,
    current_user: dict = Depends(require_viewer),
):
    """
    Return cached result for a specific tile.
    Includes freshness info so frontend can decide whether to show stale data.
    """
    cache = await pg_cache_service.get_tile_cache(tile_id)
    if not cache:
        return {
            "tile_id": tile_id,
            "cache_hit": False,
            "is_fresh": False,
            "data": None,
        }
    return {
        "tile_id": tile_id,
        "cache_hit": True,
        "is_fresh": cache["is_fresh"],
        "is_stale": cache.get("is_stale", False),
        "refresh_status": cache["refresh_status"],
        "cached_at": cache["cached_at"],
        "expires_at": cache["expires_at"],
        "row_count": cache["row_count"],
        "execution_time_ms": cache["execution_time_ms"],
        "data": cache["cached_data"],
    }


@router.put("/tile/{tile_id}/cache")
async def write_tile_cache(
    tile_id: str,
    body: WriteTileCacheRequest,
    current_user: dict = Depends(require_viewer),
):
    """
    Write-through cache: called by the frontend after a successful live execution
    so the result is cached immediately without waiting for the scheduler.
    """
    result_payload = {
        "query_results": body.query_results,
        "execution_time": body.execution_time or 0,
    }
    await pg_cache_service.upsert_tile_cache(
        tile_id=tile_id,
        dashboard_id=body.dashboard_id,
        sql_query=body.sql_query,
        result_data=result_payload,
        refresh_interval_seconds=body.refresh_interval_seconds or 7200,
        refreshed_by=str(current_user.get("id")) if current_user else None,
    )
    return {
        "success": True,
        "tile_id": tile_id,
        "cached_at": datetime.utcnow().isoformat(),
    }


@router.post("/tile/{tile_id}")
async def refresh_tile(
    tile_id: str,
    background_tasks: BackgroundTasks,
    dashboard_id: str = Query(..., description="Parent dashboard ID"),
    current_user: dict = Depends(require_editor),
):
    """
    Enqueue a refresh for a single tile.
    Returns job_id for progress polling.
    """
    result = await refresh_service.enqueue_tile_refresh(
        tile_id=tile_id,
        dashboard_id=dashboard_id,
        triggered_by="api",
        created_by=str(current_user.get("id")) if current_user else None,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    background_tasks.add_task(_run_process_now)
    return result


@router.post("/tile/{tile_id}/invalidate")
async def invalidate_tile_cache(
    tile_id: str,
    current_user: dict = Depends(require_editor),
):
    """Hard-delete the cache entry for a tile (e.g. after SQL is edited)."""
    await pg_cache_service.invalidate_tile_cache(tile_id)
    return {"success": True, "tile_id": tile_id}


# ---------------------------------------------------------------------------
# JOBS
# ---------------------------------------------------------------------------


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(require_viewer),
):
    """Poll the status and progress of a refresh job."""
    job = await refresh_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs")
async def list_recent_jobs(
    limit: int = Query(default=20, ge=1, le=100),
    job_type: Optional[str] = Query(default=None, regex="^(dashboard|tile|kpi_metric)$"),
    current_user: dict = Depends(require_viewer),
):
    """Return recent refresh jobs, newest first."""
    jobs = await refresh_service.list_recent_jobs(limit=limit, job_type=job_type)
    return {"jobs": jobs, "count": len(jobs)}


# ---------------------------------------------------------------------------
# BACKGROUND HELPER
# ---------------------------------------------------------------------------


async def _run_process_now() -> None:
    """Process pending jobs immediately without waiting for scheduler tick."""
    try:
        count = await refresh_service.process_pending_jobs()
        if count:
            logger.info(f"Background task: processed {count} refresh jobs")
    except Exception as exc:
        logger.error(f"Background task process_pending_jobs failed: {exc}")
