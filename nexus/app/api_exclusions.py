"""API endpoints for managing schema exclusions (hiding databases/schemas/tables)."""

from fastapi import APIRouter, Depends, HTTPException
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


@router.post("", response_model=ExclusionResponse)
async def add_exclusion(
    exclusion: ExclusionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(require_admin)
):
    """
    Add a new schema exclusion (admin only).
    
    This will hide the specified database/schema/table from AI recommendations
    for all users. The resource will be removed from the schema service FAISS index.
    
    Hierarchy rules:
    - Database level: catalog only (schema_name and table_name are null)
    - Schema level: catalog + schema_name (table_name is null)
    - Table level: catalog + schema_name + table_name
    """
    try:
        result = await ExclusionService.add_exclusion(
            db=db,
            catalog=exclusion.catalog,
            schema_name=exclusion.schema_name,
            table_name=exclusion.table_name,
            user_id=uuid.UUID(user_id),
            reason=exclusion.reason
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to add exclusion", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{exclusion_id}")
async def remove_exclusion(
    exclusion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Remove a schema exclusion (admin only).
    
    This will re-enable the resource and it will be added back to the
    schema service FAISS index after the next refresh.
    """
    try:
        result = await ExclusionService.remove_exclusion(db, exclusion_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to remove exclusion", error=str(e), exclusion_id=exclusion_id)
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
