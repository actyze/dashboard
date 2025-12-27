-- V011: Simplify Admin Model
-- Simplify to 2 roles (ADMIN, USER) and group-level data access only

-- ============================================================================
-- STEP 1: Simplify Roles - Keep only ADMIN and USER
-- ============================================================================

-- Remove unused roles, keep only ADMIN and USER
DELETE FROM nexus.user_roles 
WHERE role_id IN (
    SELECT id FROM nexus.roles WHERE name NOT IN ('ADMIN', 'USER')
);

DELETE FROM nexus.group_roles 
WHERE role_id IN (
    SELECT id FROM nexus.roles WHERE name NOT IN ('ADMIN', 'USER')
);

DELETE FROM nexus.roles 
WHERE name NOT IN ('ADMIN', 'USER');

-- Ensure ADMIN and USER roles exist with clear descriptions
UPDATE nexus.roles 
SET description = 'Administrator with full system access and user management capabilities'
WHERE name = 'ADMIN';

UPDATE nexus.roles 
SET description = 'Regular user with access based on group memberships'
WHERE name = 'USER';

-- Make sure we have both roles
INSERT INTO nexus.roles (name, description)
VALUES 
    ('ADMIN', 'Administrator with full system access and user management capabilities'),
    ('USER', 'Regular user with access based on group memberships')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description;

-- ============================================================================
-- STEP 2: Drop Old Policy-Based Data Access Tables
-- ============================================================================

DROP TABLE IF EXISTS nexus.user_data_policies CASCADE;
DROP TABLE IF EXISTS nexus.group_data_policies CASCADE;
DROP TABLE IF EXISTS nexus.role_data_policies CASCADE;
DROP TABLE IF EXISTS nexus.data_access_policies CASCADE;

-- ============================================================================
-- STEP 3: Create Simplified Group-Level Data Access Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus.group_data_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES nexus.groups(id) ON DELETE CASCADE,
    
    -- Resource hierarchy (all optional for flexibility)
    catalog VARCHAR(255),              -- e.g., 'trino', 'postgres'
    database_name VARCHAR(255),        -- e.g., 'tpch', 'demo_ecommerce'
    schema_name VARCHAR(255),          -- e.g., 'sf1', 'public'
    table_name VARCHAR(255),           -- e.g., 'customer', 'orders'
    allowed_columns TEXT[],            -- Optional: restrict to specific columns
    
    -- Access type (for future: read, write, etc. - for now just read)
    can_query BOOLEAN DEFAULT TRUE,
    is_visible BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_by UUID REFERENCES nexus.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't have duplicate entries
    UNIQUE(group_id, catalog, database_name, schema_name, table_name)
);

CREATE INDEX idx_group_data_access_group ON nexus.group_data_access(group_id);
CREATE INDEX idx_group_data_access_catalog ON nexus.group_data_access(catalog);
CREATE INDEX idx_group_data_access_database ON nexus.group_data_access(database_name);
CREATE INDEX idx_group_data_access_schema ON nexus.group_data_access(schema_name);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.group_data_access TO nexus_service;

-- ============================================================================
-- STEP 4: Drop Old Functions First
-- ============================================================================

DROP FUNCTION IF EXISTS nexus.get_user_accessible_schemas(UUID) CASCADE;
DROP FUNCTION IF EXISTS nexus.user_can_query(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS nexus.get_user_accessible_resources(UUID) CASCADE;
DROP FUNCTION IF EXISTS nexus.user_can_access_resource(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) CASCADE;

-- ============================================================================
-- STEP 5: Create Functions for Data Access Checks
-- ============================================================================

-- Function to get all accessible resources for a user (based on their groups)
CREATE OR REPLACE FUNCTION nexus.get_user_accessible_resources(p_user_id UUID)
RETURNS TABLE (
    catalog VARCHAR,
    database_name VARCHAR,
    schema_name VARCHAR,
    table_name VARCHAR,
    allowed_columns TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        gda.catalog,
        gda.database_name,
        gda.schema_name,
        gda.table_name,
        gda.allowed_columns
    FROM nexus.group_data_access gda
    INNER JOIN nexus.user_groups ug ON gda.group_id = ug.group_id
    WHERE ug.user_id = p_user_id
      AND gda.can_query = TRUE
      AND gda.is_visible = TRUE;
END;
$$;

-- Function to check if user can access a specific resource
CREATE OR REPLACE FUNCTION nexus.user_can_access_resource(
    p_user_id UUID,
    p_catalog VARCHAR,
    p_database VARCHAR,
    p_schema VARCHAR,
    p_table VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_has_access BOOLEAN;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin (admins have access to everything)
    SELECT EXISTS (
        SELECT 1 
        FROM nexus.user_roles ur
        INNER JOIN nexus.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id AND r.name = 'ADMIN'
    ) INTO v_is_admin;
    
    IF v_is_admin THEN
        RETURN TRUE;
    END IF;
    
    -- Check group-level access
    -- Match from most specific to least specific
    SELECT EXISTS (
        SELECT 1
        FROM nexus.group_data_access gda
        INNER JOIN nexus.user_groups ug ON gda.group_id = ug.group_id
        WHERE ug.user_id = p_user_id
          AND gda.can_query = TRUE
          AND (gda.catalog IS NULL OR gda.catalog = p_catalog)
          AND (gda.database_name IS NULL OR gda.database_name = p_database)
          AND (gda.schema_name IS NULL OR gda.schema_name = p_schema)
          AND (p_table IS NULL OR gda.table_name IS NULL OR gda.table_name = p_table)
    ) INTO v_has_access;
    
    RETURN v_has_access;
END;
$$;

-- Function to get user's accessible schemas (for schema browser)
CREATE OR REPLACE FUNCTION nexus.get_user_accessible_schemas(p_user_id UUID)
RETURNS TABLE (
    catalog VARCHAR,
    database_name VARCHAR,
    schema_name VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 
        FROM nexus.user_roles ur
        INNER JOIN nexus.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id AND r.name = 'ADMIN'
    ) INTO v_is_admin;
    
    -- Admins see everything (return empty to indicate full access)
    IF v_is_admin THEN
        RETURN;
    END IF;
    
    -- Return accessible schemas for regular users
    RETURN QUERY
    SELECT DISTINCT
        gda.catalog,
        gda.database_name,
        gda.schema_name
    FROM nexus.group_data_access gda
    INNER JOIN nexus.user_groups ug ON gda.group_id = ug.group_id
    WHERE ug.user_id = p_user_id
      AND gda.is_visible = TRUE
      AND gda.schema_name IS NOT NULL;
END;
$$;

-- ============================================================================
-- STEP 6: Migrate Existing Data (if any)
-- ============================================================================

-- Insert default "Full Access" for Analytics Team group if it exists
INSERT INTO nexus.group_data_access (group_id, catalog, database_name, schema_name, can_query, is_visible, created_by)
SELECT 
    g.id,
    NULL,  -- No catalog restriction
    NULL,  -- No database restriction
    NULL,  -- No schema restriction
    TRUE,
    TRUE,
    (SELECT id FROM nexus.users WHERE username = 'nexus_admin' LIMIT 1)
FROM nexus.groups g
WHERE g.name = 'Analytics Team'
  AND NOT EXISTS (
    SELECT 1 FROM nexus.group_data_access gda WHERE gda.group_id = g.id
  );

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION nexus.get_user_accessible_resources(UUID) TO nexus_service;
GRANT EXECUTE ON FUNCTION nexus.user_can_access_resource(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO nexus_service;
GRANT EXECUTE ON FUNCTION nexus.get_user_accessible_schemas(UUID) TO nexus_service;

