"""Service for managing schema exclusions (global org-level hiding of databases/schemas/tables)."""

import uuid
from typing import Dict, List, Any, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
import httpx
import os

from app.database import SchemaExclusion

logger = structlog.get_logger()


class ExclusionService:
    """Service for managing global schema exclusions."""
    
    @staticmethod
    async def get_all_exclusions(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Get all schema exclusions.
        
        Returns:
            List of exclusions with metadata
        """
        try:
            result = await db.execute(
                select(SchemaExclusion).order_by(
                    SchemaExclusion.catalog,
                    SchemaExclusion.schema_name.nullsfirst(),
                    SchemaExclusion.table_name.nullsfirst()
                )
            )
            exclusions = result.scalars().all()
            
            return [
                {
                    "id": exc.id,
                    "catalog": exc.catalog,
                    "schema_name": exc.schema_name,
                    "table_name": exc.table_name,
                    "full_path": ExclusionService._build_full_path(exc.catalog, exc.schema_name, exc.table_name),
                    "level": ExclusionService._get_level(exc.schema_name, exc.table_name),
                    "reason": exc.reason,
                    "excluded_by": str(exc.excluded_by),
                    "created_at": exc.created_at.isoformat() if exc.created_at else None
                }
                for exc in exclusions
            ]
        except Exception as e:
            logger.error("Failed to get exclusions", error=str(e))
            raise
    
    @staticmethod
    async def add_exclusion(
        db: AsyncSession,
        catalog: str,
        schema_name: Optional[str],
        table_name: Optional[str],
        user_id: uuid.UUID,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a new exclusion.
        
        Args:
            db: Database session
            catalog: Catalog/database name
            schema_name: Schema name (optional for database-level exclusion)
            table_name: Table name (optional for schema-level exclusion)
            user_id: User who is adding the exclusion
            reason: Optional reason for exclusion
            
        Returns:
            Created exclusion data
        """
        try:
            # Validate hierarchy
            if table_name and not schema_name:
                raise ValueError("Cannot exclude table without specifying schema")
            
            # Check if already excluded
            existing = await db.execute(
                select(SchemaExclusion).where(
                    SchemaExclusion.catalog == catalog,
                    SchemaExclusion.schema_name == schema_name if schema_name else SchemaExclusion.schema_name.is_(None),
                    SchemaExclusion.table_name == table_name if table_name else SchemaExclusion.table_name.is_(None)
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("This resource is already excluded")
            
            # Create exclusion
            exclusion = SchemaExclusion(
                catalog=catalog,
                schema_name=schema_name,
                table_name=table_name,
                reason=reason,
                excluded_by=user_id
            )
            
            db.add(exclusion)
            await db.commit()
            await db.refresh(exclusion)
            
            # Notify schema service to remove from FAISS index
            await ExclusionService._notify_schema_service_remove(catalog, schema_name, table_name)
            
            logger.info(
                "Exclusion added",
                catalog=catalog,
                schema=schema_name,
                table=table_name,
                user_id=str(user_id)
            )
            
            return {
                "id": exclusion.id,
                "catalog": exclusion.catalog,
                "schema_name": exclusion.schema_name,
                "table_name": exclusion.table_name,
                "full_path": ExclusionService._build_full_path(catalog, schema_name, table_name),
                "level": ExclusionService._get_level(schema_name, table_name),
                "reason": exclusion.reason,
                "excluded_by": str(exclusion.excluded_by),
                "created_at": exclusion.created_at.isoformat() if exclusion.created_at else None
            }
            
        except ValueError as e:
            await db.rollback()
            raise ValueError(str(e))
        except Exception as e:
            await db.rollback()
            logger.error("Failed to add exclusion", error=str(e))
            raise
    
    @staticmethod
    async def remove_exclusion(db: AsyncSession, exclusion_id: int) -> Dict[str, Any]:
        """
        Remove an exclusion (re-enable the resource).
        
        Args:
            db: Database session
            exclusion_id: ID of exclusion to remove
            
        Returns:
            Success message with removed exclusion details
        """
        try:
            # Get exclusion first
            result = await db.execute(
                select(SchemaExclusion).where(SchemaExclusion.id == exclusion_id)
            )
            exclusion = result.scalar_one_or_none()
            
            if not exclusion:
                raise ValueError("Exclusion not found")
            
            catalog = exclusion.catalog
            schema_name = exclusion.schema_name
            table_name = exclusion.table_name
            
            # Delete exclusion
            await db.delete(exclusion)
            await db.commit()
            
            # Notify schema service to refresh (re-add to FAISS index)
            await ExclusionService._notify_schema_service_refresh()
            
            logger.info(
                "Exclusion removed",
                exclusion_id=exclusion_id,
                catalog=catalog,
                schema=schema_name,
                table=table_name
            )
            
            return {
                "success": True,
                "message": "Exclusion removed successfully",
                "catalog": catalog,
                "schema_name": schema_name,
                "table_name": table_name,
                "full_path": ExclusionService._build_full_path(catalog, schema_name, table_name)
            }
            
        except ValueError as e:
            await db.rollback()
            raise ValueError(str(e))
        except Exception as e:
            await db.rollback()
            logger.error("Failed to remove exclusion", error=str(e), exclusion_id=exclusion_id)
            raise
    
    @staticmethod
    async def is_excluded(
        db: AsyncSession,
        catalog: str,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None
    ) -> bool:
        """
        Check if a resource is excluded.
        
        Args:
            db: Database session
            catalog: Catalog name
            schema_name: Schema name (optional)
            table_name: Table name (optional)
            
        Returns:
            True if excluded, False otherwise
        """
        try:
            # Use the SQL function for efficient checking
            result = await db.execute(
                text("SELECT nexus.is_resource_excluded(:catalog, :schema, :table)"),
                {"catalog": catalog, "schema": schema_name, "table": table_name}
            )
            return result.scalar()
        except Exception as e:
            logger.error("Failed to check exclusion", error=str(e))
            return False
    
    @staticmethod
    def _build_full_path(catalog: str, schema_name: Optional[str], table_name: Optional[str]) -> str:
        """Build full path string for a resource."""
        if not schema_name:
            return catalog
        elif not table_name:
            return f"{catalog}.{schema_name}"
        else:
            return f"{catalog}.{schema_name}.{table_name}"
    
    @staticmethod
    def _get_level(schema_name: Optional[str], table_name: Optional[str]) -> str:
        """Determine the level of exclusion."""
        if not schema_name:
            return "database"
        elif not table_name:
            return "schema"
        else:
            return "table"
    
    @staticmethod
    async def _notify_schema_service_remove(
        catalog: str,
        schema_name: Optional[str],
        table_name: Optional[str]
    ):
        """
        Notify schema service to remove resource from FAISS index.
        
        Strategy (optimized like CSV uploads):
        - Table-level: Incremental remove (~1-5s, no Trino query)
        - Schema/Database-level: Full refresh (ensures consistency, one Trino query)
        
        Why not incremental for schema/database?
        - Would need N DELETE calls (one per table in schema)
        - Each DELETE rebuilds the entire FAISS index
        - For a schema with 50 tables, that's 50 index rebuilds!
        - Full refresh is faster: 1 Trino query + 1 index rebuild
        """
        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
            
            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key
            
            async with httpx.AsyncClient() as client:
                if table_name and schema_name:
                    # Table-level: use incremental remove (like CSV uploads)
                    response = await client.delete(
                        f"{schema_service_url}/table/{catalog}/{schema_name}/{table_name}",
                        headers=headers,
                        timeout=30.0
                    )
                    if response.status_code == 200:
                        logger.info("Schema service: table removed incrementally", 
                                  table=f"{catalog}.{schema_name}.{table_name}")
                    else:
                        logger.warning("Schema service: incremental remove failed", 
                                     status=response.status_code)
                else:
                    # Schema/Database level: trigger full refresh for consistency
                    # This is more efficient than N incremental removes
                    response = await client.post(
                        f"{schema_service_url}/admin/refresh",
                        headers=headers,
                        timeout=120.0
                    )
                    if response.status_code == 200:
                        logger.info("Schema service: full refresh triggered", 
                                  catalog=catalog, 
                                  schema=schema_name or "all")
                    else:
                        logger.warning("Schema service: refresh failed", status=response.status_code)
                        
        except Exception as e:
            logger.error("Failed to notify schema service", error=str(e))
            # Don't raise - exclusion is still saved in DB
    
    @staticmethod
    async def _notify_schema_service_refresh():
        """Notify schema service to refresh (when exclusion is removed)."""
        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
            
            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{schema_service_url}/admin/refresh",
                    headers=headers,
                    timeout=120.0
                )
                if response.status_code == 200:
                    logger.info("Schema service: refresh triggered after removing exclusion")
                else:
                    logger.warning("Schema service: refresh failed", status=response.status_code)
                    
        except Exception as e:
            logger.error("Failed to notify schema service for refresh", error=str(e))
            # Don't raise - exclusion removal is still saved in DB
