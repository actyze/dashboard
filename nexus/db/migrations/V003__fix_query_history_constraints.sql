-- Migration: Fix query_history NOT NULL constraints
-- Version: V003
-- Description: Make session_id and natural_language_query nullable for user-controlled saves

-- Make session_id nullable (no longer required for user-controlled saves)
ALTER TABLE nexus.query_history 
ALTER COLUMN session_id DROP NOT NULL;

-- Make natural_language_query nullable (not always provided for saved queries)
ALTER TABLE nexus.query_history 
ALTER COLUMN natural_language_query DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN nexus.query_history.session_id IS 'Session identifier (nullable for saved queries)';
COMMENT ON COLUMN nexus.query_history.natural_language_query IS 'Original natural language query (nullable for manually saved SQL)';

