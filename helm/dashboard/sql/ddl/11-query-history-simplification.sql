-- =====================================================
-- Query History Simplification & Favorite Query Versioning
-- =====================================================
-- Changes:
-- 1. Rename saved_queries → favorite_queries
-- 2. Add query_hash to query_history for de-duplication
-- 3. Simplify query_history (remove first_executed, avg stats)
-- 4. Add favorite_query_versions table for versioning
-- 5. Add helper functions for hash generation and versioning
-- =====================================================

-- Enable pgcrypto extension for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- PART 1: Rename saved_queries to favorite_queries
-- =====================================================

-- Rename the table
ALTER TABLE IF EXISTS nexus.saved_queries 
    RENAME TO favorite_queries;

-- Rename indexes and constraints
ALTER INDEX IF EXISTS nexus.saved_queries_pkey 
    RENAME TO favorite_queries_pkey;

ALTER INDEX IF EXISTS nexus.idx_saved_queries_user 
    RENAME TO idx_favorite_queries_user;

ALTER INDEX IF EXISTS nexus.idx_saved_queries_group 
    RENAME TO idx_favorite_queries_group;

-- Update foreign key constraint names (if they exist with saved_queries prefix)
DO $$
BEGIN
    -- Check and rename foreign key constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'saved_queries_user_id_fkey' 
        AND table_name = 'favorite_queries'
        AND table_schema = 'nexus'
    ) THEN
        ALTER TABLE nexus.favorite_queries 
            RENAME CONSTRAINT saved_queries_user_id_fkey TO favorite_queries_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'saved_queries_owner_group_id_fkey' 
        AND table_name = 'favorite_queries'
        AND table_schema = 'nexus'
    ) THEN
        ALTER TABLE nexus.favorite_queries 
            RENAME CONSTRAINT saved_queries_owner_group_id_fkey TO favorite_queries_owner_group_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'saved_queries_created_from_history_id_fkey' 
        AND table_name = 'favorite_queries'
        AND table_schema = 'nexus'
    ) THEN
        ALTER TABLE nexus.favorite_queries 
            RENAME CONSTRAINT saved_queries_created_from_history_id_fkey TO favorite_queries_created_from_history_id_fkey;
    END IF;
END $$;

-- Add version column to favorite_queries if not exists
ALTER TABLE nexus.favorite_queries 
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- =====================================================
-- PART 2: Add columns to query_history for de-duplication
-- =====================================================

-- Add new columns to query_history
-- query_hash: MD5 hash for de-duplication (32-char hex)
ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS query_hash VARCHAR(64);

ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 1;

ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP;

ALTER TABLE nexus.query_history 
    ADD COLUMN IF NOT EXISTS model_reasoning TEXT;

-- Make session_id nullable (not always available in de-duplication)
ALTER TABLE nexus.query_history 
    ALTER COLUMN session_id DROP NOT NULL;

-- Backfill last_executed_at with executed_at for existing rows
UPDATE nexus.query_history 
SET last_executed_at = executed_at 
WHERE last_executed_at IS NULL AND executed_at IS NOT NULL;

