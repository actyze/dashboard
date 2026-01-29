-- ============================================================================
-- V019: Licensing System Schema
-- ============================================================================
-- This migration implements the comprehensive licensing and subscription
-- management system as per the Actyze requirements specification v2.
--
-- Features:
-- - Subscription plans (FREE, SMALL, MEDIUM, LARGE_ENTERPRISE, MANAGED_SERVICE)
-- - License key management with validation and grace periods
-- - User state management (ENABLED/DISABLED)
-- - System lock mode for license violations
-- - Audit logging for all licensing events
-- ============================================================================

-- 1. Create ENUM types for licensing
CREATE TYPE nexus.plan_type AS ENUM (
    'FREE', 
    'SMALL', 
    'MEDIUM', 
    'LARGE_ENTERPRISE', 
    'MANAGED_SERVICE'
);

CREATE TYPE nexus.license_status AS ENUM (
    'ACTIVE',
    'DISABLED', 
    'EXPIRED'
);

CREATE TYPE nexus.user_state AS ENUM (
    'ENABLED',
    'DISABLED'
);

CREATE TYPE nexus.audit_event_type AS ENUM (
    'LICENSE_ADDED',
    'LICENSE_REVOKED',
    'LICENSE_ROTATED',
    'PLAN_UPGRADED',
    'PLAN_DOWNGRADED',
    'USER_ENABLED',
    'USER_DISABLED',
    'USER_CREATED',
    'LOGIN_FAILED_LICENSE',
    'LOGIN_FAILED_USER_DISABLED',
    'LOCK_MODE_ENTERED',
    'LOCK_MODE_EXITED',
    'LICENSE_VALIDATION_SUCCESS',
    'LICENSE_VALIDATION_FAILED',
    'LICENSE_GRACE_PERIOD_STARTED',
    'LICENSE_GRACE_PERIOD_EXPIRED'
);

-- 2. Subscription Plans Reference Table
CREATE TABLE IF NOT EXISTS nexus.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name nexus.plan_type UNIQUE NOT NULL,
    monthly_cost_usd DECIMAL(10, 2) NOT NULL,
    max_users INT, -- NULL means unlimited
    support_model VARCHAR(100) NOT NULL,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_max_users CHECK (max_users IS NULL OR max_users > 0)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp_subscription_plans ON nexus.subscription_plans;
CREATE TRIGGER set_timestamp_subscription_plans 
    BEFORE UPDATE ON nexus.subscription_plans 
    FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 3. Tenant Licenses Table
CREATE TABLE IF NOT EXISTS nexus.tenant_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(64) UNIQUE NOT NULL,
    status nexus.license_status DEFAULT 'ACTIVE',
    plan_type nexus.plan_type NOT NULL,
    max_users INT, -- NULL means unlimited, can override plan default for managed service
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- NULL means perpetual
    last_validated_at TIMESTAMP,
    validation_grace_expires_at TIMESTAMP, -- Grace period end time
    license_metadata JSONB DEFAULT '{}', -- Custom overrides for managed service
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_license_key CHECK (length(license_key) = 64),
    CONSTRAINT valid_max_users_license CHECK (max_users IS NULL OR max_users > 0),
    CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_tenant_licenses_key ON nexus.tenant_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status ON nexus.tenant_licenses(status);

DROP TRIGGER IF EXISTS set_timestamp_tenant_licenses ON nexus.tenant_licenses;
CREATE TRIGGER set_timestamp_tenant_licenses 
    BEFORE UPDATE ON nexus.tenant_licenses 
    FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 4. System State Table (Singleton)
