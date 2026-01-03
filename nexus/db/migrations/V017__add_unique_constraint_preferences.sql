-- V017: Add missing UNIQUE constraint to user_schema_preferences
-- Prevents duplicate preferences for the same resource

-- Step 1: Delete duplicate entries (keep the most recent one for each resource)
DELETE FROM nexus.user_schema_preferences
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, COALESCE(catalog, ''), COALESCE(database_name, ''), COALESCE(schema_name, ''), COALESCE(table_name, ''))
        id
    FROM nexus.user_schema_preferences
    ORDER BY user_id, COALESCE(catalog, ''), COALESCE(database_name, ''), COALESCE(schema_name, ''), COALESCE(table_name, ''), created_at DESC
);

-- Step 2: Add the UNIQUE constraint
-- Note: We use COALESCE to handle NULLs since NULL != NULL in SQL
-- This constraint ensures no duplicate preferences for the same resource
ALTER TABLE nexus.user_schema_preferences 
ADD CONSTRAINT user_schema_preferences_unique_resource 
UNIQUE (user_id, catalog, database_name, schema_name, table_name);

-- Add comment
COMMENT ON CONSTRAINT user_schema_preferences_unique_resource ON nexus.user_schema_preferences 
IS 'Ensures each user can only have one preference per unique resource path';

