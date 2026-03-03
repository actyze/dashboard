-- V029: Preferred Tables Feature - Replace boost multiplier with simple preferred flag
-- MANDATORY MIGRATION: Converts boost system to preferred tables, removes deprecated columns
-- Adds explicit preferred flag and metadata storage for table columns
-- Migration: boost_weight > 1.5 → is_preferred = TRUE
-- Cleanup: Removes boost_weight column and non-table-level preferences

-- ============================================================================
-- Add new columns to user_schema_preferences
-- ============================================================================

-- Add is_preferred flag (explicit preferred marker)
ALTER TABLE nexus.user_schema_preferences 
ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT TRUE;

-- Add columns_metadata (JSONB) to store full column information
-- Format: [{"name": "col1", "type": "varchar", "description": "..."}, ...]
ALTER TABLE nexus.user_schema_preferences 
ADD COLUMN IF NOT EXISTS columns_metadata JSONB DEFAULT '[]'::jsonb;

-- Add table_metadata (TEXT) to store table-level description
ALTER TABLE nexus.user_schema_preferences 
ADD COLUMN IF NOT EXISTS table_metadata TEXT;

-- ============================================================================
-- Data Migration: Convert existing boost preferences to preferred flag
-- ============================================================================

-- Mark tables with high boost (> 1.5) as preferred
UPDATE nexus.user_schema_preferences
SET is_preferred = TRUE
WHERE boost_weight > 1.5 
  AND table_name IS NOT NULL
  AND is_preferred IS NULL;

-- Mark tables with low boost (<= 1.5) as not preferred
UPDATE nexus.user_schema_preferences
SET is_preferred = FALSE
WHERE boost_weight <= 1.5
  AND table_name IS NOT NULL
  AND is_preferred IS NULL;

-- Mark schema-level and database-level preferences as not preferred
-- (we only support table-level preferred in new system)
UPDATE nexus.user_schema_preferences
SET is_preferred = FALSE
WHERE table_name IS NULL
  AND is_preferred IS NULL;

-- ============================================================================
-- Cleanup: Remove deprecated data and columns
-- ============================================================================

-- Remove schema-level and database-level preferences (no longer supported)
DELETE FROM nexus.user_schema_preferences
WHERE table_name IS NULL;

-- Remove non-preferred table preferences (if boost_weight <= 1.5)
-- Keep only preferred tables to clean up the table
DELETE FROM nexus.user_schema_preferences
WHERE table_name IS NOT NULL 
  AND is_preferred = FALSE;

-- Drop deprecated boost_weight column (no longer needed)
ALTER TABLE nexus.user_schema_preferences 
DROP COLUMN IF EXISTS boost_weight;

-- Drop deprecated preferred_columns column (replaced by columns_metadata JSONB)
ALTER TABLE nexus.user_schema_preferences 
DROP COLUMN IF EXISTS preferred_columns;

-- ============================================================================
-- Create function to enforce max preferred tables limit
-- ============================================================================

CREATE OR REPLACE FUNCTION nexus.enforce_max_preferred_tables()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_limit INTEGER := 50;  -- Default limit, configurable via environment
BEGIN
    -- Only check limit if marking as preferred
    IF NEW.is_preferred = TRUE AND NEW.table_name IS NOT NULL THEN
        SELECT COUNT(*) INTO current_count
        FROM nexus.user_schema_preferences
        WHERE user_id = NEW.user_id 
          AND is_preferred = TRUE
          AND table_name IS NOT NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
        
        IF current_count >= max_limit THEN
            RAISE EXCEPTION 'Maximum number of preferred tables (%) exceeded. Please remove some preferred tables before adding more.', max_limit
                USING HINT = 'You can unmark existing preferred tables to make room for new ones';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create trigger to enforce limit
-- ============================================================================

DROP TRIGGER IF EXISTS check_max_preferred_tables ON nexus.user_schema_preferences;

CREATE TRIGGER check_max_preferred_tables
    BEFORE INSERT OR UPDATE ON nexus.user_schema_preferences
    FOR EACH ROW
    EXECUTE FUNCTION nexus.enforce_max_preferred_tables();

-- ============================================================================
-- Update indexes for better performance
-- ============================================================================

-- Add index on is_preferred for faster preferred table lookups
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_preferred 
ON nexus.user_schema_preferences(user_id, is_preferred) 
WHERE is_preferred = TRUE AND table_name IS NOT NULL;

-- Add GIN index on columns_metadata for efficient JSONB queries (optional, for future use)
CREATE INDEX IF NOT EXISTS idx_user_schema_preferences_columns_metadata 
ON nexus.user_schema_preferences USING GIN (columns_metadata);

-- ============================================================================
-- Update comments for documentation
-- ============================================================================

COMMENT ON TABLE nexus.user_schema_preferences IS 'User-specific preferred tables for AI query prioritization - table-level only';
COMMENT ON COLUMN nexus.user_schema_preferences.catalog IS 'Database catalog - e.g., trino, postgres';
COMMENT ON COLUMN nexus.user_schema_preferences.database_name IS 'Database name - e.g., tpch, demo_ecommerce';
COMMENT ON COLUMN nexus.user_schema_preferences.schema_name IS 'Schema name - e.g., sf1, public';
COMMENT ON COLUMN nexus.user_schema_preferences.table_name IS 'Table name - REQUIRED (schema/database level preferences removed)';
COMMENT ON COLUMN nexus.user_schema_preferences.is_preferred IS 'Explicit flag for preferred tables - TRUE = prioritized by AI';
COMMENT ON COLUMN nexus.user_schema_preferences.columns_metadata IS 'JSONB array of column metadata: [{"name": "col1", "type": "varchar", "description": "..."}]';
COMMENT ON COLUMN nexus.user_schema_preferences.table_metadata IS 'Table-level description to help AI understand the table purpose';

-- ============================================================================
-- Summary of changes
-- ============================================================================

-- Log migration summary
DO $$
DECLARE
    preferred_count INTEGER;
    not_preferred_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preferred_count
    FROM nexus.user_schema_preferences
    WHERE is_preferred = TRUE AND table_name IS NOT NULL;
    
    SELECT COUNT(*) INTO not_preferred_count
    FROM nexus.user_schema_preferences
    WHERE is_preferred = FALSE;
    
    RAISE NOTICE 'Migration V029 completed successfully';
    RAISE NOTICE 'Preferred tables: %', preferred_count;
    RAISE NOTICE 'Non-preferred preferences: %', not_preferred_count;
    RAISE NOTICE 'Max preferred tables limit: 50 (configurable)';
END $$;
