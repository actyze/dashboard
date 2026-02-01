-- V024: Add license limit fields to tenant_licenses
-- Store license limits per license instead of in subscription_plans

ALTER TABLE nexus.tenant_licenses
ADD COLUMN IF NOT EXISTS max_dashboards INTEGER,
ADD COLUMN IF NOT EXISTS max_data_sources INTEGER;

-- Add comments
COMMENT ON COLUMN nexus.tenant_licenses.max_dashboards IS 'Maximum number of dashboards allowed. -1 or NULL = unlimited';
COMMENT ON COLUMN nexus.tenant_licenses.max_data_sources IS 'Maximum number of data sources allowed. -1 or NULL = unlimited';

-- Note: max_users already exists in the table
COMMENT ON COLUMN nexus.tenant_licenses.max_users IS 'Maximum number of users allowed. NULL = unlimited';
