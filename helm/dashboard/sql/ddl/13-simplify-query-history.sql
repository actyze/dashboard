-- =====================================================
-- Simplify Query History - Single Table Design
-- =====================================================
-- Changes:
-- 1. Drop favorite_queries and favorite_query_versions tables
-- 2. Add is_favorite flag to query_history
-- 3. Migrate any favorite queries to query_history
-- 4. Drop obsolete views and functions
-- 5. Create simplified views
-- =====================================================

-- =====================================================
-- PART 1: Migrate favorites to query_history
-- =====================================================

-- Add is_favorite column if not exists
ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Add favorite_name column (optional name for favorites)
ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS favorite_name VARCHAR(255);

-- Add tags column (for favorites)
ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Migrate existing favorite_queries to query_history (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'nexus' 
        AND table_name = 'favorite_queries'
    ) THEN
        -- For each favorite query, either update existing query_history or create new entry
        INSERT INTO nexus.query_history (
            user_id,
            natural_language_query,
            generated_sql,
            query_hash,
            execution_count,
            last_executed_at,
            execution_status,
            row_count,
            execution_time_ms,
            schema_recommendations,
            chart_recommendation,
            model_reasoning,
            is_favorite,
            favorite_name,
            tags,
            created_at
        )
        SELECT 
            fq.user_id,
            fq.natural_language_query,
            fq.generated_sql,
            nexus.generate_query_hash(fq.generated_sql, fq.user_id),
            COALESCE(fq.execution_count, 0),
            fq.last_executed_at,
            'SUCCESS',
            0,
            0,
            NULL,
            fq.chart_recommendation,
            NULL,
            TRUE, -- Mark as favorite
            fq.query_name,
            fq.tags,
            fq.created_at
        FROM nexus.favorite_queries fq
        ON CONFLICT (query_hash) DO UPDATE SET
            is_favorite = TRUE,
            favorite_name = EXCLUDED.favorite_name,
            tags = EXCLUDED.tags;
    END IF;
END $$;

-- =====================================================
-- PART 2: Drop obsolete tables
-- =====================================================

-- Drop favorite_query_versions first (has FK to favorite_queries)
DROP TABLE IF EXISTS nexus.favorite_query_versions CASCADE;

-- Drop favorite_queries
DROP TABLE IF EXISTS nexus.favorite_queries CASCADE;

-- Drop obsolete views
DROP VIEW IF EXISTS nexus.favorite_queries_with_users CASCADE;
DROP VIEW IF EXISTS nexus.query_history_summary CASCADE;

-- =====================================================
-- PART 3: Drop obsolete functions
-- =====================================================

DROP FUNCTION IF EXISTS nexus.create_favorite_query_version CASCADE;
DROP FUNCTION IF EXISTS nexus.update_favorite_query_sql CASCADE;
DROP FUNCTION IF EXISTS nexus.revert_favorite_query_version CASCADE;
DROP FUNCTION IF EXISTS nexus.update_saved_query_execution_stats CASCADE;

-- =====================================================
-- PART 4: Update query_history structure
-- =====================================================

-- Ensure query_hash is unique per user
-- Note: We use CREATE UNIQUE INDEX IF NOT EXISTS, but need to handle duplicates first
-- Remove duplicate query_hash entries (keep the most recent)
DELETE FROM nexus.query_history
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY query_hash 
                   ORDER BY last_executed_at DESC NULLS LAST, created_at DESC
               ) AS rn
        FROM nexus.query_history
        WHERE query_hash IS NOT NULL
    ) t
    WHERE rn > 1
);

-- Now create unique constraint on query_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_query_history_hash_unique 
    ON nexus.query_history(query_hash) 
    WHERE query_hash IS NOT NULL;

-- Create index for favorites
CREATE INDEX IF NOT EXISTS idx_query_history_favorites 
    ON nexus.query_history(user_id, is_favorite, last_executed_at DESC)
    WHERE is_favorite = TRUE;

-- =====================================================
-- PART 5: Update upsert function for simplified design
-- =====================================================

