-- Migration: Drop old INTEGER version of generate_upload_table_name
-- Keep only the UUID version to avoid ambiguity

-- Drop the old INTEGER version
DROP FUNCTION IF EXISTS nexus.generate_upload_table_name(INTEGER, VARCHAR);

-- Verify only UUID version remains
-- The UUID version was created in V015__fix_user_id_uuid.sql

