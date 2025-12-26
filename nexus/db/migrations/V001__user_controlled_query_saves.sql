-- =====================================================================================
-- Flyway Migration V001: User-Controlled Query Saves
-- =====================================================================================
-- Changes:
-- 1. Remove query_hash column (no longer needed)
-- 2. Add updated_at with proper trigger
-- 3. Drop upsert_query_history (no more automatic saves)
-- 4. Create explicit save_query and update_query functions
-- =====================================================================================

-- =====================================================
-- PART 1: Update query_history table schema
-- =====================================================

-- Drop dependent views and functions first
DROP VIEW IF EXISTS nexus.query_history_with_users CASCADE;
DROP FUNCTION IF EXISTS nexus.upsert_query_history CASCADE;

-- Remove hash-based columns (if they exist from previous migrations)
ALTER TABLE nexus.query_history 
    DROP COLUMN IF EXISTS query_hash CASCADE,
    DROP COLUMN IF EXISTS execution_count CASCADE,
    DROP COLUMN IF EXISTS last_executed_at CASCADE;

-- Add new columns for user-controlled saves
ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS query_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have updated_at = created_at if null
UPDATE nexus.query_history 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_query_history_timestamp ON nexus.query_history;

CREATE TRIGGER update_query_history_timestamp
    BEFORE UPDATE ON nexus.query_history
    FOR EACH ROW
    EXECUTE FUNCTION nexus.trigger_set_timestamp();

-- =====================================================
-- PART 2: Create user-controlled save functions
-- =====================================================

-- Function to save a new query (explicit user action)
CREATE OR REPLACE FUNCTION nexus.save_new_query(
    p_user_id UUID,
    p_generated_sql TEXT,
    p_query_name VARCHAR(255) DEFAULT NULL,
    p_execution_status VARCHAR(20) DEFAULT 'SUCCESS',
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_row_count INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_query_id INTEGER;
    v_now TIMESTAMP := NOW();
BEGIN
    -- Insert new query (user-initiated save)
    INSERT INTO nexus.query_history (
        user_id,
        generated_sql,
        query_name,
        execution_status,
        execution_time_ms,
        row_count,
        error_message,
        created_at,
        updated_at,
        is_favorite
    ) VALUES (
        p_user_id,
        p_generated_sql,
        p_query_name,
        p_execution_status,
        p_execution_time_ms,
        p_row_count,
        p_error_message,
        v_now,
        v_now,
        FALSE
    )
    RETURNING id INTO v_query_id;
    
    RETURN v_query_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.save_new_query IS 'Save a new query - explicit user action only';

-- Function to update an existing query (explicit user action)
CREATE OR REPLACE FUNCTION nexus.update_existing_query(
    p_query_id INTEGER,
    p_user_id UUID,
    p_generated_sql TEXT DEFAULT NULL,
    p_query_name VARCHAR(255) DEFAULT NULL,
    p_execution_status VARCHAR(20) DEFAULT NULL,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_row_count INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_row_count INTEGER;
BEGIN
    -- Update query (user-initiated save)
    -- Only update fields that are provided (not NULL)
    UPDATE nexus.query_history
    SET 
        generated_sql = COALESCE(p_generated_sql, generated_sql),
        query_name = COALESCE(p_query_name, query_name),
        execution_status = COALESCE(p_execution_status, execution_status),
        execution_time_ms = COALESCE(p_execution_time_ms, execution_time_ms),
        row_count = COALESCE(p_row_count, row_count),
        error_message = COALESCE(p_error_message, error_message)
        -- updated_at automatically updated by trigger
    WHERE id = p_query_id 
    AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.update_existing_query IS 'Update existing query - explicit user action only';

-- =====================================================
-- PART 3: Recreate view without removed columns
-- =====================================================

CREATE OR REPLACE VIEW nexus.query_history_with_users AS
SELECT
    qh.id,
    qh.user_id,
    u.username,
    u.email AS user_email,
    qh.generated_sql,
    qh.query_name,
    qh.execution_status,
    qh.execution_time_ms,
    qh.row_count,
    qh.error_message,
    qh.is_favorite,
    qh.created_at,
    qh.updated_at
FROM nexus.query_history qh
LEFT JOIN nexus.users u ON qh.user_id = u.id
ORDER BY qh.updated_at DESC;

GRANT SELECT ON nexus.query_history_with_users TO nexus_service;

-- =====================================================
-- PART 4: Update comments
-- =====================================================

COMMENT ON TABLE nexus.query_history IS 'User-saved queries (explicit saves only, no automatic deduplication)';
COMMENT ON COLUMN nexus.query_history.created_at IS 'When query was first saved';
COMMENT ON COLUMN nexus.query_history.updated_at IS 'When query was last updated (determines display order)';
COMMENT ON COLUMN nexus.query_history.query_name IS 'User-provided name for the query';
COMMENT ON COLUMN nexus.query_history.is_favorite IS 'User favorited this query';