CREATE OR REPLACE FUNCTION nexus.upsert_query_history(
    p_user_id UUID,
    p_session_id VARCHAR,
    p_natural_language_query TEXT,
    p_generated_sql TEXT,
    p_execution_status VARCHAR,
    p_execution_time_ms INTEGER,
    p_row_count INTEGER,
    p_error_message TEXT,
    p_schema_recommendations JSONB,
    p_chart_recommendation JSONB,
    p_model_confidence NUMERIC,
    p_llm_response_time_ms INTEGER,
    p_retry_attempts INTEGER,
    p_model_reasoning TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_query_hash VARCHAR(64);
    v_query_id INTEGER;
BEGIN
    -- Generate hash for de-duplication
    v_query_hash := nexus.generate_query_hash(p_generated_sql, p_user_id);
    
    -- Upsert: If hash exists, update counts; otherwise insert new
    INSERT INTO nexus.query_history (
        user_id,
        session_id,
        natural_language_query,
        generated_sql,
        query_hash,
        execution_status,
        execution_time_ms,
        row_count,
        error_message,
        schema_recommendations,
        chart_recommendation,
        model_confidence,
        llm_response_time_ms,
        retry_attempts,
        model_reasoning,
        execution_count,
        last_executed_at,
        created_at
    ) VALUES (
        p_user_id,
        p_session_id,
        p_natural_language_query,
        p_generated_sql,
        v_query_hash,
        p_execution_status,
        p_execution_time_ms,
        p_row_count,
        p_error_message,
        p_schema_recommendations,
        p_chart_recommendation,
        p_model_confidence,
        p_llm_response_time_ms,
        p_retry_attempts,
        p_model_reasoning,
        1, -- execution_count
        CURRENT_TIMESTAMP, -- last_executed_at
        CURRENT_TIMESTAMP -- created_at
    )
    ON CONFLICT (query_hash) DO UPDATE SET
        execution_count = nexus.query_history.execution_count + 1,
        last_executed_at = CURRENT_TIMESTAMP,
        execution_status = p_execution_status,
        execution_time_ms = p_execution_time_ms,
        row_count = p_row_count,
        error_message = p_error_message,
        -- Keep the most recent reasoning/recommendations
        model_reasoning = COALESCE(p_model_reasoning, nexus.query_history.model_reasoning),
        schema_recommendations = COALESCE(p_schema_recommendations, nexus.query_history.schema_recommendations),
        chart_recommendation = COALESCE(p_chart_recommendation, nexus.query_history.chart_recommendation)
    RETURNING id INTO v_query_id;
    
    RETURN v_query_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: Create simplified view
-- =====================================================

-- Drop old view if exists
DROP VIEW IF EXISTS nexus.query_history_with_users;

-- Recreate with simplified structure
CREATE OR REPLACE VIEW nexus.query_history_with_users AS
SELECT 
    qh.id,
    qh.user_id,
    u.username,
    u.email AS user_email,
    qh.session_id,
    qh.natural_language_query,
    qh.generated_sql,
    qh.query_hash,
    qh.execution_status,
    qh.execution_time_ms,
    qh.row_count,
    qh.error_message,
    qh.schema_recommendations,
    qh.chart_recommendation,
    qh.model_confidence,
    qh.model_reasoning,
    qh.llm_response_time_ms,
    qh.retry_attempts,
    qh.execution_count,
    qh.last_executed_at,
    qh.is_favorite,
    qh.favorite_name,
    qh.tags,
    qh.created_at
FROM nexus.query_history qh
LEFT JOIN nexus.users u ON qh.user_id = u.id;

COMMENT ON VIEW nexus.query_history_with_users IS 'Query history with user details - simplified single-table design';

-- =====================================================
-- PART 7: Add helper functions for favorites
-- =====================================================

-- Toggle favorite status
CREATE OR REPLACE FUNCTION nexus.toggle_favorite(
    p_query_id INTEGER,
    p_favorite_name VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_favorite BOOLEAN;
BEGIN
    UPDATE nexus.query_history
    SET 
        is_favorite = NOT is_favorite,
        favorite_name = CASE 
            WHEN NOT is_favorite THEN COALESCE(p_favorite_name, favorite_name, 'Unnamed Favorite')
            ELSE favorite_name 
        END
    WHERE id = p_query_id
    RETURNING is_favorite INTO v_is_favorite;
    
    RETURN v_is_favorite;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.toggle_favorite IS 'Toggle favorite status for a query history entry';

-- Get favorite queries for a user
CREATE OR REPLACE FUNCTION nexus.get_user_favorites(
    p_user_id UUID
) RETURNS TABLE (
    id INTEGER,
    favorite_name VARCHAR,
    natural_language_query TEXT,
    generated_sql TEXT,
    execution_count INTEGER,
    last_executed_at TIMESTAMP,
    tags TEXT[],
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qh.id,
        qh.favorite_name,
        qh.natural_language_query,
        qh.generated_sql,
        qh.execution_count,
        qh.last_executed_at,
        qh.tags,
        qh.created_at
    FROM nexus.query_history qh
    WHERE qh.user_id = p_user_id 
      AND qh.is_favorite = TRUE
    ORDER BY qh.last_executed_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.get_user_favorites IS 'Get all favorite queries for a user';

-- =====================================================
-- Summary
-- =====================================================
-- After this migration:
-- - ONE main table: query_history (with is_favorite flag)
-- - ONE view: query_history_with_users (for joins)
-- - THREE functions: generate_query_hash, upsert_query_history, toggle_favorite
-- - Hash-based deduplication per user
-- - Execution count tracking
-- - Favorite flag instead of separate table
-- =====================================================

