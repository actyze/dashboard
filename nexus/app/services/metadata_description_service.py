"""
Service for managing org-level metadata descriptions.
Supports descriptions at catalog, schema, table, and column levels.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import structlog

logger = structlog.get_logger(__name__)


class MetadataDescriptionService:
    """Service for managing metadata descriptions across the data hierarchy."""
    
    @staticmethod
    async def add_description(
        db: AsyncSession,
        user_id: str,
        catalog: str,
        description: str,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        column_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a metadata description at any hierarchy level.
        
        Args:
            db: Database session
            user_id: UUID of the user adding the description
            catalog: Catalog name
            description: The description text
            schema_name: Optional schema name
            table_name: Optional table name (requires schema_name)
            column_name: Optional column name (requires table_name)
        
        Returns:
            Dict with success status and description id
        """
        try:
            # Validate hierarchy
            if column_name and not table_name:
                return {"success": False, "error": "Column requires table_name"}
            if table_name and not schema_name:
                return {"success": False, "error": "Table requires schema_name"}
            
            query = text("""
                INSERT INTO nexus.metadata_descriptions 
                    (catalog, schema_name, table_name, column_name, description, created_by, updated_by)
                VALUES 
                    (:catalog, :schema_name, :table_name, :column_name, :description, :user_id, :user_id)
                ON CONFLICT (catalog, schema_name, table_name, column_name) 
                DO UPDATE SET 
                    description = EXCLUDED.description,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, created_at, updated_at
            """)
            
            result = await db.execute(query, {
                "catalog": catalog,
                "schema_name": schema_name,
                "table_name": table_name,
                "column_name": column_name,
                "description": description,
                "user_id": user_id
            })
            await db.commit()
            
            row = result.fetchone()
            
            # Log to audit history
            await MetadataDescriptionService._log_history(
                db, row.id, "created" if row.created_at == row.updated_at else "updated",
                None, description, user_id
            )
            
            logger.info("metadata_description_added",
                       catalog=catalog,
                       schema=schema_name,
                       table=table_name,
                       column=column_name,
                       user_id=user_id)
            
            return {
                "success": True,
                "id": row.id,
                "message": "Description added successfully"
            }
            
        except Exception as e:
            await db.rollback()
            logger.error("add_description_error", error=str(e))
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def update_description(
        db: AsyncSession,
        description_id: int,
        user_id: str,
        new_description: str
    ) -> Dict[str, Any]:
        """
        Update an existing metadata description.
        
        Args:
            db: Database session
            description_id: ID of the description to update
            user_id: UUID of the user updating
            new_description: New description text
        
        Returns:
            Dict with success status
        """
        try:
            # Get old description for audit
            old_query = text("""
                SELECT description FROM nexus.metadata_descriptions WHERE id = :id
            """)
            old_result = await db.execute(old_query, {"id": description_id})
            old_row = old_result.fetchone()
            
            if not old_row:
                return {"success": False, "error": "Description not found"}
            
            old_description = old_row.description
            
            # Update description
            update_query = text("""
                UPDATE nexus.metadata_descriptions
                SET description = :description,
                    updated_by = :user_id,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                RETURNING id
            """)
            
            result = await db.execute(update_query, {
                "id": description_id,
                "description": new_description,
                "user_id": user_id
            })
            await db.commit()
            
            if result.rowcount == 0:
                return {"success": False, "error": "Description not found"}
            
            # Log to audit history
            await MetadataDescriptionService._log_history(
                db, description_id, "updated",
                old_description, new_description, user_id
            )
            
            logger.info("metadata_description_updated",
                       description_id=description_id,
                       user_id=user_id)
            
            return {"success": True, "message": "Description updated successfully"}
            
        except Exception as e:
            await db.rollback()
            logger.error("update_description_error", error=str(e))
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def delete_description(
        db: AsyncSession,
        description_id: int,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Delete a metadata description.
        
        Args:
            db: Database session
            description_id: ID of the description to delete
            user_id: UUID of the user deleting
        
        Returns:
            Dict with success status
        """
        try:
            # Get description for audit before deleting
            select_query = text("""
                SELECT description FROM nexus.metadata_descriptions WHERE id = :id
            """)
            select_result = await db.execute(select_query, {"id": description_id})
            select_row = select_result.fetchone()
            
            if not select_row:
                return {"success": False, "error": "Description not found"}
            
            old_description = select_row.description
            
            # Log to history before deleting
            await MetadataDescriptionService._log_history(
                db, description_id, "deleted",
                old_description, None, user_id
            )
            
            # Delete description
            delete_query = text("""
                DELETE FROM nexus.metadata_descriptions WHERE id = :id
            """)
            result = await db.execute(delete_query, {"id": description_id})
            await db.commit()
            
            if result.rowcount == 0:
                return {"success": False, "error": "Description not found"}
            
            logger.info("metadata_description_deleted",
                       description_id=description_id,
                       user_id=user_id)
            
            return {"success": True, "message": "Description deleted successfully"}
            
        except Exception as e:
            await db.rollback()
            logger.error("delete_description_error", error=str(e))
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def get_description(
        db: AsyncSession,
        catalog: str,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        column_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific metadata description.
        
        Returns:
            Dict with description details or None if not found
        """
        try:
            query = text("""
                SELECT 
                    id, catalog, schema_name, table_name, column_name,
                    description, created_by, updated_by,
                    created_at, updated_at
                FROM nexus.metadata_descriptions
                WHERE catalog = :catalog
                    AND (schema_name IS NOT DISTINCT FROM :schema_name)
                    AND (table_name IS NOT DISTINCT FROM :table_name)
                    AND (column_name IS NOT DISTINCT FROM :column_name)
            """)
            
            result = await db.execute(query, {
                "catalog": catalog,
                "schema_name": schema_name,
                "table_name": table_name,
                "column_name": column_name
            })
            
            row = result.fetchone()
            if not row:
                return None
            
            return {
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
            
        except Exception as e:
            logger.error("get_description_error", error=str(e))
            return None
    
    @staticmethod
    async def get_descriptions_by_catalog(
        db: AsyncSession,
        catalog: str
    ) -> List[Dict[str, Any]]:
        """
        Get all descriptions for a given catalog (all levels).
        
        Returns:
            List of description dicts
        """
        try:
            query = text("""
                SELECT 
                    id, catalog, schema_name, table_name, column_name,
                    description, created_by, updated_by,
                    created_at, updated_at
                FROM nexus.metadata_descriptions
                WHERE catalog = :catalog
                ORDER BY 
                    COALESCE(schema_name, ''),
                    COALESCE(table_name, ''),
                    COALESCE(column_name, '')
            """)
            
            result = await db.execute(query, {"catalog": catalog})
            rows = result.fetchall()
            
            descriptions = []
            for row in rows:
                descriptions.append({
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
                })
            
            return descriptions
            
        except Exception as e:
            logger.error("get_descriptions_by_catalog_error", error=str(e))
            return []
    
    @staticmethod
    async def get_all_descriptions(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Get all metadata descriptions (for schema service to include in embeddings).
        
        Returns:
            List of all description dicts
        """
        try:
            query = text("""
                SELECT 
                    id, catalog, schema_name, table_name, column_name,
                    description, created_at, updated_at
                FROM nexus.metadata_descriptions
                ORDER BY catalog, schema_name, table_name, column_name
            """)
            
            result = await db.execute(query)
            rows = result.fetchall()
            
            descriptions = []
            for row in rows:
                descriptions.append({
                    "id": row.id,
                    "catalog": row.catalog,
                    "schema_name": row.schema_name,
                    "table_name": row.table_name,
                    "column_name": row.column_name,
                    "description": row.description,
                    "created_at": row.created_at.isoformat(),
                    "updated_at": row.updated_at.isoformat()
                })
            
            return descriptions
            
        except Exception as e:
            logger.error("get_all_descriptions_error", error=str(e))
            return []
    
    @staticmethod
    async def _log_history(
        db: AsyncSession,
        description_id: int,
        action: str,
        old_description: Optional[str],
        new_description: Optional[str],
        user_id: str
    ):
        """Log change to audit history table."""
        try:
            query = text("""
                INSERT INTO nexus.metadata_description_history
                    (description_id, action, old_description, new_description, changed_by)
                VALUES
                    (:description_id, :action, :old_description, :new_description, :user_id)
            """)
            
            await db.execute(query, {
                "description_id": description_id,
                "action": action,
                "old_description": old_description,
                "new_description": new_description,
                "user_id": user_id
            })
            await db.commit()
            
        except Exception as e:
            logger.error("log_history_error", error=str(e))


# Singleton instance
metadata_description_service = MetadataDescriptionService()

