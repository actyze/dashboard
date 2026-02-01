"""Background service for periodic license validation."""

import structlog
import httpx
from typing import Dict, Any
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from app.database import db_manager, TenantLicense, LicenseStatus
from app.services.license_service import LicenseService

logger = structlog.get_logger()


class LicenseValidatorService:
    """Background service to validate licenses periodically."""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.license_service = LicenseService()
        self.logger = logger.bind(service="license-validator")
        
        # Actyze's API key (server-side only, hardcoded - never exposed)
        self.ACTYZE_API_KEY = "e7cc1f4d3517eed3a22619f2daba13685ebf704f6b8f5771afb3df4c9406e57c"
        # Production API URL (app.actyze.ai hosts the Next.js marketing dashboard with API routes)
        self.ACTYZE_API_URL = "https://app.actyze.ai/api/validate-license"
    
    async def start(self):
        """Start the background scheduler."""
        # Add job to run every 6 hours
        self.scheduler.add_job(
            self.validate_active_license,
            'interval',
            hours=6,
            id='license_validation',
            name='Periodic License Validation',
            replace_existing=True
        )
        
        # Start the scheduler
        self.scheduler.start()
        self.logger.info("License validator scheduler started (runs every 6 hours)")
        
        # Run validation immediately on startup
        await self.validate_active_license()
    
    async def stop(self):
        """Stop the background scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self.logger.info("License validator scheduler stopped")
    
    async def validate_active_license(self):
        """
        Validate the currently active license with Actyze.ai.
        Called on startup and every 6 hours.
        """
        try:
            self.logger.info("Starting periodic license validation")
            
            async with db_manager.get_session() as session:
                # Get active license
                result = await session.execute(
                    select(TenantLicense).where(TenantLicense.status == LicenseStatus.ACTIVE)
                )
                license = result.scalar_one_or_none()
                
                if not license:
                    self.logger.warning("No active license found - system may be running on trial/free tier")
                    return
                
                self.logger.info(
                    "Validating license",
                    license_id=str(license.id),
                    license_key=license.license_key[:12] + "...",  # Log only first 12 chars
                    last_validated=license.last_validated_at.isoformat() if license.last_validated_at else "never"
                )
                
                # Call Actyze.ai validation API
                validation_result = await self._validate_with_actyze(license.license_key)
                
                if validation_result.get("valid"):
                    # License is valid
                    license_data = validation_result.get("license", {})
                    
                    # Extract and cache license details from API
                    max_users = license_data.get("max_users")
                    max_dashboards = license_data.get("max_dashboards")
                    max_data_sources = license_data.get("max_data_sources")
                    monthly_cost_usd = license_data.get("monthly_price_usd", 0)
                    
                    # Update license with latest data from API (cached for 6 hours)
                    update_values = {
                        "last_validated_at": datetime.utcnow(),
                        "status": LicenseStatus.ACTIVE
                    }
                    
                    # Only update if values are provided in response
                    if max_users is not None:
                        update_values["max_users"] = max_users
                    if max_dashboards is not None:
                        update_values["max_dashboards"] = max_dashboards
                    if max_data_sources is not None:
                        update_values["max_data_sources"] = max_data_sources
                    if monthly_cost_usd is not None:
                        update_values["monthly_cost_usd"] = monthly_cost_usd
                    
                    await session.execute(
                        update(TenantLicense)
                        .where(TenantLicense.id == license.id)
                        .values(**update_values)
                    )
                    await session.commit()
                    
                    self.logger.info(
                        "License validation successful",
                        license_id=str(license.id),
                        plan_type=license.plan_type.value if license.plan_type else None,
                        status=license_data.get("status"),
                        max_users=max_users
                    )
                else:
                    # License is invalid, expired, or revoked
                    error = validation_result.get("error", "Unknown error")
                    error_code = validation_result.get("code", "UNKNOWN")
                    
                    # Determine appropriate status based on error code
                    if error_code == "EXPIRED_LICENSE":
                        new_status = LicenseStatus.EXPIRED
                    elif error_code == "INACTIVE_LICENSE":
                        # License was revoked or disabled
                        new_status = LicenseStatus.DISABLED
                    else:
                        # Default to EXPIRED for other errors
                        new_status = LicenseStatus.EXPIRED
                    
                    # Update license status
                    await session.execute(
                        update(TenantLicense)
                        .where(TenantLicense.id == license.id)
                        .values(
                            last_validated_at=datetime.utcnow(),
                            status=new_status
                        )
                    )
                    await session.commit()
                    
                    self.logger.error(
                        "License validation failed",
                        license_id=str(license.id),
                        error=error,
                        error_code=error_code,
                        new_status=new_status.value
                    )
                    
        except Exception as e:
            self.logger.error("Failed to validate license", error=str(e), exc_info=True)
    
    async def _validate_with_actyze(self, license_key: str) -> Dict[str, Any]:
        """
        Make server-to-server call to Actyze.ai to validate license.
        Returns validation result from Actyze.ai API.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.ACTYZE_API_URL,
                    json={
                        "license_key": license_key,
                        "increment_usage": False  # Periodic validation shouldn't increment usage
                    },
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": self.ACTYZE_API_KEY
                    }
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    error_detail = response.json() if response.text else {}
                    return {
                        "valid": False,
                        "error": error_detail.get("error", f"HTTP {response.status_code}")
                    }
                    
        except httpx.TimeoutException:
            self.logger.error("Timeout validating license with Actyze.ai")
            return {"valid": False, "error": "Validation timeout"}
        except httpx.RequestError as e:
            self.logger.error("Network error validating license with Actyze.ai", error=str(e))
            return {"valid": False, "error": f"Network error: {str(e)}"}
        except Exception as e:
            self.logger.error("Unexpected error validating license with Actyze.ai", error=str(e))
            return {"valid": False, "error": f"Unexpected error: {str(e)}"}


# Singleton instance
license_validator_service = LicenseValidatorService()
