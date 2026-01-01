-- V013: User Schema Preferences for Recommendation Boosting
-- Allows users to mark preferred schemas/tables/columns to boost schema service recommendations

-- ============================================================================
-- Create the user_schema_preferences table
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus.user_schema_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    
    -- Resource hierarchy (matching user_data_access structure)
    catalog VARCHAR(255),              -- e.g., 'trino', 'postgres'
    database_name VARCHAR(255),        -- e.g., 'tpch', 'demo_ecommerce'
    schema_name VARCHAR(255),          -- e.g., 'sf1', 'public'
    table_name VARCHAR(255),           -- e.g., 'customer', 'orders' - NULL = entire schema
    preferred_columns TEXT[],          -- Optional: prefer specific columns - NULL = all columns
    
    -- Preference-specific field
    boost_weight DECIMAL(3,2) DEFAULT 1.5,  -- Multiplier for schema recommendation confidence (1.0 - 3.0)
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't have duplicate entries for the same user/resource
    UNIQUE(user_id, catalog, database_name, schema_name, table_name)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_user ON nexus.user_schema_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_catalog ON nexus.user_schema_preferences(catalog);
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_database ON nexus.user_schema_preferences(database_name);
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_schema ON nexus.user_schema_preferences(schema_name);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.user_schema_preferences TO nexus_service;

-- Add comments for documentation
COMMENT ON TABLE nexus.user_schema_preferences IS 'User-specific preferred schemas/tables/columns for boosting schema service recommendations';
COMMENT ON COLUMN nexus.user_schema_preferences.catalog IS 'Database catalog - e.g., trino, postgres';
COMMENT ON COLUMN nexus.user_schema_preferences.database_name IS 'Database name - e.g., tpch, demo_ecommerce';
COMMENT ON COLUMN nexus.user_schema_preferences.schema_name IS 'Schema name - e.g., sf1, public';
COMMENT ON COLUMN nexus.user_schema_preferences.table_name IS 'Table name - NULL means entire schema is preferred';
COMMENT ON COLUMN nexus.user_schema_preferences.preferred_columns IS 'Specific columns to prefer - NULL means all columns';
COMMENT ON COLUMN nexus.user_schema_preferences.boost_weight IS 'Confidence multiplier for recommendations - range 1.0 (low) to 3.0 (high), default 1.5';

-- Sample data for testing (optional)
-- Insert a sample preference for the admin user
INSERT INTO nexus.user_schema_preferences (user_id, catalog, database_name, schema_name, table_name, boost_weight)
SELECT u.id, NULL, 'tpch', 'sf1', NULL, 1.5
FROM nexus.users u
WHERE u.username = 'nexus_admin'
ON CONFLICT (user_id, catalog, database_name, schema_name, table_name) DO NOTHING;

