-- V026: Drop subscription_plans table
-- All license limits are now stored directly in tenant_licenses
-- subscription_plans was only used for reference/display data

DROP TABLE IF EXISTS nexus.subscription_plans CASCADE;

-- Note: plan_type enum is still used by tenant_licenses, so we keep it
