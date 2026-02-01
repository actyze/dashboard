-- V023: Add READONLY Role
-- Introduces a read-only user role with restricted permissions

-- ============================================================================
-- STEP 1: Add READONLY Role
-- ============================================================================

INSERT INTO nexus.roles (name, description)
VALUES ('READONLY', 'Read-only user with view-only access to data intelligence, cannot create/edit/delete dashboards or upload files')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description;

-- ============================================================================
-- STEP 2: Update get_user_accessible_resources to include READONLY users
-- READONLY users get same data access as regular users (via user_data_access)
-- ============================================================================

-- No changes needed - READONLY users use user_data_access table same as USER role

-- ============================================================================
-- STEP 3: Update user_can_access_resource to handle READONLY same as USER
-- ============================================================================

-- No changes needed - READONLY users checked via user_data_access, not given blanket access

-- ============================================================================
-- Role Summary:
-- ============================================================================
-- ADMIN: Full system access, user management, license management, can enable/disable schemas
-- USER: Regular user, can create/edit/delete own dashboards, upload CSVs, query data based on user_data_access
-- READONLY: View-only access to data intelligence, cannot create/edit/delete anything, no CSV upload, no admin access

