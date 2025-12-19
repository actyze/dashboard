-- =====================================================
-- Fix dashboard updated_at trigger
-- =====================================================
-- Problem: Every time a dashboard is viewed, last_accessed_at is updated,
-- which triggers the generic trigger_set_timestamp() function to also 
-- update updated_at. This makes it appear that the dashboard was modified
-- when it was only viewed.
--
-- Solution: Create a dashboard-specific trigger that only updates updated_at
-- when fields other than last_accessed_at are changed.
-- =====================================================

-- Create dashboard-specific trigger function
CREATE OR REPLACE FUNCTION nexus.dashboard_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update updated_at if something other than last_accessed_at changed
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.configuration IS DISTINCT FROM NEW.configuration OR
    OLD.layout_config IS DISTINCT FROM NEW.layout_config OR
    OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id OR
    OLD.owner_group_id IS DISTINCT FROM NEW.owner_group_id OR
    OLD.is_public IS DISTINCT FROM NEW.is_public OR
    OLD.is_anonymous_public IS DISTINCT FROM NEW.is_anonymous_public OR
    OLD.is_favorite IS DISTINCT FROM NEW.is_favorite OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.version IS DISTINCT FROM NEW.version OR
    OLD.published_at IS DISTINCT FROM NEW.published_at OR
    OLD.published_by IS DISTINCT FROM NEW.published_by
  ) THEN
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the trigger with the new dashboard-specific one
DROP TRIGGER IF EXISTS set_timestamp_dashboards ON nexus.dashboards;
CREATE TRIGGER set_timestamp_dashboards 
  BEFORE UPDATE ON nexus.dashboards 
  FOR EACH ROW 
  EXECUTE PROCEDURE nexus.dashboard_set_timestamp();

-- Add comment for documentation
COMMENT ON FUNCTION nexus.dashboard_set_timestamp() IS 
  'Dashboard-specific trigger function that only updates updated_at when content changes, not when last_accessed_at changes';

