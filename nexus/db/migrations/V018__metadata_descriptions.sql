-- V018: Add org-level metadata descriptions for catalogs, schemas, tables, and columns
-- This enables users to add business context that improves schema recommendations

-- Main metadata descriptions table
CREATE TABLE IF NOT EXISTS nexus.metadata_descriptions (
    id SERIAL PRIMARY KEY,
    
    -- Hierarchical structure (catalog > schema > table > column)
    catalog VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    table_name VARCHAR(255),
    column_name VARCHAR(255),
    
    -- The description itself
    description TEXT NOT NULL,
    
    -- Metadata tracking
    created_by UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    updated_by UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Hierarchy constraint: enforce valid hierarchy levels
    CONSTRAINT metadata_hierarchy_check CHECK (
        -- Catalog level only
        (schema_name IS NULL AND table_name IS NULL AND column_name IS NULL) OR
        -- Schema level
        (schema_name IS NOT NULL AND table_name IS NULL AND column_name IS NULL) OR
        -- Table level
        (schema_name IS NOT NULL AND table_name IS NOT NULL AND column_name IS NULL) OR
        -- Column level
        (schema_name IS NOT NULL AND table_name IS NOT NULL AND column_name IS NOT NULL)
    ),
    
    -- Unique constraint: one description per unique hierarchy path
    CONSTRAINT unique_metadata_path UNIQUE (catalog, schema_name, table_name, column_name)
);

-- Indexes for fast lookups
CREATE INDEX idx_metadata_catalog ON nexus.metadata_descriptions(catalog);
CREATE INDEX idx_metadata_schema ON nexus.metadata_descriptions(catalog, schema_name) WHERE schema_name IS NOT NULL;
CREATE INDEX idx_metadata_table ON nexus.metadata_descriptions(catalog, schema_name, table_name) WHERE table_name IS NOT NULL;
CREATE INDEX idx_metadata_column ON nexus.metadata_descriptions(catalog, schema_name, table_name, column_name) WHERE column_name IS NOT NULL;
CREATE INDEX idx_metadata_created_at ON nexus.metadata_descriptions(created_at DESC);
CREATE INDEX idx_metadata_updated_at ON nexus.metadata_descriptions(updated_at DESC);

-- Audit history table for tracking changes
CREATE TABLE IF NOT EXISTS nexus.metadata_description_history (
    id SERIAL PRIMARY KEY,
    description_id INTEGER NOT NULL REFERENCES nexus.metadata_descriptions(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted'
    old_description TEXT,
    new_description TEXT,
    changed_by UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_description_id ON nexus.metadata_description_history(description_id);
CREATE INDEX idx_history_changed_at ON nexus.metadata_description_history(changed_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION nexus.update_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER trigger_update_metadata_updated_at
    BEFORE UPDATE ON nexus.metadata_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION nexus.update_metadata_updated_at();

-- Comments for documentation
COMMENT ON TABLE nexus.metadata_descriptions IS 'Org-level metadata descriptions for improving schema recommendations';
COMMENT ON COLUMN nexus.metadata_descriptions.catalog IS 'Database catalog name (e.g., postgres, tpch)';
COMMENT ON COLUMN nexus.metadata_descriptions.schema_name IS 'Schema name within catalog (NULL for catalog-level descriptions)';
COMMENT ON COLUMN nexus.metadata_descriptions.table_name IS 'Table name within schema (NULL for schema-level descriptions)';
COMMENT ON COLUMN nexus.metadata_descriptions.column_name IS 'Column name within table (NULL for table-level descriptions)';
COMMENT ON COLUMN nexus.metadata_descriptions.description IS 'Business context description that improves semantic search';

COMMENT ON TABLE nexus.metadata_description_history IS 'Audit log for tracking changes to metadata descriptions';

