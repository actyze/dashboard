"""User Preferences API - Manage user-specific schema/table preferences."""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
import structlog
from app.auth.dependencies import get_current_user, require_write_access
from app.services.preference_service import preference_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api/preferences", tags=["User Preferences"])


# ============================================================================
# Preferred Tables API
# ============================================================================

class PreferredTableInput(BaseModel):
    """Input for adding a table to preferred list."""
    catalog: str = Field(..., description="Database catalog")
    schema_name: str = Field(..., description="Schema name", alias="schema")
    table_name: str = Field(..., description="Table name", alias="table")
    
    class Config:
        populate_by_name = True


class BulkPreferredTableItem(BaseModel):
    """Single item in a bulk preferred tables request."""
    catalog: str
    database_name: str
    schema_name: str
    table_name: str


class BulkAddPreferredTablesInput(BaseModel):
    """Input for bulk adding preferred tables."""
    tables: List[BulkPreferredTableItem]


class BulkRemovePreferredTablesInput(BaseModel):
    """Input for bulk removing preferred tables."""
    preference_ids: List[str]


class PreferredTableResponse(BaseModel):
    """Response for preferred table (slim - no columns, frontend only needs identifiers)."""
    id: str
    catalog: str
    database_name: str
    schema_name: str
    table_name: str
    full_name: str
    created_at: Optional[str]
    updated_at: Optional[str]


@router.get("/preferred-tables", response_model=List[PreferredTableResponse])
async def get_preferred_tables(current_user: dict = Depends(get_current_user)):
    """
    Get all preferred tables for the current user (slim response - identifiers only).
    
    Columns and metadata are stored in DB and used directly by the AI orchestration
    service when generating SQL. The frontend only needs table identifiers.
    """
    try:
        preferred_tables = await preference_service.get_user_preferred_tables(str(current_user["id"]))
        return preferred_tables
    except Exception as e:
        logger.error("Failed to get preferred tables", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve preferred tables")



@router.post("/preferred-tables")
async def add_preferred_table(
    table: PreferredTableInput,
    current_user: dict = Depends(require_write_access)
):
    """
    Add a table to user's preferred list.
    
    The system will automatically fetch full metadata (columns, types, descriptions)
    from the schema service and store it for AI query generation.
    
    Maximum preferred tables: Configured via MAX_PREFERRED_TABLES (default: 50)
    """
    try:
        # Extract database name from catalog (for now, use catalog as database)
        # This assumes catalog = database name (standard for most connectors)
        result = await preference_service.add_preferred_table(
            user_id=str(current_user["id"]),
            catalog=table.catalog,
            database_name=table.catalog,  # Use catalog as database name
            schema_name=table.schema_name,
            table_name=table.table_name
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to add preferred table"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add preferred table", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to add preferred table")


@router.post("/preferred-tables/bulk")
async def bulk_add_preferred_tables(
    payload: BulkAddPreferredTablesInput,
    current_user: dict = Depends(require_write_access)
):
    """
    Add multiple tables to user's preferred list in one request.
    Respects MAX_PREFERRED_TABLES limit - extras are skipped with reason.
    MUST be defined before /preferred-tables/{preference_id} to avoid route shadowing.
    """
    try:
        tables = [t.model_dump() for t in payload.tables]
        result = await preference_service.bulk_add_preferred_tables(
            user_id=str(current_user["id"]),
            tables=tables
        )
        return result
    except Exception as e:
        logger.error("Failed to bulk add preferred tables", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to bulk add preferred tables")


@router.delete("/preferred-tables/bulk")
async def bulk_remove_preferred_tables(
    payload: BulkRemovePreferredTablesInput,
    current_user: dict = Depends(require_write_access)
):
    """
    Remove multiple tables from user's preferred list in one request.
    MUST be defined before /preferred-tables/{preference_id} to avoid route shadowing.
    """
    try:
        result = await preference_service.bulk_remove_preferred_tables(
            user_id=str(current_user["id"]),
            preference_ids=payload.preference_ids
        )
        return result
    except Exception as e:
        logger.error("Failed to bulk remove preferred tables", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to bulk remove preferred tables")


@router.delete("/preferred-tables/{preference_id}")
async def remove_preferred_table(
    preference_id: str,
    current_user: dict = Depends(require_write_access)
):
    """
    Remove a table from user's preferred list.
    
    The table will no longer be prioritized by AI for query generation.
    """
    try:
        result = await preference_service.remove_preferred_table(
            user_id=str(current_user["id"]),
            preference_id=preference_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Preferred table not found"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to remove preferred table", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to remove preferred table")

