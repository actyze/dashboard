"""API endpoints for managing schema exclusions (hiding databases/schemas/tables)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.auth.dependencies import require_admin, get_current_user_id
from app.services.exclusion_service import ExclusionService
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/exclusions", tags=["Schema Exclusions"])


class ExclusionCreate(BaseModel):
    """Request model for creating an exclusion."""
    catalog: str = Field(..., description="Catalog/database name")
    schema_name: Optional[str] = Field(None, description="Schema name (null for database-level exclusion)")
    table_name: Optional[str] = Field(None, description="Table name (null for schema-level exclusion)")
    reason: Optional[str] = Field(None, description="Reason for exclusion")


class ExclusionResponse(BaseModel):
    """Response model for exclusion data."""
    id: int
    catalog: str
    schema_name: Optional[str]
    table_name: Optional[str]
    full_path: str
    level: str  # "database", "schema", or "table"
    reason: Optional[str]
    excluded_by: str
    created_at: Optional[str]


class BulkExclusionCreate(BaseModel):
    """Request model for bulk creating exclusions."""
    exclusions: List[ExclusionCreate] = Field(..., description="List of exclusions to create")


class BulkExclusionResponse(BaseModel):
    """Response model for bulk exclusion operation."""
    success: bool
    created_count: int
    skipped_count: int
    errors: List[str]
    created_exclusions: List[ExclusionResponse]



@router.get("", response_model=List[ExclusionResponse])
async def get_exclusions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Get all schema exclusions (admin only).
    
    Returns list of all excluded databases, schemas, and tables.
    """
    try:
        exclusions = await ExclusionService.get_all_exclusions(db)
        return exclusions
    except Exception as e:
        logger.error("Failed to get exclusions", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk", response_model=BulkExclusionResponse)
async def bulk_add_exclusions(
    request: BulkExclusionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin)
):
    """
    Bulk add schema exclusions (admin only).
    
    This will hide multiple databases/schemas/tables from AI recommendations
    for all users. Resources will be removed from the schema service FAISS index.
    
    Skips any exclusions that already exist without raising an error.
    """
    try:
        result = await ExclusionService.bulk_add_exclusions(
            db=db,
            exclusions=[
                {
                    "catalog": exc.catalog,
                    "schema_name": exc.schema_name,
                    "table_name": exc.table_name,
                    "reason": exc.reason
                }
                for exc in request.exclusions
            ],
            user_id=uuid.UUID(user_id)
        )
        return result
    except Exception as e:
        logger.error("Failed to bulk add exclusions", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bulk")
async def bulk_remove_exclusions(
    ids: List[int] = Query(..., description="Exclusion IDs to remove (repeatable: ?ids=1&ids=2)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Bulk remove schema exclusions / unhide multiple resources (admin only).

    Pass IDs as repeatable query params: DELETE /bulk?ids=1&ids=2&ids=3

    Re-enables multiple resources at once. They will be added back to the
    schema service FAISS index in a single operation (one rebuild).
    """
    try:
        result = await ExclusionService.bulk_remove_exclusions(
            db=db,
            exclusion_ids=ids
        )
        return result
    except Exception as e:
        logger.error("Failed to bulk remove exclusions", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check")
async def check_exclusion(
    catalog: str,
    schema_name: Optional[str] = None,
    table_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Check if a resource is excluded (admin only).
    
    Returns whether the specified database/schema/table is currently excluded.
    """
    try:
        is_excluded = await ExclusionService.is_excluded(db, catalog, schema_name, table_name)
        return {
            "catalog": catalog,
            "schema_name": schema_name,
            "table_name": table_name,
            "is_excluded": is_excluded
        }
    except Exception as e:
        logger.error("Failed to check exclusion", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
