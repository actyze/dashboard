"""License management API endpoints - Simplified."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import structlog

from app.auth.dependencies import get_current_user, require_admin
from app.services.license_service import LicenseService
from app.database import PlanType

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/license", tags=["license"])
license_service = LicenseService()


# ============================================================================
# Request/Response Models
# ============================================================================

class LicenseActivate(BaseModel):
    """Request model for activating a license."""
    license_key: str = Field(..., description="64-character license key", min_length=64, max_length=64)


class LicenseResponse(BaseModel):
    """Response model for license details."""
    id: str
    status: str
    plan_type: str
    max_users: Optional[int]
    issued_at: str
    expires_at: Optional[str]
    last_validated_at: Optional[str]
    is_valid: bool


# ============================================================================
# License Management Endpoints (Admin Only)
# ============================================================================

@router.post("/activate", dependencies=[Depends(require_admin)])
async def activate_license(
    license_data: LicenseActivate,
    current_user: dict = Depends(get_current_user)
):
    """
    Activate a license key (atomically disable previous).
    Admin only.
    """
    try:
        result = await license_service.activate_license(
            license_key=license_data.license_key,
            actor_user_id=current_user["id"]
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to activate license")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to activate license", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate license: {str(e)}"
        )


@router.get("/current", dependencies=[Depends(require_admin)])
async def get_current_license(current_user: dict = Depends(get_current_user)):
    """
    Get currently active license.
    Admin only.
    """
    try:
        result = await license_service.get_active_license()
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "No active license found")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get current license", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get current license: {str(e)}"
        )


@router.post("/validate", dependencies=[Depends(require_admin)])
async def validate_license(
    force: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Validate current license and refresh details.
    Admin only.
    """
    try:
        result = await license_service.validate_license(force=force)
        
        return result
        
    except Exception as e:
        logger.error("Failed to validate license", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate license: {str(e)}"
        )


@router.get("/plans/current")
async def get_current_plan(current_user: dict = Depends(get_current_user)):
    """
    Get current plan limits and details.
    """
    try:
        result = await license_service.get_plan_limits()
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "No plan limits found")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get plan limits", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get plan limits: {str(e)}"
        )
