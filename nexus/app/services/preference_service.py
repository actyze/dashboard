"""User Preferences Service - Manages user-specific schema/table/column preferences for recommendation boosting."""

import structlog
from typing import List, Dict, Any, Optional
from sqlalchemy import select, delete, and_
from sqlalchemy.exc import IntegrityError
from app.database import db_manager, UserSchemaPreference

logger = structlog.get_logger()


class PreferenceService:
    """Service for managing user preferences to boost schema recommendations."""
    
    def __init__(self):
        self.logger = logger.bind(service="preference-service")
    
    async def get_user_preferences(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all preferences for a user."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserSchemaPreference).where(UserSchemaPreference.user_id == user_id)
                )
                preferences = result.scalars().all()
                
                return [
                    {
                        "id": str(pref.id),
                        "catalog": pref.catalog,
                        "database_name": pref.database_name,
                        "schema_name": pref.schema_name,
                        "table_name": pref.table_name,
                        "preferred_columns": pref.preferred_columns or [],
                        "boost_weight": float(pref.boost_weight),
                        "created_at": pref.created_at.isoformat() if pref.created_at else None,
                        "updated_at": pref.updated_at.isoformat() if pref.updated_at else None
                    }
                    for pref in preferences
                ]
            except Exception as e:
                self.logger.error("Failed to get user preferences", user_id=user_id, error=str(e))
                raise
    
    async def add_user_preference(
        self,
        user_id: str,
        catalog: Optional[str] = None,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        preferred_columns: Optional[List[str]] = None,
        boost_weight: float = 1.5
    ) -> Dict[str, Any]:
        """Add a new user preference."""
        async with db_manager.get_session() as session:
            try:
                preference = UserSchemaPreference(
                    user_id=user_id,
                    catalog=catalog,
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name,
                    preferred_columns=preferred_columns,
                    boost_weight=boost_weight
                )
                
                session.add(preference)
                await session.commit()
                await session.refresh(preference)
                
                self.logger.info(
                    "User preference added",
                    user_id=user_id,
                    catalog=catalog,
                    database=database_name,
                    schema=schema_name,
                    table=table_name
                )
                
                return {
                    "success": True,
                    "id": str(preference.id),
                    "message": "Preference added successfully"
                }
            except IntegrityError:
                await session.rollback()
                self.logger.warning(
                    "Duplicate preference",
                    user_id=user_id,
                    catalog=catalog,
                    database=database_name,
                    schema=schema_name,
                    table=table_name
                )
                return {
                    "success": False,
                    "error": "This preference already exists"
                }
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to add preference", error=str(e))
                raise
    
    async def delete_user_preference(self, user_id: str, preference_id: str) -> Dict[str, Any]:
        """Delete a user preference."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    delete(UserSchemaPreference).where(
                        and_(
                            UserSchemaPreference.id == preference_id,
                            UserSchemaPreference.user_id == user_id
                        )
                    )
                )
                
                await session.commit()
                
                if result.rowcount > 0:
                    self.logger.info("User preference deleted", user_id=user_id, preference_id=preference_id)
                    return {"success": True, "message": "Preference deleted successfully"}
                else:
                    return {"success": False, "error": "Preference not found"}
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to delete preference", error=str(e))
                raise
    
    async def update_preference_boost(
        self,
        user_id: str,
        preference_id: str,
        boost_weight: float
    ) -> Dict[str, Any]:
        """Update the boost weight for a preference."""
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
                    return {"success": False, "error": "Preference not found"}
                
                preference.boost_weight = boost_weight
                await session.commit()
                
                self.logger.info(
                    "Preference boost updated",
                    user_id=user_id,
                    preference_id=preference_id,
                    boost=boost_weight
                )
                
                return {"success": True, "message": "Boost weight updated successfully"}
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to update preference boost", error=str(e))
                raise
    
    def get_boost_map(self, preferences: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Convert preferences list to a lookup map for fast schema recommendation boosting.
        
        Returns:
            Dict with keys like "database.schema.table" or "database.schema" mapped to boost_weight
        """
        boost_map = {}
        
        for pref in preferences:
            database = pref.get("database_name", "")
            schema = pref.get("schema_name", "")
            table = pref.get("table_name")
            boost = pref.get("boost_weight", 1.5)
            
            if table:
                # Specific table preference
                key = f"{database}.{schema}.{table}"
                boost_map[key] = boost
            elif schema:
                # Entire schema preference
                key = f"{database}.{schema}"
                boost_map[key] = boost
            elif database:
                # Entire database preference
                boost_map[database] = boost
        
        return boost_map


# Global instance
preference_service = PreferenceService()

