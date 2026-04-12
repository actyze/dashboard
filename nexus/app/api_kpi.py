# SPDX-License-Identifier: AGPL-3.0-only
"""
Scheduled KPI API

Endpoints:
  GET    /api/kpi                          — list KPI definitions
  POST   /api/kpi                          — create a new KPI
  GET    /api/kpi/{kpi_id}                 — get single KPI definition
  PUT    /api/kpi/{kpi_id}                 — update KPI definition
  DELETE /api/kpi/{kpi_id}                 — delete KPI definition
  POST   /api/kpi/{kpi_id}/collect         — trigger immediate collection
  GET    /api/kpi/{kpi_id}/values          — get metric values (time-series)
  GET    /api/kpi/{kpi_id}/summary         — get aggregation summary
"""

from typing import Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import require_viewer, require_editor
from app.services.kpi_service import kpi_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/kpi", tags=["Scheduled KPIs"])


# ---------------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------------


class CreateKpiRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sql_query: str = Field(..., min_length=1)
    interval_hours: int = Field(default=1, ge=1, le=24)
    is_active: bool = True


class UpdateKpiRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    sql_query: Optional[str] = None
    interval_hours: Optional[int] = Field(default=None, ge=1, le=24)
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# CRUD ENDPOINTS
# ---------------------------------------------------------------------------


@router.get("")
async def list_kpis(
    current_user: dict = Depends(require_viewer),
):
    """List all KPI definitions visible to the current user."""
    kpis = await kpi_service.list_kpis()
    return {"kpis": kpis, "count": len(kpis)}


@router.post("")
async def create_kpi(
    body: CreateKpiRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_editor),
):
    """Create a new scheduled KPI definition."""
    user_id = str(current_user.get("id"))
    result = await kpi_service.create_kpi(
        name=body.name,
        sql_query=body.sql_query,
        owner_user_id=user_id,
        description=body.description,
        interval_hours=body.interval_hours,
        is_active=body.is_active,
    )
    # Run first collection immediately in background
    if body.is_active:
        background_tasks.add_task(_collect_kpi_bg, result["id"])
    return result


@router.get("/{kpi_id}")
async def get_kpi(
    kpi_id: str,
    current_user: dict = Depends(require_viewer),
):
    """Get a single KPI definition."""
    kpi = await kpi_service.get_kpi(kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    return kpi


@router.put("/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    body: UpdateKpiRequest,
    current_user: dict = Depends(require_editor),
):
    """Update a KPI definition (owner or admin)."""
    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    updates = body.model_dump(exclude_none=True)
    result = await kpi_service.update_kpi(kpi_id, user_id, updates, is_admin=is_admin)
    if not result:
        raise HTTPException(status_code=404, detail="KPI not found or not owned by you")
    return result


@router.delete("/{kpi_id}")
async def delete_kpi(
    kpi_id: str,
    current_user: dict = Depends(require_editor),
):
    """Delete a KPI definition and all its metric values (owner or admin)."""
    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    deleted = await kpi_service.delete_kpi(kpi_id, user_id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(status_code=404, detail="KPI not found or not owned by you")
    return {"success": True, "deleted_id": kpi_id}


# ---------------------------------------------------------------------------
# COLLECTION & METRICS
# ---------------------------------------------------------------------------


@router.post("/{kpi_id}/collect")
async def collect_kpi(
    kpi_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_editor),
):
    """Trigger an immediate KPI collection (owner or admin, runs in background)."""
    kpi = await kpi_service.get_kpi(kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    if not is_admin and kpi.get("owner_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the KPI owner or an admin can trigger collection")

    background_tasks.add_task(_collect_kpi_bg, kpi_id)
    return {"success": True, "kpi_id": kpi_id, "message": "Collection started"}


@router.get("/{kpi_id}/values")
async def get_kpi_values(
    kpi_id: str,
    hours: int = Query(default=24, ge=1, le=720, description="Time range in hours"),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: dict = Depends(require_viewer),
):
    """Return metric values for a KPI within the given time range."""
    kpi = await kpi_service.get_kpi(kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    values = await kpi_service.get_metric_values(kpi_id, hours=hours, limit=limit)
    return {
        "kpi_id": kpi_id,
        "kpi_name": kpi["name"],
        "hours": hours,
        "values": values,
        "count": len(values),
    }


@router.get("/{kpi_id}/summary")
async def get_kpi_summary(
    kpi_id: str,
    hours: int = Query(default=24, ge=1, le=720, description="Time range in hours"),
    current_user: dict = Depends(require_viewer),
):
    """Return aggregation summary for a KPI over the given time range."""
    kpi = await kpi_service.get_kpi(kpi_id)
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    summary = await kpi_service.get_metric_summary(kpi_id, hours=hours)
    summary["kpi_name"] = kpi["name"]
    return summary


# ---------------------------------------------------------------------------
# BACKGROUND HELPER
# ---------------------------------------------------------------------------


async def _collect_kpi_bg(kpi_id: str) -> None:
    try:
        result = await kpi_service.collect_kpi(kpi_id)
        if result.get("success"):
            logger.info(f"Background KPI collection succeeded: {kpi_id}")
        else:
            logger.warning(f"Background KPI collection failed: {kpi_id} - {result.get('error')}")
    except Exception as exc:
        logger.error(f"Background KPI collection error: {kpi_id} - {exc}")
