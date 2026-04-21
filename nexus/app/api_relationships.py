# SPDX-License-Identifier: AGPL-3.0-only
"""API endpoints for managing semantic table relationships."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

from app.auth.dependencies import require_admin, require_viewer, get_current_user_id
from app.services.relationship_service import relationship_service
from app.services.relationship_mining_service import mining_service
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/api/relationships", tags=["relationships"])


# =============================================================================
# Request / Response Models
# =============================================================================

class RelationshipCreate(BaseModel):
    """Request model for creating a relationship."""
    source_catalog: str = Field(..., description="Source catalog name")
    source_schema: str = Field(..., description="Source schema name")
    source_table: str = Field(..., description="Source table name")
    target_catalog: str = Field(..., description="Target catalog name")
    target_schema: str = Field(..., description="Target schema name")
    target_table: str = Field(..., description="Target table name")
    join_condition: str = Field(..., max_length=500, description="SQL join condition")
    relationship_type: str = Field("1:N", description="Relationship type: 1:1, 1:N, N:1, M:N")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score (0-1)")


class RelationshipUpdate(BaseModel):
    """Request model for updating a relationship."""
    join_condition: Optional[str] = Field(None, description="SQL join condition")
    relationship_type: Optional[str] = Field(None, description="Relationship type: 1:1, 1:N, N:1, M:N")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")
    is_verified: Optional[bool] = Field(None, description="Verified flag")
    is_disabled: Optional[bool] = Field(None, description="Disabled flag")


class InferRequest(BaseModel):
    """Request model for triggering convention inference."""
    catalog: str = Field(..., description="Catalog to infer relationships for")
    schema_name: Optional[str] = Field(None, description="Optional schema filter")
    tables_metadata: Optional[List[dict]] = Field(
        None,
        description="List of table metadata dicts with full_name, table_name, columns"
    )


class MineRequest(BaseModel):
    """Request model for triggering query history mining."""
    limit: int = Field(1000, ge=1, le=10000, description="Max number of queries to parse")


# =============================================================================
# Endpoints
# =============================================================================

@router.get("")
async def list_relationships(
    catalog: Optional[str] = Query(None, description="Filter by catalog"),
    schema: Optional[str] = Query(None, description="Filter by schema"),
    table: Optional[str] = Query(None, description="Filter by table name"),
    method: Optional[str] = Query(None, description="Filter by source method (inferred, mined, admin)"),
    include_disabled: bool = Query(False, description="Include disabled relationships"),
    current_user: dict = Depends(require_viewer),
):
    """List relationships with optional filters."""
    try:
        relationships = await relationship_service.get_relationships(
            catalog=catalog,
            schema=schema,
            table=table,
            method=method,
            include_disabled=include_disabled,
        )
        return {
            "success": True,
            "relationships": relationships,
            "count": len(relationships),
        }
    except Exception as e:
        logger.error("list_relationships_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/path")
async def find_join_path(
    tables: str = Query(..., description="Comma-separated fully-qualified table names (catalog.schema.table)"),
    current_user: dict = Depends(require_viewer),
):
    """Find optimal join path between the given tables.

    Query param `tables` should be comma-separated fully-qualified table names.
    Example: ?tables=postgres.public.orders,postgres.public.customers
    """
    try:
        table_list = [t.strip() for t in tables.split(",") if t.strip()]
        if len(table_list) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least two fully-qualified table names are required",
            )

        # Fetch active relationships for these tables
        relationships = await relationship_service.get_relationships_for_tables(table_list)

        # Compute join paths (pure function, no DB)
        join_paths = relationship_service.find_join_paths(set(table_list), relationships)

        return {
            "success": True,
            "tables": table_list,
            "join_paths": join_paths,
            "relationships_used": len(relationships),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("find_join_path_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{relationship_id}")
async def get_relationship(
    relationship_id: int,
    current_user: dict = Depends(require_viewer),
):
    """Get a single relationship by ID."""
    try:
        rel = await relationship_service.get_relationship_by_id(relationship_id)
        if not rel:
            raise HTTPException(status_code=404, detail="Relationship not found")
        return {"success": True, "relationship": rel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_relationship(
    request: RelationshipCreate,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Create a new relationship (admin only)."""
    try:
        data = request.model_dump()
        data["source_method"] = "admin"
        rel = await relationship_service.create_relationship(
            data=data,
            user_id=uuid.UUID(user_id),
        )
        return {"success": True, "relationship": rel}
    except Exception as e:
        logger.error("create_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{relationship_id}")
async def update_relationship(
    relationship_id: int,
    request: RelationshipUpdate,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Update a relationship (admin only)."""
    try:
        data = {k: v for k, v in request.model_dump().items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")

        rel = await relationship_service.update_relationship(
            relationship_id=relationship_id,
            data=data,
            user_id=uuid.UUID(user_id),
        )
        if not rel:
            raise HTTPException(status_code=404, detail="Relationship not found")

        return {"success": True, "relationship": rel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{relationship_id}/verify")
async def verify_relationship(
    relationship_id: int,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Verify a relationship (admin only). Sets confidence=1.0 and is_verified=True."""
    try:
        rel = await relationship_service.verify_relationship(
            relationship_id=relationship_id,
            user_id=uuid.UUID(user_id),
        )
        if not rel:
            raise HTTPException(status_code=404, detail="Relationship not found")
        return {"success": True, "relationship": rel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("verify_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{relationship_id}/disable")
async def disable_relationship(
    relationship_id: int,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Disable a relationship (admin only). Soft delete."""
    try:
        rel = await relationship_service.disable_relationship(
            relationship_id=relationship_id,
            user_id=uuid.UUID(user_id),
        )
        if not rel:
            raise HTTPException(status_code=404, detail="Relationship not found")
        return {"success": True, "relationship": rel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("disable_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{relationship_id}")
async def delete_relationship(
    relationship_id: int,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Delete a relationship (admin only). Hard delete."""
    try:
        deleted = await relationship_service.delete_relationship(
            relationship_id=relationship_id,
            user_id=uuid.UUID(user_id),
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Relationship not found")
        return {"success": True, "message": "Relationship deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_relationship_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/infer")
async def trigger_convention_inference(
    request: InferRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin),
):
    """Trigger convention-based relationship inference (admin only).

    Runs in a background task. Returns immediately with accepted status.
    """
    try:
        background_tasks.add_task(
            relationship_service.run_convention_inference,
            catalog=request.catalog,
            schema=request.schema_name,
            tables_metadata=request.tables_metadata,
        )
        return {
            "success": True,
            "message": "Convention inference started in background",
            "catalog": request.catalog,
            "schema": request.schema_name,
        }
    except Exception as e:
        logger.error("trigger_inference_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mine")
async def trigger_query_mining(
    request: MineRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
):
    """Mine JOIN patterns from successful query history (admin only).

    Parses SQL from nexus.query_history, extracts JOIN clauses, and populates
    the relationship graph with frequency-based confidence scores.
    Runs in a background task. Returns immediately with accepted status.
    """
    try:
        background_tasks.add_task(
            mining_service.mine_query_history,
            limit=request.limit,
        )
        return {
            "success": True,
            "message": "Query history mining started in background",
            "limit": request.limit,
        }
    except Exception as e:
        logger.error("trigger_mining_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
