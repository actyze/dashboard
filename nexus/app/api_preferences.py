"""User Preferences API - Manage user-specific schema/table preferences."""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
import structlog
from app.auth.dependencies import get_current_user, require_write_access
from app.services.preference_service import preference_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api/preferences", tags=["User Preferences"])


class PreferenceInput(BaseModel):
    """Input for adding a new preference."""
    catalog: Optional[str] = Field(default=None, description="Database catalog")
    database_name: Optional[str] = Field(default=None, description="Database name")
    schema_name: Optional[str] = Field(default=None, description="Schema name")
    table_name: Optional[str] = Field(default=None, description="Table name (NULL = entire schema)")
    preferred_columns: Optional[List[str]] = Field(default=None, description="Specific columns (NULL = all)")
    boost_weight: float = Field(default=1.5, ge=1.0, le=3.0, description="Boost multiplier (1.0-3.0)")


class PreferenceResponse(BaseModel):
    """Response for preference."""
    id: str
    catalog: Optional[str]
    database_name: Optional[str]
    schema_name: Optional[str]
    table_name: Optional[str]
    preferred_columns: List[str]
    boost_weight: float
    created_at: Optional[str]
    updated_at: Optional[str]


class BoostWeightUpdate(BaseModel):
    """Input for updating boost weight."""
    boost_weight: float = Field(..., ge=1.0, le=3.0, description="Boost multiplier (1.0-3.0)")


@router.get("", response_model=List[PreferenceResponse])
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    """Get all schema/table preferences for the current user."""
    try:
        preferences = await preference_service.get_user_preferences(str(current_user["id"]))
        return preferences
    except Exception as e:
        logger.error("Failed to get user preferences", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve preferences")


@router.post("")
async def add_user_preference(
    preference: PreferenceInput,
    current_user: dict = Depends(require_write_access)
):
    """Add a new schema/table preference for the current user."""
    try:
        result = await preference_service.add_user_preference(
            user_id=str(current_user["id"]),
            catalog=preference.catalog,
            database_name=preference.database_name,
            schema_name=preference.schema_name,
            table_name=preference.table_name,
            preferred_columns=preference.preferred_columns,
            boost_weight=preference.boost_weight
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to add preference"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add user preference", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to add preference")


@router.delete("/{preference_id}")
async def delete_user_preference(
    preference_id: str,
    current_user: dict = Depends(require_write_access)
):
    """Delete a schema/table preference."""
    try:
        result = await preference_service.delete_user_preference(
            user_id=str(current_user["id"]),
            preference_id=preference_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Preference not found"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete user preference", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete preference")


@router.patch("/{preference_id}/boost")
async def update_preference_boost(
    preference_id: str,
    update: BoostWeightUpdate,
    current_user: dict = Depends(require_write_access)
):
    """Update the boost weight for a preference."""
    try:
        result = await preference_service.update_preference_boost(
            user_id=str(current_user["id"]),
            preference_id=preference_id,
            boost_weight=update.boost_weight
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Preference not found"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update preference boost", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update boost weight")

