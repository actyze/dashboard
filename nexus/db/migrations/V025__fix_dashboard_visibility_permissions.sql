-- =====================================================
-- Fix Dashboard Permission Function to Support Visibility
-- =====================================================
-- This migration fixes the user_has_dashboard_permission function
-- to properly support dashboard visibility modes:
-- - is_public = TRUE: Within company (all authenticated users can view)
-- - is_anonymous_public = TRUE: Anyone with link (all users can view)
-- =====================================================

CREATE OR REPLACE FUNCTION nexus.user_has_dashboard_permission(
    p_user_id UUID,
    p_dashboard_id UUID,
    p_permission VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    is_owner BOOLEAN;
    is_public BOOLEAN;
    is_anonymous_public BOOLEAN;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Check if user is owner (owners have all permissions)
    SELECT EXISTS (
        SELECT 1 FROM nexus.dashboards 
        WHERE id = p_dashboard_id AND owner_user_id = p_user_id
    ) INTO is_owner;
    
    IF is_owner THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is admin (admins have all permissions)
    IF EXISTS (
        SELECT 1 FROM nexus.user_roles ur
        JOIN nexus.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
        AND r.name = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check dashboard visibility settings for view permission
    IF p_permission = 'view' THEN
        SELECT 
            COALESCE(d.is_public, FALSE),
            COALESCE(d.is_anonymous_public, FALSE)
        INTO is_public, is_anonymous_public
        FROM nexus.dashboards d
        WHERE d.id = p_dashboard_id;
        
        -- If dashboard is public (within company), all authenticated users can view
        IF is_public THEN
            RETURN TRUE;
        END IF;
        
        -- If dashboard is anonymous public (anyone with link), all users can view
        IF is_anonymous_public THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Check direct user permissions (no group permissions in simplified model)
    SELECT CASE p_permission
        WHEN 'view' THEN COALESCE(bool_or(dp.can_view), FALSE)
        WHEN 'edit' THEN COALESCE(bool_or(dp.can_edit), FALSE)
        WHEN 'delete' THEN COALESCE(bool_or(dp.can_delete), FALSE)
        WHEN 'share' THEN COALESCE(bool_or(dp.can_share), FALSE)
        ELSE FALSE
    END INTO has_permission
    FROM nexus.dashboard_permissions dp
    WHERE dp.dashboard_id = p_dashboard_id
    AND dp.user_id = p_user_id
    AND (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP);
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
