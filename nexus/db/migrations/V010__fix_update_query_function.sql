-- =====================================================
-- V010: Fix update_existing_query function return type
-- =====================================================
-- Ensures the function returns BOOLEAN, not INTEGER
-- This fixes: "operator does not exist: boolean > integer"
--
-- IMPORTANT: PostgreSQL functions are not tied to schemas in the same way
-- as tables. A function can exist in multiple schemas (nexus, public, etc.)
-- and cause conflicts. This migration ensures we drop ALL versions.

-- Drop from nexus schema (expected location)
DROP FUNCTION IF EXISTS nexus.update_existing_query(
    INTEGER, UUID, TEXT, VARCHAR, VARCHAR, INTEGER, INTEGER, TEXT
) CASCADE;

-- Drop from public schema (in case it was created there by mistake)  
DROP FUNCTION IF EXISTS public.update_existing_query(
    INTEGER, UUID, TEXT, VARCHAR, VARCHAR, INTEGER, INTEGER, TEXT
) CASCADE;

-- Drop any other possible versions with slightly different signatures
-- (This handles cases where someone might have created variations)
DROP FUNCTION IF EXISTS nexus.update_existing_query CASCADE;
DROP FUNCTION IF EXISTS public.update_existing_query CASCADE;

-- Recreate with correct return type
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
    
    -- IMPORTANT: Return BOOLEAN, not INTEGER
    RETURN (v_row_count > 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.update_existing_query IS 'Update existing query - explicit user action only. Returns TRUE if updated, FALSE if not found.';

