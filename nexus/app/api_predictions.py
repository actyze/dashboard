# SPDX-License-Identifier: AGPL-3.0-only
"""
Predictive Intelligence API

Endpoints:
  GET    /api/predictions/capabilities            — available prediction types
  POST   /api/predictions/analyze                 — data quality + feature recommendations
  GET    /api/predictions/pipelines               — list pipelines
  POST   /api/predictions/pipelines               — create pipeline
  GET    /api/predictions/pipelines/{id}           — get pipeline details
  PUT    /api/predictions/pipelines/{id}           — update pipeline
  DELETE /api/predictions/pipelines/{id}           — delete pipeline
  POST   /api/predictions/pipelines/{id}/train     — trigger training
  GET    /api/predictions/pipelines/{id}/runs      — run history
"""

from typing import List, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import require_viewer, require_editor
from app.services.prediction_service import prediction_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["Predictive Intelligence"])


# ---------------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    prediction_type: str = Field(..., pattern="^(forecast|classify|estimate)$")
    source_type: str = Field(default="kpi", pattern="^(kpi|sql)$")
    source_kpi_id: Optional[str] = None
    source_sql: Optional[str] = None
    target_column: Optional[str] = None
    forecast_horizon: int = Field(default=30, ge=1, le=365)


class CreatePipelineRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    prediction_type: str = Field(..., pattern="^(forecast|classify|estimate)$")
    source_type: str = Field(default="kpi", pattern="^(kpi|sql)$")
    source_kpi_id: Optional[str] = None
    source_sql: Optional[str] = None
    target_column: str = Field(..., min_length=1)
    feature_columns: Optional[List[str]] = None
    output_columns: Optional[List[str]] = Field(default=None, description="Columns to include in prediction output (ID/label columns)")
    forecast_horizon: Optional[int] = Field(default=None, ge=1, le=365)
    trigger_mode: str = Field(default="after_kpi_collection", pattern="^(after_kpi_collection|scheduled|manual)$")
    schedule_hours: int = Field(default=24, ge=1, le=720)
    description: Optional[str] = None
    train_now: bool = Field(default=True, description="Trigger first training immediately")


class UpdatePipelineRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    trigger_mode: Optional[str] = Field(default=None, pattern="^(after_kpi_collection|scheduled|manual)$")
    schedule_hours: Optional[int] = Field(default=None, ge=1, le=720)
    is_active: Optional[bool] = None
    feature_columns: Optional[List[str]] = None
    output_columns: Optional[List[str]] = None
    forecast_horizon: Optional[int] = Field(default=None, ge=1, le=365)


# ---------------------------------------------------------------------------
# CAPABILITIES
# ---------------------------------------------------------------------------


@router.get("/capabilities")
async def get_capabilities(
    current_user: dict = Depends(require_viewer),
):
    """Return available prediction types based on healthy workers."""
    return await prediction_service.get_capabilities()


# ---------------------------------------------------------------------------
# DATA ANALYSIS
# ---------------------------------------------------------------------------


