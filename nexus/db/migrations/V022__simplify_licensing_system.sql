-- V022: Simplify Licensing System
-- Drop audit_log and system_state tables as licensing system is simplified
-- Only keep core license and plan tables

-- Drop audit_log table (no longer needed)
DROP TABLE IF EXISTS nexus.audit_log CASCADE;

-- Drop audit_event_type enum
DROP TYPE IF EXISTS nexus.audit_event_type CASCADE;

-- Drop system_state table (no longer needed - no lock mode)
DROP TABLE IF EXISTS nexus.system_state CASCADE;

-- Note: tenant_licenses and subscription_plans tables are retained for core licensing functionality
