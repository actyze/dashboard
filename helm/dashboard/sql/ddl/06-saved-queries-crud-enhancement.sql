-- Enhancement to Saved Queries Table
-- Adds support for full CRUD operations and better integration with query history

SET search_path TO nexus, public;

-- Enhance saved_queries table with additional fields
ALTER TABLE nexus.saved_queries 
  ADD COLUMN IF NOT EXISTS chart_recommendation JSONB,
  ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_from_history_id INTEGER REFERENCES nexus.query_history(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN nexus.saved_queries.chart_recommendation IS 'LLM chart recommendation saved with the query';
COMMENT ON COLUMN nexus.saved_queries.execution_count IS 'Number of times this saved query has been executed';
COMMENT ON COLUMN nexus.saved_queries.last_executed_at IS 'Last time this saved query was executed';
COMMENT ON COLUMN nexus.saved_queries.created_from_history_id IS 'Reference to query_history entry this was saved from';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_queries_user_favorite ON nexus.saved_queries(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_queries_updated ON nexus.saved_queries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_queries_last_executed ON nexus.saved_queries(last_executed_at DESC) WHERE last_executed_at IS NOT NULL;

-- Create a view for easy querying with user details
CREATE OR REPLACE VIEW nexus.saved_queries_with_users AS
SELECT 
  sq.id,
  sq.user_id,
  u.username,
  u.email,
  sq.owner_group_id,
  g.name as group_name,
  sq.query_name,
  sq.description,
  sq.natural_language_query,
  sq.generated_sql,
  sq.is_favorite,
  sq.tags,
  sq.chart_recommendation,
  sq.execution_count,
  sq.last_executed_at,
  sq.created_from_history_id,
  sq.created_at,
  sq.updated_at
FROM nexus.saved_queries sq
LEFT JOIN nexus.users u ON sq.user_id = u.id
LEFT JOIN nexus.groups g ON sq.owner_group_id = g.id;

GRANT SELECT ON nexus.saved_queries_with_users TO nexus_service;

-- Create a function to increment execution count
CREATE OR REPLACE FUNCTION nexus.increment_saved_query_execution(query_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE nexus.saved_queries
  SET 
    execution_count = execution_count + 1,
    last_executed_at = NOW(),
    updated_at = NOW()
  WHERE id = query_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to save from history
CREATE OR REPLACE FUNCTION nexus.save_query_from_history(
  p_user_id UUID,
  p_history_id INTEGER,
  p_query_name VARCHAR(200),
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_query_id INTEGER;
  v_history_record RECORD;
BEGIN
  -- Get history record
  SELECT * INTO v_history_record
  FROM nexus.query_history
  WHERE id = p_history_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query history not found or access denied';
  END IF;
  
  -- Check if already saved
  SELECT id INTO v_query_id
  FROM nexus.saved_queries
  WHERE user_id = p_user_id 
    AND created_from_history_id = p_history_id;
  
  IF FOUND THEN
    -- Update existing
    UPDATE nexus.saved_queries
    SET 
      query_name = p_query_name,
      description = COALESCE(p_description, description),
      updated_at = NOW()
    WHERE id = v_query_id;
  ELSE
    -- Insert new
    INSERT INTO nexus.saved_queries (
      user_id,
      query_name,
      description,
      natural_language_query,
      generated_sql,
      chart_recommendation,
      created_from_history_id,
      tags
    ) VALUES (
      p_user_id,
      p_query_name,
      p_description,
      v_history_record.natural_language_query,
      v_history_record.generated_sql,
      v_history_record.chart_recommendation,
      p_history_id,
      '{}'::jsonb
    )
    RETURNING id INTO v_query_id;
  END IF;
  
  RETURN v_query_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nexus.save_query_from_history IS 'Creates a saved query from a query history entry';

