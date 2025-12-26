-- Migration: Correct query_history schema to match helm DDL scripts
-- Version: V004
-- Description: Remove unnecessary columns that don't belong in user-controlled saves

-- Remove columns that don't belong in user-controlled query saves
ALTER TABLE nexus.query_history 
DROP COLUMN IF EXISTS session_id CASCADE,
DROP COLUMN IF EXISTS natural_language_query CASCADE,
DROP COLUMN IF EXISTS schema_recommendations CASCADE,
DROP COLUMN IF EXISTS model_confidence CASCADE,
DROP COLUMN IF EXISTS retry_attempts CASCADE,
DROP COLUMN IF EXISTS tags CASCADE;

-- Ensure query_name exists
ALTER TABLE nexus.query_history 
ADD COLUMN IF NOT EXISTS query_name VARCHAR(255);

-- Ensure is_favorite exists  
ALTER TABLE nexus.query_history 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Ensure updated_at exists
ALTER TABLE nexus.query_history 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_query_history_timestamp ON nexus.query_history;

CREATE TRIGGER update_query_history_timestamp
    BEFORE UPDATE ON nexus.query_history
    FOR EACH ROW
    EXECUTE FUNCTION nexus.trigger_set_timestamp();

-- Update query_history comments
COMMENT ON TABLE nexus.query_history IS 'User-saved queries (explicit saves only)';
COMMENT ON COLUMN nexus.query_history.query_name IS 'User-provided name for the query';
COMMENT ON COLUMN nexus.query_history.is_favorite IS 'User favorited this query';
COMMENT ON COLUMN nexus.query_history.created_at IS 'When query was first saved';
COMMENT ON COLUMN nexus.query_history.updated_at IS 'When query was last updated (determines display order)';

