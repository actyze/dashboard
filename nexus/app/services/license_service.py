"""License management service for Actyze platform - Simplified."""

from typing import Dict, Any, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
import structlog
from datetime import datetime

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
        """
        async with db_manager.get_session() as session:
            try:
                # Find license by key
                result = await session.execute(
                    select(TenantLicense).where(TenantLicense.license_key == license_key)
                )
                new_license = result.scalar_one_or_none()
                
                if not new_license:
                    return {
                        "success": False,
                        "error": "Invalid license key"
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
        """
        async with db_manager.get_session() as session:
            try:
                # Get active license
                result = await session.execute(
                    select(TenantLicense)
                    .where(TenantLicense.status == LicenseStatus.ACTIVE)
                )
                license = result.scalar_one_or_none()
                
                if not license:
                    return {
                        "success": False,
                        "error": "No active license found"
                    }
                
                # Check if expired
                is_valid = True
                validation_message = "License is valid"
                
                if license.expires_at and license.expires_at < datetime.utcnow():
                    is_valid = False
                    validation_message = "License has expired"
                    # Mark as expired
                    license.status = LicenseStatus.EXPIRED
                
                # Update last validated timestamp
                license.last_validated_at = datetime.utcnow()
                await session.commit()
                
                self.logger.info(
                    "License validated",
                    license_id=str(license.id),
                    is_valid=is_valid
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
            "issued_at": license.issued_at.isoformat() if license.issued_at else None,
            "expires_at": license.expires_at.isoformat() if license.expires_at else None,
            "last_validated_at": license.last_validated_at.isoformat() if license.last_validated_at else None,
            "is_valid": is_valid
        }
