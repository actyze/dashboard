"""License check API for initial setup - Available to all authenticated users."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import structlog
import httpx

from app.services.license_service import LicenseService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/license-check", tags=["license-check"])
license_service = LicenseService()


class LicenseInput(BaseModel):
    """Request model for adding initial license."""
    license_key: str = Field(..., description="64-character license key from actyze.ai dashboard", min_length=64, max_length=64)


@router.get("/status")
async def check_license_status():
    """
    Check if any license exists in the system.
    PUBLIC endpoint - no authentication required.
    Used on app startup (before login) to determine if license dialog should be shown.
    Returns complete license information including pricing from database (cached, validated every 6 hours).
    """
    try:
        result = await license_service.get_active_license()
        
        return {
            "has_license": result["success"],
            "license": result.get("license") if result["success"] else None
        }
        
    except Exception as e:
        logger.error("Failed to check license status", error=str(e))
        # Don't fail the request, just return no license
        return {
            "has_license": False,
            "license": None
        }


@router.post("/add-initial")
async def add_initial_license(
    license_input: LicenseInput
):
    """
    Add or replace a license in the system.
    PUBLIC endpoint - no authentication required (bootstrap case).
    Works for both initial setup and license upgrades/changes.
    
    Workflow:
    1. Validate license key with actyze.ai API
    2. Deactivate any existing active license
    3. Save new license details to database
    4. Activate the new license
    """
    
    # Actyze's API key - hardcoded, same for all customers (server-side only)
    ACTYZE_API_KEY = "REDACTED_API_KEY"
    # Production API URL (app.actyze.ai hosts the Next.js marketing dashboard with API routes)
    ACTYZE_API_URL = "https://app.actyze.ai/api/validate-license"
    
    try:
        # Step 1: Validate license with Actyze.ai API
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(
                    "Validating license with external API",
                    api_url=ACTYZE_API_URL,
                    license_key_prefix=license_input.license_key[:8]
                )
                
                response = await client.post(
                    ACTYZE_API_URL,
                    json={
                        "license_key": license_input.license_key,
                        "increment_usage": False
                    },
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": ACTYZE_API_KEY
                    }
                )
                
                logger.info(
                    "External API response received",
                    status_code=response.status_code,
                    has_content=bool(response.text),
                    content_length=len(response.text) if response.text else 0
                )
                
                if response.status_code != 200:
                    error_detail = {}
                    if response.text:
                        try:
                            error_detail = response.json()
                        except Exception:
                            error_detail = {"error": response.text[:200]}
                    
                    error_message = error_detail.get("error", f"Validation failed with status {response.status_code}")
                    
                    logger.warning(
                        "License validation failed",
                        license_key=license_input.license_key[:8] + "...",
                        status_code=response.status_code,
                        error=error_message,
                        response_text=response.text[:500] if response.text else None
                    )
                    
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid license key: {error_message}"
                    )
                
                if not response.text:
                    logger.error("Empty response from external API")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Empty response from license validation service"
                    )
                
                try:
                    license_data = response.json()
                    logger.info("License data parsed successfully", has_valid_field=("valid" in license_data))
                except Exception as e:
                    logger.error("Failed to parse JSON response", error=str(e), response_text=response.text[:500])
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Invalid response from license validation service: {str(e)}"
                    )
                
        except httpx.TimeoutException:
            logger.error("Timeout validating license with Actyze.ai")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Timeout connecting to Actyze.ai. Please try again."
            )
        except httpx.RequestError as e:
            logger.error("Network error validating license with Actyze.ai", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to Actyze.ai: {str(e)}"
            )
        
        # Check if license validation was successful
        if not license_data.get("valid"):
            error_msg = license_data.get("error", "License validation failed")
            logger.warning("License validation returned invalid", error=error_msg)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid license: {error_msg}"
            )
        
        # Step 2: Insert or update license record in database
        from app.database import TenantLicense, PlanType, LicenseStatus, db_manager
        from datetime import datetime, timedelta
        
        # Extract plan name from the response
        plan_name = license_data.get("license", {}).get("plan_name", "Free")
        if license_data.get("plan"):
            plan_name = license_data["plan"].get("plan_name", plan_name)
        
        logger.info("Extracted plan name from response", plan_name=plan_name)
        
        # Map plan name to PlanType enum
        plan_type_mapping = {
            "FREE": PlanType.FREE,
            "SMALL": PlanType.SMALL,
            "MEDIUM": PlanType.MEDIUM,
            "LARGE": PlanType.LARGE_ENTERPRISE,
            "LARGE ENTERPRISE": PlanType.LARGE_ENTERPRISE,
            "MANAGED SERVICE": PlanType.MANAGED_SERVICE
        }
        
        # Normalize plan_name to uppercase for case-insensitive matching
        plan_type = plan_type_mapping.get(plan_name.upper() if plan_name else "", PlanType.FREE)
        
        # Extract license limits from license data (not from plan)
        license_info = license_data.get("license", {})
        max_users = license_info.get("max_users")
        max_dashboards = license_info.get("max_dashboards")
        max_data_sources = license_info.get("max_data_sources")
        monthly_cost_usd = license_info.get("monthly_price_usd", 0)
        
        async with db_manager.get_session() as session:
            try:
                # Check if license already exists in database
                from sqlalchemy import select
                existing = await session.execute(
                    select(TenantLicense).where(TenantLicense.license_key == license_input.license_key)
                )
                existing_license = existing.scalar_one_or_none()
                
                if existing_license:
                    # License already exists, just activate it
                    result = await license_service.activate_license(
                        license_key=license_input.license_key,
                        actor_user_id=None  # No user context in public endpoint
                    )
                else:
                    # Before creating new license, deactivate any existing ACTIVE licenses
                    from sqlalchemy import update
                    await session.execute(
                        update(TenantLicense)
                        .where(TenantLicense.status == LicenseStatus.ACTIVE)
                        .values(status=LicenseStatus.DISABLED)
                    )
                    await session.commit()
                    
                    # Create new license record
                    # Note: license_info already extracted above
                    
                    # Parse datetime values and convert to timezone-naive (database uses TIMESTAMP WITHOUT TIME ZONE)
                    issued_at = None
                    if license_info.get("issued_at"):
                        issued_at = datetime.fromisoformat(license_info["issued_at"].replace('Z', '+00:00')).replace(tzinfo=None)
                    else:
                        issued_at = datetime.utcnow()
                    
                    expires_at = None
                    if license_info.get("expires_at"):
                        expires_at = datetime.fromisoformat(license_info["expires_at"].replace('Z', '+00:00')).replace(tzinfo=None)
                    
                    new_license = TenantLicense(
                        license_key=license_input.license_key,
                        status=LicenseStatus.ACTIVE,
                        plan_type=plan_type,
                        # License limits
                        max_users=max_users,
                        max_dashboards=max_dashboards,
                        max_data_sources=max_data_sources,
                        monthly_cost_usd=monthly_cost_usd,
                        # Timestamps
                        issued_at=issued_at,
                        expires_at=expires_at,
                        last_validated_at=datetime.utcnow()
                    )
                    
                    session.add(new_license)
                    await session.commit()
                    await session.refresh(new_license)
                    
                    result = {
                        "success": True,
                        "message": "License activated successfully",
                        "license": {
                            "id": str(new_license.id),
                            "status": new_license.status.value,
                            "plan_type": new_license.plan_type.value,
                            "max_users": new_license.max_users,
                            "max_dashboards": new_license.max_dashboards,
                            "max_data_sources": new_license.max_data_sources,
                            "issued_at": new_license.issued_at.isoformat(),
                            "expires_at": new_license.expires_at.isoformat() if new_license.expires_at else None,
                            "last_validated_at": new_license.last_validated_at.isoformat() if new_license.last_validated_at else None,
                            "is_valid": True
                        }
                    }
                
                logger.info(
                    "Initial license added successfully",
                    plan_type=plan_name,
                    max_users=max_users,
                    max_dashboards=max_dashboards,
                    max_data_sources=max_data_sources,
                    license_key_prefix=license_input.license_key[:8]
                )
                
                return {
                    "success": True,
                    "message": "License activated successfully",
                    "license": result["license"]
                }
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to insert license", error=str(e))
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to save license: {str(e)}"
                )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add initial license", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add license: {str(e)}"
        )
