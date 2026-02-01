"""License management service for Actyze platform - Simplified."""

from typing import Dict, Any, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
import structlog
from datetime import datetime
import httpx

from app.database import (
    db_manager, TenantLicense,
    LicenseStatus, PlanType
)

logger = structlog.get_logger()


class LicenseService:
    """Service for managing licenses and plans."""
    
    def __init__(self):
        self.logger = logger.bind(service="license-service")
    
    # ========================================================================
    # License Management
    # ========================================================================
    
    async def activate_license(
        self,
        license_key: str,
        actor_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Activate a license key (atomically disable any previous active license).
        If license doesn't exist locally, fetches from marketing dashboard first.
        """
        async with db_manager.get_session() as session:
            try:
                # Find license by key
                result = await session.execute(
                    select(TenantLicense).where(TenantLicense.license_key == license_key)
                )
                new_license = result.scalar_one_or_none()
                
                # If license doesn't exist, fetch from marketing dashboard and create it
                if not new_license:
                    self.logger.info("License not found in database, fetching from marketing dashboard")
                    
                    # Fetch from marketing dashboard
                    ACTYZE_API_KEY = "e7cc1f4d3517eed3a22619f2daba13685ebf704f6b8f5771afb3df4c9406e57c"
                    ACTYZE_API_URL = "https://app.actyze.ai/api/validate-license"
                    
                    try:
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            response = await client.post(
                                ACTYZE_API_URL,
                                json={
                                    "license_key": license_key,
                                    "increment_usage": False
                                },
                                headers={
                                    "Content-Type": "application/json",
                                    "X-API-Key": ACTYZE_API_KEY
                                }
                            )
                            
                            if response.status_code != 200:
                                return {
                                    "success": False,
                                    "error": "Invalid license key"
                                }
                            
                            license_data = response.json()
                            if not license_data.get("success"):
                                return {
                                    "success": False,
                                    "error": license_data.get("error", "License validation failed")
                                }
                            
                            license_info = license_data.get("license", {})
                            
                            # Parse datetime values and convert to timezone-naive
                            issued_at = None
                            if license_info.get("issued_at"):
                                issued_at = datetime.fromisoformat(license_info["issued_at"].replace('Z', '+00:00')).replace(tzinfo=None)
                            else:
                                issued_at = datetime.utcnow()
                            
                            expires_at = None
                            if license_info.get("expires_at"):
                                expires_at = datetime.fromisoformat(license_info["expires_at"].replace('Z', '+00:00')).replace(tzinfo=None)
                            
                            # Map plan_name to PlanType enum
                            plan_name = license_info.get("plan_name", "")
                            plan_type_map = {
                                "FREE": PlanType.FREE,
                                "SMALL": PlanType.SMALL,
                                "MEDIUM": PlanType.MEDIUM,
                                "LARGE": PlanType.LARGE,
                                "LARGE ENTERPRISE": PlanType.LARGE_ENTERPRISE,
                                "MANAGED SERVICE": PlanType.MANAGED_SERVICE
                            }
                            plan_type = plan_type_map.get(plan_name, PlanType.FREE)
                            
                            # Create new license record
                            new_license = TenantLicense(
                                license_key=license_key,
                                status=LicenseStatus.PENDING,  # Will be activated below
                                plan_type=plan_type,
                                max_users=license_info.get("max_users"),
                                max_dashboards=license_info.get("max_dashboards"),
                                max_data_sources=license_info.get("max_data_sources"),
                                monthly_cost_usd=license_data.get("license", {}).get("monthly_price_usd"),
                                issued_at=issued_at,
                                expires_at=expires_at,
                                last_validated_at=datetime.utcnow()
                            )
                            
                            session.add(new_license)
                            await session.flush()  # Get the ID
                            
                            self.logger.info(
                                "New license fetched and created",
                                license_id=str(new_license.id),
                                plan_type=plan_type.value
                            )
                            
                    except httpx.TimeoutException:
                        return {
                            "success": False,
                            "error": "License validation service timeout"
                        }
                    except Exception as e:
                        self.logger.error("Failed to fetch license from marketing dashboard", error=str(e))
                        return {
                            "success": False,
                            "error": f"Failed to validate license: {str(e)}"
                        }
                
                # Check if already active
                if new_license.status == LicenseStatus.ACTIVE:
                    return {
                        "success": True,
                        "message": "License is already active",
                        "license": self._format_license(new_license)
                    }
                
                # Deactivate all other licenses
                await session.execute(
                    update(TenantLicense)
                    .where(TenantLicense.status == LicenseStatus.ACTIVE)
                    .values(status=LicenseStatus.DISABLED)
                )
                
                # Activate new license
                new_license.status = LicenseStatus.ACTIVE
                new_license.last_validated_at = datetime.utcnow()
                
                await session.commit()
                await session.refresh(new_license)
                
                self.logger.info(
                    "License activated",
                    license_id=str(new_license.id),
                    plan_type=new_license.plan_type.value,
                    actor_user_id=actor_user_id
                )
                
                return {
                    "success": True,
                    "message": "License activated successfully",
                    "license": self._format_license(new_license)
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to activate license", error=str(e))
                return {
                    "success": False,
                    "error": f"Failed to activate license: {str(e)}"
                }
    
    async def get_active_license(self) -> Dict[str, Any]:
        """Get the currently active license."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(TenantLicense)
                    .where(TenantLicense.status == LicenseStatus.ACTIVE)
                    .order_by(TenantLicense.issued_at.desc())
                )
                license = result.scalar_one_or_none()
                
                if not license:
                    return {
                        "success": False,
                        "error": "No active license found"
                    }
                
                # Check if expired
                if license.expires_at and license.expires_at < datetime.utcnow():
                    is_valid = False
                else:
                    is_valid = True
                
                return {
                    "success": True,
                    "license": self._format_license(license, is_valid=is_valid)
                }
                
            except Exception as e:
                self.logger.error("Failed to get active license", error=str(e))
                return {
                    "success": False,
                    "error": f"Failed to get active license: {str(e)}"
                }
    
    async def validate_license(self, force: bool = False) -> Dict[str, Any]:
        """
        Validate the current license and refresh its details.
        If force=True, calls marketing dashboard API to get latest status.
        """
        # Import here to avoid circular dependency
        from app.services.license_validator_service import license_validator_service
        
        # If force is True, trigger full validation with marketing dashboard API
        if force:
            self.logger.info("Force validation requested - calling marketing dashboard API")
            await license_validator_service.validate_active_license()
        
        async with db_manager.get_session() as session:
            try:
                # Get the active license (force validation may have just updated its status)
                result = await session.execute(
                    select(TenantLicense)
                    .where(TenantLicense.status == LicenseStatus.ACTIVE)
                    .order_by(TenantLicense.last_validated_at.desc())
                    .limit(1)
                )
                license = result.scalar_one_or_none()
                
                if not license:
                    # No active license found - check if there's a disabled/expired one to show
                    result = await session.execute(
                        select(TenantLicense)
                        .order_by(TenantLicense.last_validated_at.desc())
                        .limit(1)
                    )
                    license = result.scalar_one_or_none()
                    
                    if not license:
                        return {
                            "success": False,
                            "error": "No license found"
                        }
                
                # Determine validity based on status
                is_valid = license.status == LicenseStatus.ACTIVE
                
                if license.status == LicenseStatus.DISABLED:
                    validation_message = "License has been revoked or disabled"
                elif license.status == LicenseStatus.EXPIRED:
                    validation_message = "License has expired"
                elif license.expires_at and license.expires_at < datetime.utcnow():
                    is_valid = False
                    validation_message = "License has expired"
                    # Don't change status here if force validation was done
                    if not force:
                        license.status = LicenseStatus.EXPIRED
                        await session.commit()
                else:
                    validation_message = "License is valid"
                
                self.logger.info(
                    "License validated",
                    license_id=str(license.id),
                    is_valid=is_valid,
                    status=license.status.value,
                    forced=force
                )
                
                return {
                    "success": is_valid,
                    "message": validation_message,
                    "license": self._format_license(license, is_valid=is_valid)
                }
                
            except Exception as e:
                self.logger.error("Failed to validate license", error=str(e))
                return {
                    "success": False,
                    "error": f"Failed to validate license: {str(e)}"
                }
    
    # ========================================================================
    # Plan Management
    # ========================================================================
    
    async def get_plan_limits(self) -> Dict[str, Any]:
        """
        Get current plan limits from the active license.
        All limits are stored directly in the license record.
        """
        async with db_manager.get_session() as session:
            try:
                # Get active license
                license_result = await session.execute(
                    select(TenantLicense)
                    .where(TenantLicense.status == LicenseStatus.ACTIVE)
                )
                license = license_result.scalar_one_or_none()
                
                if not license:
                    return {
                        "success": False,
                        "error": "No active license found"
                    }
                
                # Map plan types to monthly costs
                plan_pricing = {
                    PlanType.FREE: 0,
                    PlanType.SMALL: 100,
                    PlanType.MEDIUM: 500,
                    PlanType.LARGE_ENTERPRISE: 2000,
                    PlanType.MANAGED_SERVICE: 0  # Custom pricing
                }
                
                monthly_cost_usd = plan_pricing.get(license.plan_type, 0)
                
                # Return license limits directly (no more subscription_plans table)
                return {
                    "success": True,
                    "plan": {
                        "plan_type": license.plan_type.value,
                        "max_users": license.max_users,
                        "max_dashboards": license.max_dashboards,
                        "max_data_sources": license.max_data_sources,
                        "monthly_cost_usd": monthly_cost_usd,
                        "expires_at": license.expires_at.isoformat() if license.expires_at else None,
                        "is_valid": not (license.expires_at and license.expires_at < datetime.utcnow())
                    }
                }
                
            except Exception as e:
                self.logger.error("Failed to get plan limits", error=str(e))
                return {
                    "success": False,
                    "error": f"Failed to get plan limits: {str(e)}"
                }
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _format_license(self, license: TenantLicense, is_valid: Optional[bool] = None) -> Dict[str, Any]:
        """Format license for API response."""
        if is_valid is None:
            is_valid = not (license.expires_at and license.expires_at < datetime.utcnow())
        
        return {
            "id": str(license.id),
            "status": license.status.value,
            "plan_type": license.plan_type.value,
            "max_users": license.max_users,
            "max_dashboards": license.max_dashboards,
            "max_data_sources": license.max_data_sources,
            "monthly_cost_usd": float(license.monthly_cost_usd) if license.monthly_cost_usd is not None else 0,
            "issued_at": license.issued_at.isoformat() if license.issued_at else None,
            "expires_at": license.expires_at.isoformat() if license.expires_at else None,
            "last_validated_at": license.last_validated_at.isoformat() if license.last_validated_at else None,
            "is_valid": is_valid
        }
