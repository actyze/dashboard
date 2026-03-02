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
        # Don't await - let it run in background so API returns immediately.
        # Single bulk request → schema service resolves all tables and rebuilds
        # FAISS exactly ONCE, avoiding the race condition of N concurrent calls.
        if items_to_remove:
            asyncio.create_task(
                ExclusionService._notify_schema_service_bulk_remove(items_to_remove)
            )

        return {
            "success": True,
            "created_count": len(created_exclusions),
            "skipped_count": skipped_count,
            "errors": errors,
            "created_exclusions": created_exclusions
        }

    @staticmethod
    async def bulk_remove_exclusions(
        db: AsyncSession,
        exclusion_ids: List[int]
    ) -> Dict[str, Any]:
        """
        Bulk remove exclusions (unhide) efficiently.

        Optimizations:
        - Single query to fetch all target exclusions
        - Bulk delete in one transaction
        - Non-blocking schema service notification (fire-and-forget)
        - Single /table/bulk-batch-add call → ONE FAISS rebuild regardless of count

        Args:
            db: Database session
            exclusion_ids: List of exclusion IDs to remove

        Returns:
            Summary with removed_count, errors, and removed_exclusions
        """
        if not exclusion_ids:
            return {
                "success": True,
                "removed_count": 0,
                "errors": [],
                "removed_exclusions": []
            }

        errors = []

        # Step 1: Fetch all target exclusions in ONE query
        result = await db.execute(
            select(SchemaExclusion).where(SchemaExclusion.id.in_(exclusion_ids))
        )
        found = result.scalars().all()

        # Report missing IDs
        found_ids = {exc.id for exc in found}
        for eid in exclusion_ids:
            if eid not in found_ids:
                errors.append(f"Exclusion {eid} not found")

        if not found:
            return {
                "success": True,
                "removed_count": 0,
                "errors": errors,
                "removed_exclusions": []
            }

        # Step 2: Build response before deleting (need data after delete)
        removed_exclusions = [
            {
                "id": exc.id,
                "catalog": exc.catalog,
                "schema_name": exc.schema_name,
                "table_name": exc.table_name,
                "full_path": ExclusionService._build_full_path(exc.catalog, exc.schema_name, exc.table_name),
                "level": ExclusionService._get_level(exc.schema_name, exc.table_name),
            }
            for exc in found
        ]

        items_to_add = [
            {
                "catalog": exc.catalog,
                "schema_name": exc.schema_name,
                "table_name": exc.table_name,
            }
            for exc in found
        ]

        # Step 3: Bulk delete in one transaction
        for exc in found:
            await db.delete(exc)
        await db.commit()

        logger.info(
            "Bulk exclusions removed",
            removed_count=len(removed_exclusions),
            error_count=len(errors)
        )

        # Step 4: Fire-and-forget schema service notification (non-blocking)
        # Single bulk request → schema service fetches all tables from Trino
        # and rebuilds FAISS exactly ONCE.
        if items_to_add:
            asyncio.create_task(
                ExclusionService._notify_schema_service_bulk_add(items_to_add)
            )

        return {
            "success": True,
            "removed_count": len(removed_exclusions),
            "errors": errors,
            "removed_exclusions": removed_exclusions
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
    async def _notify_schema_service_bulk_remove(items: List[Dict[str, Any]]):
        """
        Notify schema service to remove multiple resources from FAISS in ONE request.

        Fixes the race condition in bulk hide: instead of N concurrent calls each
        triggering their own FAISS rebuild (overwriting each other), this sends a
        single /table/bulk-batch-remove request so the schema service resolves all
        matching tables and rebuilds the FAISS index exactly ONCE.
        """
        if not items:
            return

        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")

            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key

            payload = {
                "items": [
                    {
                        "catalog": item["catalog"],
                        "schema": item["schema_name"],
                        "table": item["table_name"],
                    }
                    for item in items
                ]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{schema_service_url}/table/bulk-batch-remove",
                    json=payload,
                    headers=headers,
                    timeout=120.0,
                )

            if response.status_code == 200:
                result = response.json()
                logger.info(
                    "Schema service: bulk batch remove completed",
                    item_count=len(items),
                    removed_count=result.get("removed_count", 0),
                    index_size=result.get("index_size"),
                )
            else:
                logger.warning(
                    "Schema service: bulk batch remove failed",
                    status=response.status_code,
                )

        except Exception as e:
            logger.error("Failed to notify schema service (bulk remove)", error=str(e))
            # Don't raise — exclusions are already saved in DB

    @staticmethod
    async def _notify_schema_service_bulk_add(items: List[Dict[str, Any]]):
        """
        Notify schema service to add multiple resources back to FAISS in ONE request.

        Symmetric to _notify_schema_service_bulk_remove — ensures all unhides
        (single or multi) trigger exactly one Trino fetch + one FAISS rebuild.
        """
        if not items:
            return

        try:
            schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
            service_key = os.getenv("SCHEMA_SERVICE_KEY", "")

            headers = {}
            if service_key:
                headers["X-Service-Key"] = service_key

            payload = {
                "items": [
                    {
                        "catalog": item["catalog"],
                        "schema": item["schema_name"],
                        "table": item["table_name"],
                    }
                    for item in items
                ]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{schema_service_url}/table/bulk-batch-add",
                    json=payload,
                    headers=headers,
                    timeout=120.0,
                )

            if response.status_code == 200:
                result = response.json()
                logger.info(
                    "Schema service: bulk batch add completed",
                    item_count=len(items),
                    added_count=result.get("added_count", 0),
                    index_size=result.get("index_size"),
                )
            else:
                logger.warning(
                    "Schema service: bulk batch add failed",
                    status=response.status_code,
                )

        except Exception as e:
            logger.error("Failed to notify schema service (bulk add)", error=str(e))
            # Don't raise — exclusion removals are already saved in DB
