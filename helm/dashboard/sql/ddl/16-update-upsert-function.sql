-- =====================================================================================
-- Update upsert_query_history function to match simplified schema
-- =====================================================================================

-- Drop old versions of the function
DROP FUNCTION IF EXISTS nexus.upsert_query_history(
    uuid, varchar, text, text, varchar, integer, integer, text, jsonb, jsonb, numeric, integer, integer, text
) CASCADE;

DROP FUNCTION IF EXISTS nexus.upsert_query_history(
    uuid, text, text, varchar, integer, integer, jsonb, text, jsonb, integer
) CASCADE;

-- Create simplified upsert function (only essential columns)
CREATE OR REPLACE FUNCTION nexus.upsert_query_history(
    p_user_id UUID,
    p_natural_language_query TEXT,
    p_generated_sql TEXT,
    p_execution_status VARCHAR(20),
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_row_count INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_query_name VARCHAR(255) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_query_hash VARCHAR(64);
    v_query_id INTEGER;
BEGIN
    -- Generate hash for deduplication (MD5 of SQL + user_id)
    v_query_hash := md5(p_generated_sql || p_user_id::text);
    
    -- Try to find existing query by hash
    SELECT id INTO v_query_id
    FROM nexus.query_history
    WHERE query_hash = v_query_hash 
    AND user_id = p_user_id;
    
    IF FOUND THEN
        -- Update existing query: increment count, update timestamp
        UPDATE nexus.query_history
        SET 
            execution_count = execution_count + 1,
            last_executed_at = NOW(),
            execution_status = p_execution_status,
            execution_time_ms = COALESCE(p_execution_time_ms, execution_time_ms),
            row_count = COALESCE(p_row_count, row_count),
            error_message = p_error_message,
            query_name = COALESCE(p_query_name, query_name)
        WHERE id = v_query_id;
        
        RETURN v_query_id;
    ELSE
        -- Insert new query
        INSERT INTO nexus.query_history (
            user_id,
            query_hash,
            natural_language_query,
            generated_sql,
            execution_status,
            execution_time_ms,
            row_count,
            error_message,
            query_name,
            execution_count,
            created_at,
            last_executed_at,
            is_favorite
        ) VALUES (
            p_user_id,
            v_query_hash,
            p_natural_language_query,
            p_generated_sql,
            p_execution_status,
            p_execution_time_ms,
            p_row_count,
            p_error_message,
            p_query_name,
            1,  -- execution_count starts at 1
            NOW(),
            NOW(),
            FALSE  -- not favorite by default
        )
        RETURNING id INTO v_query_id;
        
        RETURN v_query_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.upsert_query_history IS 'Simplified upsert for query history - only essential columns, no LLM internal data';

