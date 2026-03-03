"""User Preferences Service - Manages user-specific preferred tables for AI query prioritization."""

import structlog
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy import select, and_, func
from sqlalchemy.exc import IntegrityError
from app.database import db_manager, UserSchemaPreference
from app.config import settings

logger = structlog.get_logger()


class PreferenceService:
    """Service for managing user preferred tables for AI prioritization."""
    
    def __init__(self):
        self.logger = logger.bind(service="preference-service")
        self.schema_service_client = httpx.AsyncClient(timeout=30.0)
    
    # ============================================================================
    # Preferred Tables Feature
    # ============================================================================
    
    async def get_user_preferred_tables(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all preferred tables for a user (table-level only, is_preferred=TRUE).
        Slim response - identifiers only. Columns/metadata stay in DB for LLM use.
        
        Returns:
            List of preferred table identifiers (no columns_metadata - frontend doesn't need it)
        """
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserSchemaPreference).where(
                        and_(
                            UserSchemaPreference.user_id == user_id,
                            UserSchemaPreference.is_preferred == True,
                            UserSchemaPreference.table_name.isnot(None)  # Only table-level preferences
                        )
                    ).order_by(UserSchemaPreference.updated_at.desc())
                )
                preferences = result.scalars().all()
                
                preferred_tables = []
                for pref in preferences:
                    # Only return identifiers - columns_metadata is used internally by LLM orchestration
                    preferred_tables.append({
                        "id": str(pref.id),
                        "catalog": pref.catalog,
                        "database_name": pref.database_name,
                        "schema_name": pref.schema_name,
                        "table_name": pref.table_name,
                        "full_name": f"{pref.database_name}.{pref.schema_name}.{pref.table_name}",
                        "created_at": pref.created_at.isoformat() if pref.created_at else None,
                        "updated_at": pref.updated_at.isoformat() if pref.updated_at else None
                    })
                
                self.logger.info("Retrieved preferred tables", user_id=user_id, count=len(preferred_tables))
                return preferred_tables
                
            except Exception as e:
                self.logger.error("Failed to get preferred tables", user_id=user_id, error=str(e))
                raise
    
    async def get_user_preferred_tables_with_metadata(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get preferred tables WITH full columns_metadata for LLM orchestration.
        Used internally by orchestration_service - NOT exposed via API.
        
        Returns:
            List of preferred tables with full column metadata for AI context
        """
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserSchemaPreference).where(
                        and_(
                            UserSchemaPreference.user_id == user_id,
                            UserSchemaPreference.is_preferred == True,
                            UserSchemaPreference.table_name.isnot(None)
                        )
                    ).order_by(UserSchemaPreference.updated_at.desc())
                )
                preferences = result.scalars().all()
                
                preferred_tables = []
                for pref in preferences:
                    preferred_tables.append({
                        "id": str(pref.id),
                        "catalog": pref.catalog,
                        "database_name": pref.database_name,
                        "schema_name": pref.schema_name,
                        "table_name": pref.table_name,
                        "full_name": f"{pref.database_name}.{pref.schema_name}.{pref.table_name}",
                        "columns_metadata": pref.columns_metadata or [],
                        "table_metadata": pref.table_metadata,
                    })
                
                self.logger.info("Retrieved preferred tables with metadata for LLM", 
                               user_id=user_id, count=len(preferred_tables))
                return preferred_tables
                
            except Exception as e:
                self.logger.error("Failed to get preferred tables with metadata", user_id=user_id, error=str(e))
                raise
    
    
    async def _get_preferred_count(self, user_id: str) -> int:
        """Internal: count preferred tables for limit checking."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                select(func.count()).select_from(UserSchemaPreference).where(
                    and_(
                        UserSchemaPreference.user_id == user_id,
                        UserSchemaPreference.is_preferred == True,
                        UserSchemaPreference.table_name.isnot(None)
                    )
                )
            )
            return result.scalar() or 0

    async def add_preferred_table(
        self,
        user_id: str,
        catalog: str,
        database_name: str,
        schema_name: str,
        table_name: str
    ) -> Dict[str, Any]:
        """
        Add a table to user's preferred list.
        Fetches full metadata from schema service and stores it.
        
        Returns:
            Dict with success status and preference_id
        """
        async with db_manager.get_session() as session:
            try:
                # Check current count
                current_count = await self._get_preferred_count(user_id)
                if current_count >= settings.max_preferred_tables:
                    return {
                        "success": False,
                        "error": f"Maximum number of preferred tables ({settings.max_preferred_tables}) exceeded"
                    }
                
                # Fetch full table metadata from schema service
                try:
                    metadata_response = await self._fetch_table_metadata(catalog, schema_name, table_name)
                    
                    if not metadata_response.get("success"):
                        return {
                            "success": False,
                            "error": f"Failed to fetch table metadata: {metadata_response.get('error', 'Unknown error')}"
                        }
                    
                    columns_metadata = metadata_response.get("columns", [])
                    table_description = metadata_response.get("table_description")
                    connector_type = metadata_response.get("connector_type")
                    
                except Exception as e:
                    self.logger.warning("Failed to fetch metadata from schema service", error=str(e))
                    columns_metadata = []
                    table_description = None
                    connector_type = None
                
                # Create or update preference
                # Check if preference already exists
                result = await session.execute(
                    select(UserSchemaPreference).where(
                        and_(
                            UserSchemaPreference.user_id == user_id,
                            UserSchemaPreference.database_name == database_name,
                            UserSchemaPreference.schema_name == schema_name,
                            UserSchemaPreference.table_name == table_name
                        )
                    )
                )
                existing_pref = result.scalar_one_or_none()
                
                if existing_pref:
                    # Update existing preference
                    existing_pref.is_preferred = True
                    existing_pref.columns_metadata = columns_metadata
                    existing_pref.table_metadata = table_description
                    existing_pref.catalog = catalog
                    
                    await session.commit()
                    await session.refresh(existing_pref)
                    
                    self.logger.info("Updated existing preference to preferred", 
                                   user_id=user_id,
                                   table=f"{database_name}.{schema_name}.{table_name}")
                    
                    return {
                        "success": True,
                        "preference_id": str(existing_pref.id),
                        "message": "Table marked as preferred",
                        "columns_count": len(columns_metadata)
                    }
                else:
                    # Create new preference
                    preference = UserSchemaPreference(
                        user_id=user_id,
                        catalog=catalog,
                        database_name=database_name,
                        schema_name=schema_name,
                        table_name=table_name,
                        is_preferred=True,
                        columns_metadata=columns_metadata,
                        table_metadata=table_description
                    )
                    
                    session.add(preference)
                    await session.commit()
                    await session.refresh(preference)
                    
                    self.logger.info("Added new preferred table",
                                   user_id=user_id,
                                   table=f"{database_name}.{schema_name}.{table_name}",
                                   columns_count=len(columns_metadata))
                    
                    return {
                        "success": True,
                        "preference_id": str(preference.id),
                        "message": "Table added to preferred list",
                        "columns_count": len(columns_metadata)
                    }
                
            except IntegrityError:
                await session.rollback()
                self.logger.warning("Duplicate preferred table entry", user_id=user_id)
                return {
                    "success": False,
                    "error": "This table is already in your preferred list"
                }
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to add preferred table", error=str(e), user_id=user_id)
                raise
    
    async def remove_preferred_table(self, user_id: str, preference_id: str) -> Dict[str, Any]:
        """Remove a table from preferred list (marks as not preferred or deletes)."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserSchemaPreference).where(
                        and_(
                            UserSchemaPreference.id == preference_id,
                            UserSchemaPreference.user_id == user_id
                        )
                    )
                )
                preference = result.scalar_one_or_none()
                
                if not preference:
                    return {"success": False, "error": "Preferred table not found"}
                
                # Delete the preference entirely (clean system)
                await session.delete(preference)
                await session.commit()
                
                self.logger.info("Removed preferred table", 
                               user_id=user_id,
                               preference_id=preference_id,
                               table=f"{preference.database_name}.{preference.schema_name}.{preference.table_name}")
                
                return {"success": True, "message": "Table removed from preferred list"}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to remove preferred table", error=str(e))
                raise
    
    async def bulk_add_preferred_tables(
        self,
        user_id: str,
        tables: List[Dict[str, str]]  # list of {catalog, database_name, schema_name, table_name}
    ) -> Dict[str, Any]:
        """
        Add multiple tables to preferred list in one operation.
        Respects MAX_PREFERRED_TABLES limit across the whole batch.
        
        Returns:
            Dict with added_count, skipped_count, errors list
        """
        current_count = await self._get_preferred_count(user_id)
        remaining_slots = settings.max_preferred_tables - current_count

        added = []
        skipped = []
        errors = []

        for entry in tables:
            catalog = entry["catalog"]
            database_name = entry["database_name"]
            schema_name = entry["schema_name"]
            table_name = entry["table_name"]
            full_name = f"{database_name}.{schema_name}.{table_name}"

            if len(added) >= remaining_slots:
                skipped.append({"table": full_name, "reason": "limit_reached"})
                continue

            try:
                result = await self.add_preferred_table(
                    user_id=user_id,
                    catalog=catalog,
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name
                )
                if result.get("success"):
                    added.append(full_name)
                else:
                    skipped.append({"table": full_name, "reason": result.get("error", "already preferred")})
            except Exception as e:
                errors.append({"table": full_name, "error": str(e)})

        self.logger.info("Bulk add preferred tables", user_id=user_id,
                        added=len(added), skipped=len(skipped), errors=len(errors))
        return {
            "success": True,
            "added_count": len(added),
            "skipped_count": len(skipped),
            "error_count": len(errors),
            "errors": errors
        }

    async def bulk_remove_preferred_tables(
        self,
        user_id: str,
        preference_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Remove multiple preferred tables by their preference IDs.
        
        Returns:
            Dict with removed_count, not_found_count
        """
        removed = 0
        not_found = 0
        errors = []

        for preference_id in preference_ids:
            try:
                result = await self.remove_preferred_table(user_id=user_id, preference_id=preference_id)
                if result.get("success"):
                    removed += 1
                else:
                    not_found += 1
            except Exception as e:
                errors.append({"id": preference_id, "error": str(e)})

        self.logger.info("Bulk remove preferred tables", user_id=user_id,
                        removed=removed, not_found=not_found)
        return {
            "success": True,
            "removed_count": removed,
            "not_found_count": not_found,
            "error_count": len(errors),
            "errors": errors
        }

    async def _fetch_table_metadata(self, catalog: str, schema: str, table: str) -> Dict[str, Any]:
        """
        Fetch full table metadata from schema service.
        
        Returns:
            Dict with columns, table_description, connector_type
        """
        try:
            # Build schema service URL
            schema_service_url = settings.schema_service_url
            url = f"{schema_service_url}/table/metadata"
            
            # Prepare request
            payload = {
                "catalog": catalog,
                "schema": schema,
                "table": table
            }
            
            headers = {}
            # Add service key if configured
            if hasattr(settings, 'schema_service_key') and settings.schema_service_key:
                headers["X-Service-Key"] = settings.schema_service_key
            
            self.logger.info("Fetching table metadata from schema service",
                           catalog=catalog, schema=schema, table=table)
            
            response = await self.schema_service_client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            self.logger.error("Failed to fetch table metadata from schema service", error=str(e))
            return {
                "success": False,
                "error": str(e)
            }
    
    async def close(self):
        """Close HTTP client."""
        await self.schema_service_client.aclose()


# Global instance
preference_service = PreferenceService()
