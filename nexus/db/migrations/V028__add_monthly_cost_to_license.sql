-- V028: Add monthly_cost_usd to tenant_licenses
-- This is populated from the external API and cached locally

ALTER TABLE nexus.tenant_licenses
ADD COLUMN IF NOT EXISTS monthly_cost_usd DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN nexus.tenant_licenses.monthly_cost_usd IS 'Monthly cost in USD. Cached from marketing dashboard API during validation.';

-- Update existing licenses with default pricing based on plan type
UPDATE nexus.tenant_licenses
SET monthly_cost_usd = 
    CASE 
        WHEN plan_type = 'FREE' THEN 0
        WHEN plan_type = 'SMALL' THEN 100
        WHEN plan_type = 'MEDIUM' THEN 500
        WHEN plan_type = 'LARGE_ENTERPRISE' THEN 2000
        WHEN plan_type = 'MANAGED_SERVICE' THEN 0
        ELSE 0
    END
WHERE monthly_cost_usd IS NULL OR monthly_cost_usd = 0;
