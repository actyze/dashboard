-- V027: Fix license constraints to allow -1 for unlimited

-- Drop the old constraint that doesn't allow -1
ALTER TABLE nexus.tenant_licenses
DROP CONSTRAINT IF EXISTS valid_max_users_license;

-- Add new constraint that allows -1 (unlimited), NULL, or positive values
ALTER TABLE nexus.tenant_licenses
ADD CONSTRAINT valid_max_users_license CHECK (max_users IS NULL OR max_users = -1 OR max_users > 0);

-- Add similar constraints for dashboards and data sources
ALTER TABLE nexus.tenant_licenses
ADD CONSTRAINT valid_max_dashboards CHECK (max_dashboards IS NULL OR max_dashboards = -1 OR max_dashboards > 0);

ALTER TABLE nexus.tenant_licenses
ADD CONSTRAINT valid_max_data_sources CHECK (max_data_sources IS NULL OR max_data_sources = -1 OR max_data_sources > 0);

COMMENT ON CONSTRAINT valid_max_users_license ON nexus.tenant_licenses IS 'NULL = unlimited, -1 = unlimited, >0 = specific limit';
COMMENT ON CONSTRAINT valid_max_dashboards ON nexus.tenant_licenses IS 'NULL = unlimited, -1 = unlimited, >0 = specific limit';
COMMENT ON CONSTRAINT valid_max_data_sources ON nexus.tenant_licenses IS 'NULL = unlimited, -1 = unlimited, >0 = specific limit';
