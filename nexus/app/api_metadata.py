"""
API endpoints for managing org-level metadata descriptions.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user_id, require_viewer
from app.services.metadata_description_service import metadata_description_service
import structlog
import httpx
import os

router = APIRouter(prefix="/metadata", tags=["metadata"])  # No /api - frontend adds it
logger = structlog.get_logger(__name__)


# Request/Response models
class AddDescriptionRequest(BaseModel):
    catalog: str = Field(..., description="Catalog name (e.g., postgres, tpch)")
    schema_name: Optional[str] = Field(None, description="Schema name (optional for catalog-level)")
    table_name: Optional[str] = Field(None, description="Table name (optional for schema-level)")
    column_name: Optional[str] = Field(None, description="Column name (optional for table-level)")
    description: str = Field(..., min_length=1, max_length=2000, description="Description text")


class UpdateDescriptionRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000, description="Updated description text")


class DescriptionResponse(BaseModel):
    id: int
    catalog: str
    schema_name: Optional[str]
    table_name: Optional[str]
    column_name: Optional[str]
    description: str
    created_by: str
    updated_by: str
    created_at: str
    updated_at: str


@router.post("/descriptions")
async def add_description(
    request: AddDescriptionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(require_viewer)
):
    """
    Add or update a metadata description at any hierarchy level.
    
    - Catalog level: Only catalog provided
    - Schema level: Catalog + schema_name
    - Table level: Catalog + schema_name + table_name
    - Column level: Catalog + schema_name + table_name + column_name
    """
    try:
        result = await metadata_description_service.add_description(
            db=db,
            user_id=user_id,
            catalog=request.catalog,
            schema_name=request.schema_name,
            table_name=request.table_name,
            column_name=request.column_name,
            description=request.description
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to add description"))
        
        # Trigger schema service to update embeddings for this table
        if background_tasks and request.table_name:
            # Only update if it's table or column level (columns belong to tables)
            background_tasks.add_task(
                notify_schema_service_description_updated,
                catalog=request.catalog,
                schema_name=request.schema_name,
                table_name=request.table_name
            )
        
        return {
            "success": True,
            "id": result["id"],
            "message": result["message"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_description_endpoint_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/descriptions/{description_id}")
async def update_description(
    description_id: int,
    request: UpdateDescriptionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(require_viewer)
):
    """
    Update an existing metadata description.
    """
    try:
        # Get the description to find out which table it belongs to (for schema service update)
        existing = await db.execute(
            """
            SELECT catalog, schema_name, table_name 
            FROM nexus.metadata_descriptions 
            WHERE id = :id
            """,
            {"id": description_id}
        )
        existing_row = existing.fetchone()
        
        result = await metadata_description_service.update_description(
            db=db,
            description_id=description_id,
            user_id=user_id,
            new_description=request.description
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=404 if "not found" in result.get("error", "").lower() else 400, 
                              detail=result.get("error", "Failed to update description"))
        
        # Trigger schema service update if it's a table/column description
        if background_tasks and existing_row and existing_row.table_name:
            background_tasks.add_task(
                notify_schema_service_description_updated,
                catalog=existing_row.catalog,
                schema_name=existing_row.schema_name,
                table_name=existing_row.table_name
            )
        
        return {
            "success": True,
            "message": result["message"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_description_endpoint_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/descriptions/{description_id}")
async def delete_description(
    description_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(require_viewer)
):
    """
    Delete a metadata description.
    """
    try:
        # Get the description before deleting (for schema service update)
        from sqlalchemy import text
        existing_query = text("""
            SELECT catalog, schema_name, table_name 
            FROM nexus.metadata_descriptions 
            WHERE id = :id
        """)
        existing = await db.execute(existing_query, {"id": description_id})
        existing_row = existing.fetchone()
        
        result = await metadata_description_service.delete_description(
            db=db,
            description_id=description_id,
            user_id=user_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=404 if "not found" in result.get("error", "").lower() else 400,
                              detail=result.get("error", "Failed to delete description"))
        
        # Trigger schema service update if it was a table/column description
        if background_tasks and existing_row and existing_row.table_name:
            background_tasks.add_task(
                notify_schema_service_description_updated,
                catalog=existing_row.catalog,
                schema_name=existing_row.schema_name,
                table_name=existing_row.table_name
            )
        
        return {
            "success": True,
            "message": result["message"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_description_endpoint_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/descriptions")
async def get_descriptions(
    catalog: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_viewer)
):
    """
    Get metadata descriptions, optionally filtered by catalog.
    """
    try:
        if catalog:
            descriptions = await metadata_description_service.get_descriptions_by_catalog(db, catalog)
        else:
            descriptions = await metadata_description_service.get_all_descriptions(db)
        
        return {
            "success": True,
            "descriptions": descriptions,
            "count": len(descriptions)
        }
        
    except Exception as e:
        logger.error("get_descriptions_endpoint_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/descriptions/{description_id}")
async def get_description_by_id(
    description_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_viewer)
):
    """
    Get a specific metadata description by ID.
    """
    try:
        from sqlalchemy import text
        query = text("""
            SELECT 
                id, catalog, schema_name, table_name, column_name,
                description, created_by, updated_by,
                created_at, updated_at
            FROM nexus.metadata_descriptions
            WHERE id = :id
        """)
        
        result = await db.execute(query, {"id": description_id})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Description not found")
        
        return {
            "success": True,
            "description": {
                "id": row.id,
                "catalog": row.catalog,
                "schema_name": row.schema_name,
                "table_name": row.table_name,
                "column_name": row.column_name,
                "description": row.description,
                "created_by": str(row.created_by),
                "updated_by": str(row.updated_by),
                "created_at": row.created_at.isoformat(),
                "updated_at": row.updated_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_description_by_id_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def notify_schema_service_description_updated(
    catalog: str,
    schema_name: str,
    table_name: str
):
    """
    Notify schema service that a table's metadata description was updated.
    This triggers an incremental update of the table's FAISS embedding.
    """
    try:
        schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
        service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
        
        headers = {}
        if service_key:
            headers["X-Service-Key"] = service_key
        
        # First remove the old embedding
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{schema_service_url}/table/{catalog}/{schema_name}/{table_name}",
                headers=headers,
                timeout=30.0
            )
        
        # Then fetch fresh table metadata from Trino and add it back
        # The schema service will re-fetch descriptions from Nexus
        async with httpx.AsyncClient() as client:
            # Trigger a refresh for this specific table
            response = await client.post(
                f"{schema_service_url}/table/refresh",
                json={
                    "catalog": catalog,
                    "schema": schema_name,
                    "table": table_name
                },
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info("schema_service_description_updated",
                          table=f"{catalog}.{schema_name}.{table_name}")
            else:
                logger.warning("schema_service_description_update_failed",
                             status_code=response.status_code,
                             response=response.text)
                
    except Exception as e:
        logger.error("schema_service_description_update_error", error=str(e))

