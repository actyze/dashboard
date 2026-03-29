-- V031: Remove licensing system (open-source conversion)
-- All features are now unlimited — no license key required.

-- Drop license-related functions
DROP FUNCTION IF EXISTS nexus.activate_license(TEXT, nexus.plan_type);
DROP FUNCTION IF EXISTS nexus.get_active_license();
DROP FUNCTION IF EXISTS nexus.is_system_locked();
DROP FUNCTION IF EXISTS nexus.enter_lock_mode(TEXT);
DROP FUNCTION IF EXISTS nexus.exit_lock_mode();
DROP FUNCTION IF EXISTS nexus.get_plan_limits();
DROP FUNCTION IF EXISTS nexus.count_enabled_users();
DROP FUNCTION IF EXISTS nexus.can_add_user();
DROP FUNCTION IF EXISTS nexus.disable_excess_users(INTEGER);

-- Drop license-related tables
DROP TABLE IF EXISTS nexus.audit_log CASCADE;
DROP TABLE IF EXISTS nexus.system_state CASCADE;
DROP TABLE IF EXISTS nexus.tenant_licenses CASCADE;
DROP TABLE IF EXISTS nexus.subscription_plans CASCADE;

-- Remove user_state columns from users table (added by licensing system)
ALTER TABLE nexus.users DROP COLUMN IF EXISTS user_state;
ALTER TABLE nexus.users DROP COLUMN IF EXISTS disabled_reason;
ALTER TABLE nexus.users DROP COLUMN IF EXISTS disabled_at;

-- Drop license-related enum types
DROP TYPE IF EXISTS nexus.audit_event_type CASCADE;
DROP TYPE IF EXISTS nexus.user_state CASCADE;
DROP TYPE IF EXISTS nexus.license_status CASCADE;
DROP TYPE IF EXISTS nexus.plan_type CASCADE;
