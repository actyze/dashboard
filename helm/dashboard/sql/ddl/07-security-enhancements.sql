-- Security Enhancements for User Management
-- Adds:
-- 1. SUPERADMIN role (global root access)
-- 2. Case-insensitive unique constraints for usernames, emails, role names, group names
-- 3. Protection against deletion of last SUPERADMIN

SET search_path TO nexus, public;

-- =============================================================================
-- 1. ADD SUPERADMIN ROLE
-- =============================================================================

-- Create SUPERADMIN role with global root privileges
INSERT INTO nexus.roles (name, description) 
SELECT 'SUPERADMIN', 'Global root access: Manage all users, roles, groups, system config, billing. Can promote/demote ADMINs.'
WHERE NOT EXISTS (SELECT 1 FROM nexus.roles WHERE LOWER(name) = 'superadmin');

-- Update ADMIN role description to clarify it's scoped (not global root)
UPDATE nexus.roles 
SET description = 'Scoped administrative access: Manage users and groups within assigned scope. Cannot promote other ADMINs.'
WHERE LOWER(name) = 'admin';

-- Assign SUPERADMIN role to bootstrap user
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'nexus_admin' AND LOWER(r.name) = 'superadmin'
  AND NOT EXISTS (
    SELECT 1 FROM nexus.user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- =============================================================================
-- 2. CASE-INSENSITIVE UNIQUE CONSTRAINTS
-- =============================================================================

-- Drop old simple unique constraints if they exist
ALTER TABLE nexus.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE nexus.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE nexus.roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE nexus.groups DROP CONSTRAINT IF EXISTS groups_name_key;

-- Create case-insensitive unique indexes for users table
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique 
  ON nexus.users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique 
  ON nexus.users (LOWER(email));

-- Create case-insensitive unique index for roles table
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_lower_unique 
  ON nexus.roles (LOWER(name));

-- Create case-insensitive unique index for groups table
CREATE UNIQUE INDEX IF NOT EXISTS groups_name_lower_unique 
  ON nexus.groups (LOWER(name));

-- Add comments for documentation
COMMENT ON INDEX nexus.users_username_lower_unique IS 'Prevents duplicate usernames with different casing (e.g., John, john, JOHN)';
COMMENT ON INDEX nexus.users_email_lower_unique IS 'Prevents duplicate emails with different casing';
COMMENT ON INDEX nexus.roles_name_lower_unique IS 'Prevents duplicate role names with different casing';
COMMENT ON INDEX nexus.groups_name_lower_unique IS 'Prevents duplicate group names with different casing';

-- =============================================================================
-- 3. PREVENT LAST SUPERADMIN DELETION
-- =============================================================================

-- Function to prevent deletion of last SUPERADMIN
CREATE OR REPLACE FUNCTION nexus.prevent_last_superadmin_deletion()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_count INTEGER;
    is_superadmin BOOLEAN;
    deleted_username VARCHAR(255);
BEGIN
    -- Check if the role being deleted is SUPERADMIN
    SELECT EXISTS (
        SELECT 1 FROM nexus.roles r
        WHERE r.id = OLD.role_id AND LOWER(r.name) = 'superadmin'
    ) INTO is_superadmin;
    
    -- If deleting a SUPERADMIN role assignment, check if they're the last one
    IF is_superadmin THEN
        -- Count remaining SUPERADMINs (excluding the one being deleted)
        SELECT COUNT(DISTINCT ur.user_id) INTO superadmin_count
        FROM nexus.user_roles ur
        JOIN nexus.roles r ON ur.role_id = r.id
        WHERE LOWER(r.name) = 'superadmin' 
          AND ur.user_id != OLD.user_id;
        
        IF superadmin_count = 0 THEN
            -- Get username for better error message
            SELECT username INTO deleted_username 
            FROM nexus.users 
            WHERE id = OLD.user_id;
            
            RAISE EXCEPTION 'Cannot remove SUPERADMIN role from user "%". This is the last SUPERADMIN in the system. At least one SUPERADMIN must exist.', deleted_username;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_roles table
DROP TRIGGER IF EXISTS prevent_last_superadmin_trigger ON nexus.user_roles;
CREATE TRIGGER prevent_last_superadmin_trigger
    BEFORE DELETE ON nexus.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION nexus.prevent_last_superadmin_deletion();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify SUPERADMIN role exists
DO $$
DECLARE
    superadmin_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM nexus.roles WHERE LOWER(name) = 'superadmin') INTO superadmin_exists;
    
    IF NOT superadmin_exists THEN
        RAISE WARNING 'SUPERADMIN role was not created properly!';
    ELSE
        RAISE NOTICE 'SUPERADMIN role created successfully';
    END IF;
END $$;

-- Verify bootstrap user has SUPERADMIN
DO $$
DECLARE
    has_superadmin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM nexus.user_roles ur
        JOIN nexus.users u ON ur.user_id = u.id
        JOIN nexus.roles r ON ur.role_id = r.id
        WHERE LOWER(u.username) = 'nexus_admin' AND LOWER(r.name) = 'superadmin'
    ) INTO has_superadmin;
    
    IF NOT has_superadmin THEN
        RAISE WARNING 'Bootstrap user nexus_admin does not have SUPERADMIN role!';
    ELSE
        RAISE NOTICE 'Bootstrap user nexus_admin has SUPERADMIN role';
    END IF;
END $$;

-- Show final role hierarchy
SELECT 
    r.name as role,
    COUNT(DISTINCT ur.user_id) as user_count,
    r.description
FROM nexus.roles r
LEFT JOIN nexus.user_roles ur ON r.id = ur.role_id
GROUP BY r.name, r.description
ORDER BY 
    CASE r.name 
        WHEN 'SUPERADMIN' THEN 1
        WHEN 'ADMIN' THEN 2
        WHEN 'EDITOR' THEN 3
        WHEN 'VIEWER' THEN 4
    END;

