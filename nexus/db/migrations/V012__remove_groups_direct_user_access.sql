-- V012: Remove Groups - Direct User to Data Access
-- Simplifies the model from User -> Group -> DataAccess to User -> DataAccess

-- ============================================================================
-- STEP 1: Create the new user_data_access table
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus.user_data_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    
    -- Resource hierarchy (all optional for flexibility - NULL = wildcard)
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
    
    -- Ensure we don't have duplicate entries for the same user/resource
    UNIQUE(user_id, catalog, database_name, schema_name, table_name)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_data_access_user ON nexus.user_data_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_access_catalog ON nexus.user_data_access(catalog);
CREATE INDEX IF NOT EXISTS idx_user_data_access_database ON nexus.user_data_access(database_name);
CREATE INDEX IF NOT EXISTS idx_user_data_access_schema ON nexus.user_data_access(schema_name);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.user_data_access TO nexus_service;

-- ============================================================================
-- STEP 2: Migrate existing group_data_access to user_data_access
-- For each user in a group, copy the group's access rules to user_data_access
-- ============================================================================

-- Migrate data from group_data_access to user_data_access for all users
INSERT INTO nexus.user_data_access (user_id, catalog, database_name, schema_name, table_name, allowed_columns, can_query, is_visible, created_by, created_at)
SELECT DISTINCT
    ug.user_id,
    gda.catalog,
    gda.database_name,
    gda.schema_name,
    gda.table_name,
    gda.allowed_columns,
    gda.can_query,
    gda.is_visible,
    gda.created_by,
    gda.created_at
FROM nexus.group_data_access gda
INNER JOIN nexus.user_groups ug ON gda.group_id = ug.group_id
ON CONFLICT (user_id, catalog, database_name, schema_name, table_name) DO NOTHING;

-- ============================================================================
-- STEP 3: Drop old group-related functions
-- ============================================================================

DROP FUNCTION IF EXISTS nexus.get_user_accessible_schemas(UUID) CASCADE;
DROP FUNCTION IF EXISTS nexus.user_can_access_resource(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS nexus.get_user_accessible_resources(UUID) CASCADE;

-- ============================================================================
-- STEP 4: Create new user-direct access functions
-- ============================================================================

-- Function to get all accessible resources for a user (direct access)
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
        uda.catalog,
        uda.database_name,
        uda.schema_name,
        uda.table_name,
        uda.allowed_columns
    FROM nexus.user_data_access uda
    WHERE uda.user_id = p_user_id
      AND uda.can_query = TRUE
      AND uda.is_visible = TRUE;
END;
$$;

-- Function to check if user can access a specific resource (direct access)
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
    
    -- Check direct user-level access
    -- Match from most specific to least specific
    SELECT EXISTS (
        SELECT 1
        FROM nexus.user_data_access uda
        WHERE uda.user_id = p_user_id
          AND uda.can_query = TRUE
          AND (uda.catalog IS NULL OR uda.catalog = p_catalog)
          AND (uda.database_name IS NULL OR uda.database_name = p_database)
          AND (uda.schema_name IS NULL OR uda.schema_name = p_schema)
          AND (p_table IS NULL OR uda.table_name IS NULL OR uda.table_name = p_table)
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
    
    -- Return accessible schemas for regular users (direct access)
    RETURN QUERY
    SELECT DISTINCT
        uda.catalog,
        uda.database_name,
        uda.schema_name
    FROM nexus.user_data_access uda
    WHERE uda.user_id = p_user_id
      AND uda.is_visible = TRUE
      AND uda.schema_name IS NOT NULL;
END;
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION nexus.get_user_accessible_resources(UUID) TO nexus_service;
GRANT EXECUTE ON FUNCTION nexus.user_can_access_resource(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO nexus_service;
GRANT EXECUTE ON FUNCTION nexus.get_user_accessible_schemas(UUID) TO nexus_service;

-- ============================================================================
-- STEP 5: Drop old group-related tables (order matters for foreign keys)
-- ============================================================================

-- Drop group_data_access first (depends on groups)
DROP TABLE IF EXISTS nexus.group_data_access CASCADE;

-- Drop user_groups (depends on groups and users)
DROP TABLE IF EXISTS nexus.user_groups CASCADE;

-- Drop group_roles (depends on groups and roles)
DROP TABLE IF EXISTS nexus.group_roles CASCADE;

-- Finally drop groups table
DROP TABLE IF EXISTS nexus.groups CASCADE;

-- ============================================================================
-- STEP 6: Clean up dashboards table - remove owner_group_id column
-- ============================================================================

-- Remove the owner_group_id column from dashboards if it exists
ALTER TABLE nexus.dashboards DROP COLUMN IF EXISTS owner_group_id;

-- ============================================================================
-- STEP 7: Give nexus_admin user full access by default
-- ============================================================================

-- Ensure nexus_admin has full access (NULL = wildcard = all)
INSERT INTO nexus.user_data_access (user_id, catalog, database_name, schema_name, can_query, is_visible, created_at)
SELECT 
    id,
    NULL,  -- All catalogs
    NULL,  -- All databases
    NULL,  -- All schemas
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
FROM nexus.users 
WHERE username = 'nexus_admin'
  AND NOT EXISTS (
    SELECT 1 FROM nexus.user_data_access uda 
    WHERE uda.user_id = nexus.users.id 
      AND uda.catalog IS NULL 
      AND uda.database_name IS NULL
  );