@router.post("/analyze")
async def analyze_data(
    body: AnalyzeRequest,
    current_user: dict = Depends(require_editor),
):
    """Analyze data quality and return feature recommendations."""
    if body.source_type == "kpi" and not body.source_kpi_id:
        raise HTTPException(status_code=400, detail="source_kpi_id required when source_type is 'kpi'")
    if body.source_type == "sql" and not body.source_sql:
        raise HTTPException(status_code=400, detail="source_sql required when source_type is 'sql'")

    result = await prediction_service.analyze_data(
        prediction_type=body.prediction_type,
        source_type=body.source_type,
        source_kpi_id=body.source_kpi_id,
        source_sql=body.source_sql,
        target_column=body.target_column,
        forecast_horizon=body.forecast_horizon,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Analysis failed"))
    return result


# ---------------------------------------------------------------------------
# PIPELINE CRUD
# ---------------------------------------------------------------------------


@router.get("/pipelines")
async def list_pipelines(
    current_user: dict = Depends(require_viewer),
):
    """List all prediction pipelines."""
    pipelines = await prediction_service.list_pipelines()
    return {"pipelines": pipelines, "count": len(pipelines)}


@router.post("/pipelines")
async def create_pipeline(
    body: CreatePipelineRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_editor),
):
    """Create a new prediction pipeline."""
    if body.source_type == "kpi" and not body.source_kpi_id:
        raise HTTPException(status_code=400, detail="source_kpi_id required when source_type is 'kpi'")
    if body.source_type == "sql" and not body.source_sql:
        raise HTTPException(status_code=400, detail="source_sql required when source_type is 'sql'")

    user_id = str(current_user.get("id"))
    try:
        result = await prediction_service.create_pipeline(
            name=body.name,
            prediction_type=body.prediction_type,
            source_type=body.source_type,
            target_column=body.target_column,
            owner_user_id=user_id,
            source_kpi_id=body.source_kpi_id,
            source_sql=body.source_sql,
            feature_columns=body.feature_columns,
            output_columns=body.output_columns,
            forecast_horizon=body.forecast_horizon,
            trigger_mode=body.trigger_mode,
            schedule_hours=body.schedule_hours,
            description=body.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Optionally trigger first training
    if body.train_now:
        background_tasks.add_task(_train_pipeline_bg, result["id"])

    return result


@router.get("/pipelines/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(require_viewer),
):
    """Get a single pipeline with details."""
    pipeline = await prediction_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.put("/pipelines/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    body: UpdatePipelineRequest,
    current_user: dict = Depends(require_editor),
):
    """Update a pipeline (owner or admin)."""
    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    updates = body.model_dump(exclude_none=True)
    result = await prediction_service.update_pipeline(pipeline_id, user_id, updates, is_admin=is_admin)
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline not found or not owned by you")
    return result


@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(require_editor),
):
    """Delete a pipeline and its output table (owner or admin)."""
    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    deleted = await prediction_service.delete_pipeline(pipeline_id, user_id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pipeline not found or not owned by you")
    return {"success": True, "deleted_id": pipeline_id}


# ---------------------------------------------------------------------------
# TRAINING & RUNS
# ---------------------------------------------------------------------------


@router.post("/pipelines/{pipeline_id}/train")
async def train_pipeline(
    pipeline_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_editor),
):
    """Trigger training for a pipeline (runs in background)."""
    pipeline = await prediction_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    user_id = str(current_user.get("id"))
    is_admin = "ADMIN" in current_user.get("roles", [])
    if not is_admin and pipeline.get("owner_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the pipeline owner or an admin can trigger training")

    background_tasks.add_task(_train_pipeline_bg, pipeline_id)
    return {"success": True, "pipeline_id": pipeline_id, "message": "Training started"}


@router.get("/pipelines/{pipeline_id}/runs")
async def get_runs(
    pipeline_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_viewer),
):
    """Get training run history for a pipeline."""
    pipeline = await prediction_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    runs = await prediction_service.get_runs(pipeline_id, limit=limit)
    return {"pipeline_id": pipeline_id, "runs": runs, "count": len(runs)}


@router.get("/pipelines/{pipeline_id}/predictions")
async def get_predictions(
    pipeline_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: dict = Depends(require_viewer),
):
    """Get actual prediction results from the output table."""
    pipeline = await prediction_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if pipeline.get("status") != "ready":
        return {"pipeline_id": pipeline_id, "columns": [], "rows": [], "count": 0, "message": "Pipeline not yet trained"}

    result = await prediction_service.get_prediction_results(pipeline_id, limit=limit)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to fetch predictions"))
    return result


# ---------------------------------------------------------------------------
# BACKGROUND HELPER
# ---------------------------------------------------------------------------


async def _train_pipeline_bg(pipeline_id: str) -> None:
    try:
        result = await prediction_service.train_pipeline(pipeline_id)
        if result.get("success"):
            logger.info(f"Background pipeline training succeeded: {pipeline_id}")
        else:
            logger.warning(f"Background pipeline training failed: {pipeline_id} - {result.get('error')}")
    except Exception as exc:
        logger.error(f"Background pipeline training error: {pipeline_id} - {exc}")
