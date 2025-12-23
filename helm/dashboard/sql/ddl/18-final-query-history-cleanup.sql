-- =====================================================================================
-- Final query_history cleanup:
-- 1. Remove natural_language_query (not needed for audit log)
-- 2. Make table immutable (audit log - no updates/deletes)
-- =====================================================================================

-- Drop dependent view first
DROP VIEW IF EXISTS nexus.query_history_with_users CASCADE;

-- Remove natural_language_query column (not needed - SQL is the source of truth)
ALTER TABLE nexus.query_history DROP COLUMN IF EXISTS natural_language_query;

-- Recreate simplified upsert function that properly increments count
DROP FUNCTION IF EXISTS nexus.upsert_query_history(uuid, text, text, varchar, integer, integer, text, varchar) CASCADE;

CREATE OR REPLACE FUNCTION nexus.upsert_query_history(
    p_user_id UUID,
    p_generated_sql TEXT,
    p_execution_status VARCHAR(20),
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_row_count INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_query_hash VARCHAR(64);
    v_query_id INTEGER;
    v_now TIMESTAMP := NOW();
BEGIN
    -- Generate hash for deduplication (MD5 of SQL + user_id)
    v_query_hash := md5(p_generated_sql || p_user_id::text);
    
    -- Try to find existing query by hash
    SELECT id INTO v_query_id
    FROM nexus.query_history
    WHERE query_hash = v_query_hash;
    
    IF FOUND THEN
        -- Update existing query: increment count, update timestamp and status
        UPDATE nexus.query_history
        SET 
            execution_count = execution_count + 1,
            last_executed_at = v_now,
            execution_status = p_execution_status,
            execution_time_ms = COALESCE(p_execution_time_ms, execution_time_ms),
            row_count = COALESCE(p_row_count, row_count),
            error_message = p_error_message
        WHERE id = v_query_id;
        
        RETURN v_query_id;
    ELSE
        -- Insert new query
        INSERT INTO nexus.query_history (
            user_id,
            query_hash,
            generated_sql,
            execution_status,
            execution_time_ms,
            row_count,
            error_message,
            execution_count,
            created_at,
            last_executed_at,
            is_favorite,
            query_name
        ) VALUES (
            p_user_id,
            v_query_hash,
            p_generated_sql,
            p_execution_status,
            p_execution_time_ms,
            p_row_count,
            p_error_message,
            1,  -- execution_count starts at 1
            v_now,
            v_now,
            FALSE,
            NULL
        )
        RETURNING id INTO v_query_id;
        
        RETURN v_query_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate view without natural_language_query
CREATE OR REPLACE VIEW nexus.query_history_with_users AS
SELECT
    qh.id,
    qh.user_id,
    u.username,
    u.email AS user_email,
    qh.generated_sql,
    qh.query_hash,
    qh.execution_status,
    qh.execution_time_ms,
    qh.row_count,
    qh.error_message,
    qh.execution_count,
    qh.last_executed_at,
    qh.is_favorite,
    qh.query_name,
    qh.created_at
FROM nexus.query_history qh
LEFT JOIN nexus.users u ON qh.user_id = u.id;

COMMENT ON TABLE nexus.query_history IS 'Immutable audit log of query executions (no deletes/updates except count increment)';
COMMENT ON FUNCTION nexus.upsert_query_history IS 'Insert new query or increment execution count for existing query by hash';

