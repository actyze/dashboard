"""License management API endpoints - Simplified."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import structlog
import httpx

from app.auth.dependencies import get_current_user, require_admin, require_viewer
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


class LicenseValidateExternal(BaseModel):
    """Request model for external license validation."""
    license_key: str = Field(..., description="64-character license key")


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


@router.get("/current", dependencies=[Depends(require_viewer)])
async def get_current_license(current_user: dict = Depends(get_current_user)):
    """
    Get currently active license.
    All authenticated users can view.
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


@router.post("/validate-external", dependencies=[Depends(require_admin)])
async def validate_license_external(
    request: LicenseValidateExternal,
    current_user: dict = Depends(get_current_user)
):
    """
    Validate a license key with Actyze.ai (server-to-server).
    Makes API call to actyze.ai with hardcoded API key (never exposed to frontend).
    Admin only.
    """
    # Actyze's API key - hardcoded, same for all customers (server-side only)
    ACTYZE_API_KEY = "e7cc1f4d3517eed3a22619f2daba13685ebf704f6b8f5771afb3df4c9406e57c"
    # Production API URL (app.actyze.ai hosts the Next.js marketing dashboard with API routes)
    ACTYZE_API_URL = "https://app.actyze.ai/api/validate-license"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ACTYZE_API_URL,
                json={
                    "license_key": request.license_key,
                    "increment_usage": False
                },
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": ACTYZE_API_KEY
                }
            )
            
            if response.status_code != 200:
                error_detail = response.json() if response.text else {}
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_detail.get("error", f"Validation failed with status {response.status_code}")
                )
            
            return response.json()
            
    except httpx.TimeoutException:
        logger.error("Timeout validating license with Actyze.ai")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout connecting to Actyze.ai"
        )
    except httpx.RequestError as e:
        logger.error("Network error validating license with Actyze.ai", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to Actyze.ai: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to validate license with Actyze.ai", error=str(e))
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
