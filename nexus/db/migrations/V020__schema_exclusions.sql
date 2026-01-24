-- V020: Schema Exclusions
-- Global (org-level) feature to hide/disable unwanted databases, schemas, or tables
-- These exclusions remove items from schema service FAISS index for everyone

-- ============================================================================
-- Create schema_exclusions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus.schema_exclusions (
    id SERIAL PRIMARY KEY,
    
    -- Hierarchical structure (catalog > schema > table)
    -- All fields required: catalog is minimum, schema and table are optional based on level
    catalog VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    table_name VARCHAR(255),
    
    -- Reason for exclusion (optional)
    reason TEXT,
    
    -- Metadata tracking
    excluded_by UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Hierarchy constraint: enforce valid hierarchy levels
    CONSTRAINT exclusion_hierarchy_check CHECK (
        -- Database level only (exclude entire database)
        (schema_name IS NULL AND table_name IS NULL) OR
        -- Schema level (exclude entire schema within a database)
        (schema_name IS NOT NULL AND table_name IS NULL) OR
        -- Table level (exclude specific table)
        (schema_name IS NOT NULL AND table_name IS NOT NULL)
    ),
    
    -- Unique constraint: one exclusion per unique hierarchy path
    CONSTRAINT unique_exclusion_path UNIQUE (catalog, schema_name, table_name)
);

-- Indexes for fast lookups
CREATE INDEX idx_exclusions_catalog ON nexus.schema_exclusions(catalog);
CREATE INDEX idx_exclusions_schema ON nexus.schema_exclusions(catalog, schema_name) WHERE schema_name IS NOT NULL;
CREATE INDEX idx_exclusions_table ON nexus.schema_exclusions(catalog, schema_name, table_name) WHERE table_name IS NOT NULL;
CREATE INDEX idx_exclusions_excluded_by ON nexus.schema_exclusions(excluded_by);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON nexus.schema_exclusions TO nexus_service;
GRANT USAGE, SELECT ON SEQUENCE nexus.schema_exclusions_id_seq TO nexus_service;

-- ============================================================================
-- Helper function to check if a resource is excluded
-- ============================================================================

CREATE OR REPLACE FUNCTION nexus.is_resource_excluded(
    p_catalog VARCHAR,
    p_schema VARCHAR DEFAULT NULL,
    p_table VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check if exact match exists at any level
    RETURN EXISTS (
        SELECT 1 FROM nexus.schema_exclusions
        WHERE catalog = p_catalog
        AND (
            -- Database-level exclusion
            (schema_name IS NULL AND table_name IS NULL) OR
            -- Schema-level exclusion
            (schema_name = p_schema AND table_name IS NULL AND p_schema IS NOT NULL) OR
            -- Table-level exclusion
            (schema_name = p_schema AND table_name = p_table AND p_table IS NOT NULL)
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Helper function to get all exclusions in a format for schema service
-- ============================================================================

CREATE OR REPLACE FUNCTION nexus.get_all_exclusions()
RETURNS TABLE (
    catalog VARCHAR,
    schema_name VARCHAR,
    table_name VARCHAR,
    full_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.catalog,
        e.schema_name,
        e.table_name,
        CASE 
            WHEN e.schema_name IS NULL THEN e.catalog
            WHEN e.table_name IS NULL THEN e.catalog || '.' || e.schema_name
            ELSE e.catalog || '.' || e.schema_name || '.' || e.table_name
        END AS full_path
    FROM nexus.schema_exclusions e
    ORDER BY e.catalog, e.schema_name NULLS FIRST, e.table_name NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION nexus.is_resource_excluded(VARCHAR, VARCHAR, VARCHAR) TO nexus_service;
GRANT EXECUTE ON FUNCTION nexus.get_all_exclusions() TO nexus_service;
