"""Service for managing schema exclusions (global org-level hiding of databases/schemas/tables)."""

import uuid
import asyncio
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
            
            # Notify schema service to add back to FAISS index (incremental)
            await ExclusionService._notify_schema_service_refresh(catalog, schema_name, table_name)
            
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
    async def bulk_add_exclusions(
        db: AsyncSession,
        exclusions: List[Dict[str, Any]],
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Bulk add exclusions efficiently.
        
        Optimizations:
        - Single query to fetch ALL existing exclusions (not N queries)
        - Bulk insert with single flush (not N flushes)
        - Non-blocking schema service notification (fire-and-forget)
        
        Args:
            db: Database session
            exclusions: List of exclusion dicts with catalog, schema_name, table_name, reason
            user_id: User who is adding the exclusions
            
        Returns:
            Summary with created_count, skipped_count, errors, and created_exclusions
        """
        if not exclusions:
            return {
                "success": True,
                "created_count": 0,
                "skipped_count": 0,
                "errors": [],
                "created_exclusions": []
            }
        
        errors = []
        
        # Step 1: Validate all exclusions first (no DB calls)
        valid_exclusions = []
        for exc_data in exclusions:
            catalog = exc_data.get("catalog")
            schema_name = exc_data.get("schema_name")
            table_name = exc_data.get("table_name")
            reason = exc_data.get("reason")
            
            if table_name and not schema_name:
                errors.append(f"Cannot exclude table {table_name} without specifying schema")
                continue
            
            valid_exclusions.append({
                "catalog": catalog,
                "schema_name": schema_name,
                "table_name": table_name,
                "reason": reason
            })
        
        if not valid_exclusions:
            return {
                "success": True,
                "created_count": 0,
                "skipped_count": 0,
                "errors": errors,
                "created_exclusions": []
            }
        
        # Step 2: Fetch ALL existing exclusions in ONE query
        existing_result = await db.execute(select(SchemaExclusion))
        existing_exclusions = existing_result.scalars().all()
        
        # Build a set of existing (catalog, schema, table) tuples for O(1) lookup
        existing_set = {
            (exc.catalog, exc.schema_name, exc.table_name)
            for exc in existing_exclusions
        }
        
        # Step 3: Filter out already-excluded items (in memory, no DB calls)
        new_exclusions = []
        skipped_count = 0
        for exc_data in valid_exclusions:
            key = (exc_data["catalog"], exc_data["schema_name"], exc_data["table_name"])
            if key in existing_set:
                skipped_count += 1
            else:
                new_exclusions.append(exc_data)
                existing_set.add(key)  # Prevent duplicates within this batch
        
        if not new_exclusions:
            return {
                "success": True,
                "created_count": 0,
                "skipped_count": skipped_count,
                "errors": errors,
                "created_exclusions": []
            }
        
        # Step 4: Bulk create all exclusion objects
        exclusion_objects = [
            SchemaExclusion(
                catalog=exc["catalog"],
                schema_name=exc["schema_name"],
                table_name=exc["table_name"],
                reason=exc["reason"],
                excluded_by=user_id
            )
            for exc in new_exclusions
        ]
        
        # Step 5: Bulk add and single flush (not N flushes)
        db.add_all(exclusion_objects)
        await db.flush()  # Single flush to get all IDs
        
        # Step 6: Build response
        created_exclusions = [
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
            for exc in exclusion_objects
        ]
        
        items_to_remove = [
            {
                "catalog": exc.catalog,
                "schema_name": exc.schema_name,
                "table_name": exc.table_name
            }
            for exc in exclusion_objects
        ]
        
        # Step 7: Commit to database
        await db.commit()
        
        logger.info(
            "Bulk exclusions completed",
            created_count=len(created_exclusions),
            skipped_count=skipped_count,
            error_count=len(errors),
            user_id=str(user_id)
        )
        
        # Step 8: Fire-and-forget schema service notification (non-blocking)
        # Don't await - let it run in background so API returns immediately
        if items_to_remove:
            asyncio.create_task(
                ExclusionService._notify_schema_service_batch_remove_items(items_to_remove)
            )
        
        return {
            "success": True,
            "created_count": len(created_exclusions),
            "skipped_count": skipped_count,
            "errors": errors,
            "created_exclusions": created_exclusions
        }
    
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
        
        Optimized incremental strategy (10-100x faster than full refresh):
        - Table-level: Incremental remove (~1-5s, rebuilds index once)
        - Schema-level: Batch remove all tables in schema (~2-10s, rebuilds index once)
        - Database-level: Batch remove all tables in database (~5-30s, rebuilds index once)
        
        Key optimization: Single DELETE call with wildcard matching removes all tables
        at once and rebuilds the index only once (instead of N rebuilds).
        """
        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
            
            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key
            
            async with httpx.AsyncClient() as client:
                # Use batch remove endpoint for all levels (table, schema, database)
                # The schema service will handle wildcard matching efficiently
                response = await client.post(
                    f"{schema_service_url}/table/batch-remove",
                    json={
                        "catalog": catalog,
                        "schema": schema_name,
                        "table": table_name
                    },
                    headers=headers,
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    removed_count = result.get('removed_count', 0)
                    level = "table" if table_name else ("schema" if schema_name else "database")
                    logger.info(
                        "Schema service: batch remove completed", 
                        level=level,
                        catalog=catalog,
                        schema=schema_name,
                        table=table_name,
                        removed_count=removed_count
                    )
                else:
                    logger.warning("Schema service: batch remove failed", 
                                 status=response.status_code)
                        
        except Exception as e:
            logger.error("Failed to notify schema service", error=str(e))
            # Don't raise - exclusion is still saved in DB
    
    @staticmethod
    async def _notify_schema_service_batch_remove_items(
        items: List[Dict[str, Any]]
    ):
        """
        Notify schema service to remove MULTIPLE resources in a SINGLE HTTP call.
        
        This is 10-100x faster than making N separate HTTP calls:
        - Single network round-trip instead of N
        - Schema service collects all matching tables
        - FAISS index is rebuilt only ONCE at the end
        
        Args:
            items: List of dicts with catalog, schema_name, table_name keys
        """
        if not items:
            return
            
        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
            
            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key
            
            async with httpx.AsyncClient() as client:
                # Use batch-remove-multi endpoint for all items at once
                response = await client.post(
                    f"{schema_service_url}/table/batch-remove-multi",
                    json=items,
                    headers=headers,
                    timeout=120.0  # Longer timeout for bulk operations
                )
                
                if response.status_code == 200:
                    result = response.json()
                    removed_count = result.get('removed_count', 0)
                    patterns_processed = result.get('patterns_processed', len(items))
                    logger.info(
                        "Schema service: batch remove multi completed", 
                        patterns_processed=patterns_processed,
                        removed_count=removed_count
                    )
                else:
                    logger.warning("Schema service: batch remove multi failed", 
                                 status=response.status_code)
                        
        except Exception as e:
            logger.error("Failed to notify schema service (batch remove multi)", error=str(e))
            # Don't raise - exclusions are still saved in DB
    
    @staticmethod
    async def _notify_schema_service_refresh(
        catalog: str,
        schema_name: Optional[str],
        table_name: Optional[str]
    ):
        """
        Notify schema service to add resource back to FAISS index (when exclusion is removed).
        
        Optimized incremental strategy (10-100x faster than full refresh):
        - Fetches only the specific tables that were unhidden
        - Adds them incrementally to FAISS (no full rebuild)
        - Much faster: 50ms-5s vs 10-30s for full refresh
        """
        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
            
            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key
            
            async with httpx.AsyncClient() as client:
                # Use batch add endpoint for efficient incremental addition
                response = await client.post(
                    f"{schema_service_url}/table/batch-add",
                    json={
                        "catalog": catalog,
                        "schema": schema_name,
                        "table": table_name
                    },
                    headers=headers,
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    added_count = result.get('added_count', 0)
                    level = "table" if table_name else ("schema" if schema_name else "database")
                    logger.info(
                        "Schema service: batch add completed after unhiding",
                        level=level,
                        catalog=catalog,
                        schema=schema_name,
                        table=table_name,
                        added_count=added_count
                    )
                else:
                    logger.warning("Schema service: batch add failed", status=response.status_code)
                    
        except Exception as e:
            logger.error("Failed to notify schema service for batch add", error=str(e))
            # Don't raise - exclusion removal is still saved in DB