-- Create function to generate query hash
CREATE OR REPLACE FUNCTION nexus.generate_query_hash(
    p_sql TEXT,
    p_user_id UUID
) RETURNS VARCHAR(64) AS $$
BEGIN
    -- Hash = MD5(normalized SQL + user_id)
    -- Normalize SQL by trimming whitespace and converting to lowercase
    -- MD5 is sufficient for de-duplication (32-char hex string)
    RETURN md5(
        LOWER(REGEXP_REPLACE(p_sql, '\s+', ' ', 'g')) || '::' || p_user_id::TEXT
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill query_hash for existing rows (conservative - keep existing data)
UPDATE nexus.query_history
SET query_hash = nexus.generate_query_hash(generated_sql, user_id)
WHERE query_hash IS NULL;

-- Create unique index on query_hash for efficient lookups
-- Note: We don't make it UNIQUE at table level since we're keeping existing duplicate rows
CREATE INDEX IF NOT EXISTS idx_query_history_hash 
    ON nexus.query_history(query_hash);

-- Create index on user_id + last_executed_at for ordering
CREATE INDEX IF NOT EXISTS idx_query_history_user_last_executed 
    ON nexus.query_history(user_id, last_executed_at DESC);

-- =====================================================
-- PART 3: Create favorite_query_versions table
-- =====================================================

CREATE TABLE IF NOT EXISTS nexus.favorite_query_versions (
    id SERIAL PRIMARY KEY,
    favorite_query_id INTEGER NOT NULL REFERENCES nexus.favorite_queries(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of query at this version
    query_name VARCHAR(255) NOT NULL,
    description TEXT,
    natural_language_query TEXT,
    generated_sql TEXT NOT NULL,
    chart_recommendation JSONB,
    
    -- Version metadata
    version_notes TEXT,
    created_by UUID REFERENCES nexus.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT favorite_query_versions_unique_version 
        UNIQUE (favorite_query_id, version)
);

-- Create index for version lookups
CREATE INDEX IF NOT EXISTS idx_favorite_query_versions_query 
    ON nexus.favorite_query_versions(favorite_query_id, version DESC);

-- =====================================================
-- PART 4: Helper Functions
-- =====================================================

-- Drop existing function if signature changed
DROP FUNCTION IF EXISTS nexus.upsert_query_history(UUID, TEXT, TEXT, VARCHAR, INTEGER, INTEGER, JSONB, TEXT, JSONB, INTEGER);

-- Function to find or create query history entry (de-duplication)
CREATE OR REPLACE FUNCTION nexus.upsert_query_history(
    p_user_id UUID,
    p_natural_language_query TEXT,
    p_generated_sql TEXT,
    p_execution_status VARCHAR(50),
    p_execution_time_ms INTEGER,
    p_row_count INTEGER,
    p_chart_recommendation JSONB DEFAULT NULL,
    p_model_reasoning TEXT DEFAULT NULL,
    p_schema_recommendations JSONB DEFAULT NULL,
    p_llm_response_time_ms INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_query_hash VARCHAR(64);
    v_history_id INTEGER;
    v_existing_count INTEGER;
BEGIN
    -- Generate hash
    v_query_hash := nexus.generate_query_hash(p_generated_sql, p_user_id);
    
    -- Try to find existing entry
    SELECT id, execution_count INTO v_history_id, v_existing_count
    FROM nexus.query_history
    WHERE query_hash = v_query_hash
    LIMIT 1;
    
    IF v_history_id IS NOT NULL THEN
        -- Update existing entry
        UPDATE nexus.query_history SET
            execution_count = execution_count + 1,
            last_executed_at = CURRENT_TIMESTAMP,
            execution_time_ms = p_execution_time_ms,
            row_count = p_row_count,
            execution_status = p_execution_status,
            -- Update metadata from most recent execution
            natural_language_query = COALESCE(p_natural_language_query, natural_language_query),
            chart_recommendation = COALESCE(p_chart_recommendation, chart_recommendation),
            model_reasoning = COALESCE(p_model_reasoning, model_reasoning),
            schema_recommendations = COALESCE(p_schema_recommendations, schema_recommendations),
            llm_response_time_ms = COALESCE(p_llm_response_time_ms, llm_response_time_ms),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_history_id;
        
        RETURN v_history_id;
    ELSE
        -- Create new entry
        INSERT INTO nexus.query_history (
            user_id,
            query_hash,
            natural_language_query,
            generated_sql,
            execution_status,
            execution_time_ms,
            row_count,
            chart_recommendation,
            model_reasoning,
            schema_recommendations,
            llm_response_time_ms,
            execution_count,
            last_executed_at,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            v_query_hash,
            p_natural_language_query,
            p_generated_sql,
            p_execution_status,
            p_execution_time_ms,
            p_row_count,
            p_chart_recommendation,
            p_model_reasoning,
            p_schema_recommendations,
            p_llm_response_time_ms,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        ) RETURNING id INTO v_history_id;
        
        RETURN v_history_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create a favorite query version snapshot
CREATE OR REPLACE FUNCTION nexus.create_favorite_query_version(
    p_favorite_query_id INTEGER,
    p_user_id UUID,
    p_version_notes TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_new_version INTEGER;
    v_query_record RECORD;
BEGIN
    -- Get current query details
    SELECT 
        query_name,
        description,
        natural_language_query,
        generated_sql,
        chart_recommendation
    INTO v_query_record
    FROM nexus.favorite_queries
    WHERE id = p_favorite_query_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Favorite query not found: %', p_favorite_query_id;
    END IF;
    
    -- Get the next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM nexus.favorite_query_versions
    WHERE favorite_query_id = p_favorite_query_id;
    
    -- Create version snapshot
    INSERT INTO nexus.favorite_query_versions (
        favorite_query_id,
        version,
        query_name,
        description,
        natural_language_query,
        generated_sql,
        chart_recommendation,
        version_notes,
        created_by,
        created_at
    ) VALUES (
        p_favorite_query_id,
        v_new_version,
        v_query_record.query_name,
        v_query_record.description,
        v_query_record.natural_language_query,
        v_query_record.generated_sql,
        v_query_record.chart_recommendation,
        COALESCE(
            p_version_notes,
            'Version ' || v_new_version || ' - SQL updated'
        ),
        p_user_id,
        CURRENT_TIMESTAMP
    );
    
    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- Function to update favorite query SQL (with automatic versioning)
CREATE OR REPLACE FUNCTION nexus.update_favorite_query_sql(
    p_favorite_query_id INTEGER,
    p_user_id UUID,
    p_new_sql TEXT,
    p_natural_language_query TEXT DEFAULT NULL,
    p_chart_recommendation JSONB DEFAULT NULL,
    p_version_notes TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_current_sql TEXT;
    v_new_version INTEGER;
BEGIN
    -- Get current SQL
    SELECT generated_sql INTO v_current_sql
    FROM nexus.favorite_queries
    WHERE id = p_favorite_query_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Favorite query not found: %', p_favorite_query_id;
    END IF;
    
    -- Check if SQL actually changed
    IF v_current_sql = p_new_sql THEN
        -- No change, return current version
        SELECT version INTO v_new_version
        FROM nexus.favorite_queries
        WHERE id = p_favorite_query_id;
        
        RETURN v_new_version;
    END IF;
    
    -- Create version snapshot of old SQL (before updating)
    v_new_version := nexus.create_favorite_query_version(
        p_favorite_query_id,
        p_user_id,
        p_version_notes
    );
    
    -- Update the query with new SQL and increment version
    UPDATE nexus.favorite_queries SET
        generated_sql = p_new_sql,
        natural_language_query = COALESCE(p_natural_language_query, natural_language_query),
        chart_recommendation = COALESCE(p_chart_recommendation, chart_recommendation),
        version = v_new_version + 1,  -- Increment version after snapshot
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_favorite_query_id;
    
    RETURN v_new_version + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to revert favorite query to a specific version
CREATE OR REPLACE FUNCTION nexus.revert_favorite_query_version(
    p_favorite_query_id INTEGER,
    p_target_version INTEGER,
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_version_record RECORD;
    v_new_version INTEGER;
BEGIN
    -- Get the target version snapshot
    SELECT 
        query_name,
        description,
        natural_language_query,
        generated_sql,
        chart_recommendation
    INTO v_version_record
    FROM nexus.favorite_query_versions
    WHERE favorite_query_id = p_favorite_query_id 
        AND version = p_target_version;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Version % not found for favorite query %', p_target_version, p_favorite_query_id;
    END IF;
    
    -- Create a new version before reverting (to preserve current state)
    v_new_version := nexus.create_favorite_query_version(
        p_favorite_query_id,
        p_user_id,
        'Auto-save before reverting to version ' || p_target_version
    );
    
    -- Restore from snapshot
    UPDATE nexus.favorite_queries SET
        query_name = v_version_record.query_name,
        description = v_version_record.description,
        natural_language_query = v_version_record.natural_language_query,
        generated_sql = v_version_record.generated_sql,
        chart_recommendation = v_version_record.chart_recommendation,
        version = v_new_version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_favorite_query_id;
    
    RETURN v_new_version + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 5: Update Views
-- =====================================================

-- Drop old views if they exist
DROP VIEW IF EXISTS nexus.saved_queries_with_users CASCADE;
DROP VIEW IF EXISTS nexus.query_history_with_users CASCADE;

-- Create new view for favorite queries with user details
CREATE OR REPLACE VIEW nexus.favorite_queries_with_users AS
SELECT 
    fq.*,
    u.username,
    u.full_name as user_full_name,
    u.email as user_email,
    g.name as group_name
FROM nexus.favorite_queries fq
JOIN nexus.users u ON fq.user_id = u.id
LEFT JOIN nexus.groups g ON fq.owner_group_id = g.id;

-- Create view for query history with aggregated stats
CREATE OR REPLACE VIEW nexus.query_history_with_users AS
SELECT 
    qh.id,
    qh.user_id,
    qh.query_hash,
    qh.session_id,
    qh.query_name,
    qh.query_type,
    qh.natural_language_query,
    qh.generated_sql,
    qh.execution_status,
    qh.execution_time_ms,
    qh.llm_response_time_ms,
    qh.row_count,
    qh.execution_count,
    qh.error_message,
    qh.schema_recommendations,
    qh.chart_recommendation,
    qh.model_confidence,
    qh.model_reasoning,
    qh.retry_attempts,
    qh.generated_at,
    qh.executed_at,
    qh.last_executed_at,
    qh.created_at,
    qh.updated_at,
    u.username,
    u.full_name as user_full_name,
    u.email as user_email,
    (SELECT COUNT(*) FROM nexus.favorite_queries WHERE created_from_history_id = qh.id) as favorited_count
FROM nexus.query_history qh
JOIN nexus.users u ON qh.user_id = u.id;

-- =====================================================
-- PART 6: Summary
-- =====================================================

DO $$
DECLARE
    v_favorite_count INTEGER;
    v_history_count INTEGER;
    v_version_count INTEGER;
    v_hash_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_favorite_count FROM nexus.favorite_queries;
    SELECT COUNT(*) INTO v_history_count FROM nexus.query_history;
    SELECT COUNT(*) INTO v_version_count FROM nexus.favorite_query_versions;
    SELECT COUNT(*) INTO v_hash_count FROM nexus.query_history WHERE query_hash IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Query History Simplification Complete';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Renamed: saved_queries → favorite_queries';
    RAISE NOTICE 'Favorite Queries: %', v_favorite_count;
    RAISE NOTICE 'Query History Entries: %', v_history_count;
    RAISE NOTICE 'Query Hashes Populated: %', v_hash_count;
    RAISE NOTICE 'Favorite Query Versions: %', v_version_count;
    RAISE NOTICE '';
    RAISE NOTICE 'New Functions:';
    RAISE NOTICE '  - nexus.generate_query_hash(sql, user_id)';
    RAISE NOTICE '  - nexus.upsert_query_history(...)';
    RAISE NOTICE '  - nexus.create_favorite_query_version(...)';
    RAISE NOTICE '  - nexus.update_favorite_query_sql(...)';
    RAISE NOTICE '  - nexus.revert_favorite_query_version(...)';
    RAISE NOTICE '';
    RAISE NOTICE 'New Views:';
    RAISE NOTICE '  - nexus.favorite_queries_with_users';
    RAISE NOTICE '  - nexus.query_history_with_users';
    RAISE NOTICE '=================================================';
END $$;