CREATE TABLE IF NOT EXISTS nexus.system_state (
    id INT PRIMARY KEY CHECK (id = 1), -- Singleton pattern
    active_license_id UUID REFERENCES nexus.tenant_licenses(id),
    is_locked BOOLEAN DEFAULT FALSE,
    lock_reason VARCHAR(500),
    locked_at TIMESTAMP,
    last_license_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize system state (single row)
INSERT INTO nexus.system_state (id, is_locked) 
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_timestamp_system_state ON nexus.system_state;
CREATE TRIGGER set_timestamp_system_state 
    BEFORE UPDATE ON nexus.system_state 
    FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 5. Audit Log Table
CREATE TABLE IF NOT EXISTS nexus.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type nexus.audit_event_type NOT NULL,
    actor_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL,
    license_id UUID REFERENCES nexus.tenant_licenses(id) ON DELETE SET NULL,
    event_metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON nexus.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON nexus.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON nexus.audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON nexus.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_license ON nexus.audit_log(license_id);

-- 6. Update Users Table - Add user_state column
ALTER TABLE nexus.users 
    ADD COLUMN IF NOT EXISTS user_state nexus.user_state DEFAULT 'ENABLED';

ALTER TABLE nexus.users 
    ADD COLUMN IF NOT EXISTS disabled_reason VARCHAR(500);

ALTER TABLE nexus.users 
    ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_state ON nexus.users(user_state);

-- 7. Insert Default Subscription Plans
INSERT INTO nexus.subscription_plans (plan_name, monthly_cost_usd, max_users, support_model, features)
VALUES
    ('FREE', 0, 1, 'Community (GitHub issues)', 
     '{"support_channels": ["github"], "sla": "best_effort"}'::jsonb),
    
    ('SMALL', 100, 3, 'Email + GitHub', 
     '{"support_channels": ["email", "github"], "sla": "business_hours", "response_time_hours": 48}'::jsonb),
    
    ('MEDIUM', 500, 20, 'Email + GitHub', 
     '{"support_channels": ["email", "github"], "sla": "business_hours", "response_time_hours": 24}'::jsonb),
    
    ('LARGE_ENTERPRISE', 2000, NULL, 'On-call + Email + GitHub', 
     '{"support_channels": ["on_call", "email", "github"], "sla": "24x7", "response_time_hours": 4}'::jsonb),
    
    ('MANAGED_SERVICE', 0, NULL, 'Dedicated / Contract-defined', 
     '{"support_channels": ["dedicated"], "sla": "contract_defined", "custom_overrides": true}'::jsonb)
ON CONFLICT (plan_name) DO NOTHING;

-- 8. Create Functions for License Management

-- Function: Activate a new license (atomically disable previous)
CREATE OR REPLACE FUNCTION nexus.activate_license(
    p_license_key VARCHAR(64)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license_id UUID;
    v_previous_license_id UUID;
BEGIN
    -- Get the license to activate
    SELECT id INTO v_license_id
    FROM nexus.tenant_licenses
    WHERE license_key = p_license_key;
    
    IF v_license_id IS NULL THEN
        RAISE EXCEPTION 'License key not found';
    END IF;
    
    -- Get current active license
    SELECT active_license_id INTO v_previous_license_id
    FROM nexus.system_state
    WHERE id = 1;
    
    -- Disable previous license if exists
    IF v_previous_license_id IS NOT NULL THEN
        UPDATE nexus.tenant_licenses
        SET status = 'DISABLED'
        WHERE id = v_previous_license_id;
    END IF;
    
    -- Activate new license
    UPDATE nexus.tenant_licenses
    SET status = 'ACTIVE',
        last_validated_at = CURRENT_TIMESTAMP
    WHERE id = v_license_id;
    
    -- Update system state
    UPDATE nexus.system_state
    SET active_license_id = v_license_id,
        is_locked = FALSE,
        lock_reason = NULL,
        locked_at = NULL,
        last_license_check = CURRENT_TIMESTAMP
    WHERE id = 1;
    
    RETURN v_license_id;
END;
$$;

-- Function: Get current active license
CREATE OR REPLACE FUNCTION nexus.get_active_license()
RETURNS TABLE (
    license_id UUID,
    license_key VARCHAR(64),
    status nexus.license_status,
    plan_type nexus.plan_type,
    max_users INT,
    issued_at TIMESTAMP,
    expires_at TIMESTAMP,
    last_validated_at TIMESTAMP,
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.license_key,
        l.status,
        l.plan_type,
        l.max_users,
        l.issued_at,
        l.expires_at,
        l.last_validated_at,
        (l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP))::BOOLEAN
    FROM nexus.tenant_licenses l
    INNER JOIN nexus.system_state s ON s.active_license_id = l.id
    WHERE s.id = 1;
END;
$$;

-- Function: Check if system is locked
CREATE OR REPLACE FUNCTION nexus.is_system_locked()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    SELECT is_locked INTO v_is_locked
    FROM nexus.system_state
    WHERE id = 1;
    
    RETURN COALESCE(v_is_locked, FALSE);
END;
$$;

-- Function: Enter lock mode
CREATE OR REPLACE FUNCTION nexus.enter_lock_mode(
    p_reason VARCHAR(500)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE nexus.system_state
    SET is_locked = TRUE,
        lock_reason = p_reason,
        locked_at = CURRENT_TIMESTAMP
    WHERE id = 1;
END;
$$;

-- Function: Exit lock mode
CREATE OR REPLACE FUNCTION nexus.exit_lock_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE nexus.system_state
    SET is_locked = FALSE,
        lock_reason = NULL,
        locked_at = NULL
    WHERE id = 1;
END;
$$;

-- Function: Get plan limits for active license
CREATE OR REPLACE FUNCTION nexus.get_plan_limits()
RETURNS TABLE (
    plan_type nexus.plan_type,
    max_users INT,
    monthly_cost_usd DECIMAL(10, 2),
    support_model VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(l.plan_type, 'FREE'::nexus.plan_type),
        COALESCE(l.max_users, p.max_users),
        p.monthly_cost_usd,
        p.support_model
    FROM nexus.system_state s
    LEFT JOIN nexus.tenant_licenses l ON s.active_license_id = l.id
    LEFT JOIN nexus.subscription_plans p ON l.plan_type = p.plan_name
    WHERE s.id = 1;
END;
$$;

-- Function: Count enabled users
CREATE OR REPLACE FUNCTION nexus.count_enabled_users()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM nexus.users
    WHERE user_state = 'ENABLED' AND is_active = TRUE;
    
    RETURN v_count;
END;
$$;

-- Function: Enforce plan user limits (called during user creation/enablement)
CREATE OR REPLACE FUNCTION nexus.can_add_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_users INT;
    v_current_count INT;
BEGIN
    -- Get plan limit
    SELECT max_users INTO v_max_users
    FROM nexus.get_plan_limits();
    
    -- NULL means unlimited
    IF v_max_users IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Count current enabled users
    v_current_count := nexus.count_enabled_users();
    
    RETURN v_current_count < v_max_users;
END;
$$;

-- Function: Disable excess users on plan downgrade
CREATE OR REPLACE FUNCTION nexus.disable_excess_users(
    p_new_max_users INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
    v_excess_count INT;
    v_disabled_count INT := 0;
    v_user_record RECORD;
BEGIN
    -- Count current enabled users
    v_current_count := nexus.count_enabled_users();
    
    -- Calculate excess
    v_excess_count := v_current_count - p_new_max_users;
    
    IF v_excess_count <= 0 THEN
        RETURN 0; -- No action needed
    END IF;
    
    -- Disable non-admin users first, most recent first, keep at least one admin
    FOR v_user_record IN (
        SELECT u.id
        FROM nexus.users u
        LEFT JOIN nexus.user_roles ur ON u.id = ur.user_id
        LEFT JOIN nexus.roles r ON ur.role_id = r.id
        WHERE u.user_state = 'ENABLED' AND u.is_active = TRUE
        ORDER BY 
            CASE WHEN r.name = 'ADMIN' THEN 1 ELSE 0 END, -- Non-admins first
            u.created_at DESC -- Most recent first
        LIMIT v_excess_count
    )
    LOOP
        -- Ensure we don't disable the last admin
        IF (SELECT COUNT(*) FROM nexus.users u
            INNER JOIN nexus.user_roles ur ON u.id = ur.user_id
            INNER JOIN nexus.roles r ON ur.role_id = r.id
            WHERE r.name = 'ADMIN' AND u.user_state = 'ENABLED') > 1 
           OR NOT EXISTS (
               SELECT 1 FROM nexus.user_roles ur2
               INNER JOIN nexus.roles r2 ON ur2.role_id = r2.id
               WHERE ur2.user_id = v_user_record.id AND r2.name = 'ADMIN'
           ) THEN
            
            UPDATE nexus.users
            SET user_state = 'DISABLED',
                disabled_reason = 'Automatically disabled due to plan downgrade',
                disabled_at = CURRENT_TIMESTAMP
            WHERE id = v_user_record.id;
            
            v_disabled_count := v_disabled_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_disabled_count;
END;
$$;

-- 9. Create default FREE license for bootstrapping existing installations
DO $$
DECLARE
    v_default_license_key VARCHAR(64);
    v_license_id UUID;
BEGIN
    -- Generate a default license key (replace with proper generation in production)
    v_default_license_key := md5(random()::text || clock_timestamp()::text) || 
                              md5(random()::text || clock_timestamp()::text);
    
    -- Insert default license
    INSERT INTO nexus.tenant_licenses (
        license_key, 
        status, 
        plan_type, 
        max_users,
        expires_at
    )
    VALUES (
        v_default_license_key,
        'ACTIVE',
        'FREE',
        1,
        NULL -- Perpetual
    )
    RETURNING id INTO v_license_id;
    
    -- Set as active license
    UPDATE nexus.system_state
    SET active_license_id = v_license_id,
        last_license_check = CURRENT_TIMESTAMP
    WHERE id = 1;
    
    -- Log the license creation
    INSERT INTO nexus.audit_log (event_type, license_id, event_metadata)
    VALUES ('LICENSE_ADDED', v_license_id, 
            jsonb_build_object('reason', 'Bootstrap default FREE license'));
    
    RAISE NOTICE 'Default FREE license created: %', v_default_license_key;
END $$;

-- 10. Update all existing users to ENABLED state
UPDATE nexus.users
SET user_state = 'ENABLED'
WHERE user_state IS NULL;

-- ============================================================================
-- Migration Complete: Licensing System Schema
-- ============================================================================
-- Next Steps:
-- 1. Implement LicenseService in app/services/license_service.py
-- 2. Implement LicenseValidator in app/services/license_validator.py
-- 3. Add license validation middleware to auth flow
-- 4. Create license management API endpoints
-- 5. Build admin UI for license management
-- ============================================================================
