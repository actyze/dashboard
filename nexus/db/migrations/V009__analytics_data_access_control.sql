-- =====================================================
-- V009: Analytics Data Access Control
-- =====================================================
-- Implements simplified read-only access control for analytics use case
-- Users can only query (SELECT) data based on assigned policies

-- 1. Data Access Policies Table
CREATE TABLE IF NOT EXISTS nexus.data_access_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    
    -- Resource definition (hierarchical - NULL = wildcard)
    catalog VARCHAR(100),      -- e.g., 'tpch', 'postgres', NULL = all
    database_name VARCHAR(100), -- e.g., 'production', 'staging', NULL = all
    schema_name VARCHAR(100),   -- e.g., 'analytics', 'sales', NULL = all  
    table_pattern VARCHAR(100), -- e.g., 'customer_%', 'sales_*', NULL = all
    
    -- For analytics, we only need visibility control
    is_visible BOOLEAN DEFAULT TRUE,  -- Can see in schema browser?
    can_query BOOLEAN DEFAULT TRUE,   -- Can execute SELECT queries?
    
    -- Optional: Row-level security (future enhancement)
    row_filter_sql TEXT,  -- e.g., "WHERE region = 'US'" or "WHERE user_id = ${current_user_id}"
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES nexus.users(id)
);

DROP TRIGGER IF EXISTS set_timestamp_data_access_policies ON nexus.data_access_policies;
CREATE TRIGGER set_timestamp_data_access_policies 
BEFORE UPDATE ON nexus.data_access_policies 
FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 2. Assign policies to users (direct assignment)
CREATE TABLE IF NOT EXISTS nexus.user_data_policies (
    user_id UUID REFERENCES nexus.users(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES nexus.data_access_policies(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES nexus.users(id),
    PRIMARY KEY (user_id, policy_id)
);

-- 3. Assign policies to groups (most common pattern)
CREATE TABLE IF NOT EXISTS nexus.group_data_policies (
    group_id UUID REFERENCES nexus.groups(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES nexus.data_access_policies(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES nexus.users(id),
    PRIMARY KEY (group_id, policy_id)
);

-- 4. Assign policies to roles (e.g., all VIEWERs see certain data)
CREATE TABLE IF NOT EXISTS nexus.role_data_policies (
    role_id UUID REFERENCES nexus.roles(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES nexus.data_access_policies(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, policy_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_access_catalog ON nexus.data_access_policies(catalog);
CREATE INDEX IF NOT EXISTS idx_data_access_database ON nexus.data_access_policies(database_name);
CREATE INDEX IF NOT EXISTS idx_data_access_schema ON nexus.data_access_policies(schema_name);
CREATE INDEX IF NOT EXISTS idx_user_data_policies_user ON nexus.user_data_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_policies_policy ON nexus.user_data_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_group_data_policies_group ON nexus.group_data_policies(group_id);
CREATE INDEX IF NOT EXISTS idx_group_data_policies_policy ON nexus.group_data_policies(policy_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get visible schemas for a user
CREATE OR REPLACE FUNCTION nexus.get_user_accessible_schemas(p_user_id UUID)
RETURNS TABLE(
    catalog VARCHAR,
    database_name VARCHAR,
    schema_name VARCHAR,
    can_query BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    -- From direct user policies
    SELECT DISTINCT 
        dap.catalog,
        dap.database_name,
        dap.schema_name,
        dap.can_query
    FROM nexus.user_data_policies udp
    JOIN nexus.data_access_policies dap ON udp.policy_id = dap.id
    WHERE udp.user_id = p_user_id AND dap.is_visible = TRUE
    
    UNION
    
    -- From group policies
    SELECT DISTINCT 
        dap.catalog,
        dap.database_name,
        dap.schema_name,
        dap.can_query
    FROM nexus.user_groups ug
    JOIN nexus.group_data_policies gdp ON ug.group_id = gdp.group_id
    JOIN nexus.data_access_policies dap ON gdp.policy_id = dap.id
    WHERE ug.user_id = p_user_id AND dap.is_visible = TRUE
    
    UNION
    
    -- From role policies
    SELECT DISTINCT 
        dap.catalog,
        dap.database_name,
        dap.schema_name,
        dap.can_query
    FROM nexus.user_roles ur
    JOIN nexus.role_data_policies rdp ON ur.role_id = rdp.role_id
    JOIN nexus.data_access_policies dap ON rdp.policy_id = dap.id
    WHERE ur.user_id = p_user_id AND dap.is_visible = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can query a specific table
CREATE OR REPLACE FUNCTION nexus.user_can_query(
    p_user_id UUID,
    p_catalog VARCHAR,
    p_database VARCHAR,
    p_schema VARCHAR,
    p_table VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN := FALSE;
BEGIN
    -- Admins have full access
    IF EXISTS (
        SELECT 1 FROM nexus.user_roles ur
        JOIN nexus.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id AND r.name = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check policies (direct user, group, or role)
    SELECT EXISTS (
        SELECT 1 FROM (
            -- Direct user policies
            SELECT dap.* FROM nexus.user_data_policies udp
            JOIN nexus.data_access_policies dap ON udp.policy_id = dap.id
            WHERE udp.user_id = p_user_id
            
            UNION
            
            -- Group policies
            SELECT dap.* FROM nexus.user_groups ug
            JOIN nexus.group_data_policies gdp ON ug.group_id = gdp.group_id
            JOIN nexus.data_access_policies dap ON gdp.policy_id = dap.id
            WHERE ug.user_id = p_user_id
            
            UNION
            
            -- Role policies
            SELECT dap.* FROM nexus.user_roles ur
            JOIN nexus.role_data_policies rdp ON ur.role_id = rdp.role_id
            JOIN nexus.data_access_policies dap ON rdp.policy_id = dap.id
            WHERE ur.user_id = p_user_id
        ) AS all_policies
        WHERE can_query = TRUE
        AND (catalog IS NULL OR catalog = p_catalog)
        AND (database_name IS NULL OR database_name = p_database)
        AND (schema_name IS NULL OR schema_name = p_schema)
        AND (table_pattern IS NULL OR p_table LIKE table_pattern)
    ) INTO has_access;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default "Full Access" policy for ADMINs
INSERT INTO nexus.data_access_policies (policy_name, description, catalog, database_name, schema_name, table_pattern, is_visible, can_query)
VALUES ('Full Access', 'Access to all data sources', NULL, NULL, NULL, NULL, TRUE, TRUE)
ON CONFLICT (policy_name) DO NOTHING;

-- Assign "Full Access" policy to ADMIN role
INSERT INTO nexus.role_data_policies (role_id, policy_id)
SELECT r.id, p.id
FROM nexus.roles r, nexus.data_access_policies p
WHERE r.name = 'ADMIN' AND p.policy_name = 'Full Access'
ON CONFLICT DO NOTHING;

-- Common policy templates
INSERT INTO nexus.data_access_policies (policy_name, description, catalog, database_name, schema_name, is_visible, can_query)
VALUES 
('TPC-H Read Access', 'Read access to TPC-H benchmark data', 'tpch', NULL, NULL, TRUE, TRUE),
('Production Analytics Read', 'Read access to production analytics schema', 'postgres', 'production', 'analytics', TRUE, TRUE),
('Demo Data Access', 'Read access to demo e-commerce data', 'postgres', NULL, 'demo_ecommerce', TRUE, TRUE)
ON CONFLICT (policy_name) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON nexus.data_access_policies TO nexus_service;
GRANT ALL PRIVILEGES ON nexus.user_data_policies TO nexus_service;
GRANT ALL PRIVILEGES ON nexus.group_data_policies TO nexus_service;
GRANT ALL PRIVILEGES ON nexus.role_data_policies TO nexus_service;

