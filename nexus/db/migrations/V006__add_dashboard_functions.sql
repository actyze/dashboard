-- Migration: Add missing dashboard functions and tables
-- Version: V006
-- Description: Add dashboard_tiles table and RBAC functions

-- =====================================================
-- 1. Dashboard Tiles Table
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus.dashboard_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES nexus.dashboards(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL,
    natural_language_query TEXT,
    chart_type VARCHAR(50) DEFAULT 'table',
    chart_config JSONB DEFAULT '{}'::jsonb,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 4,
    height INTEGER DEFAULT 4,
    refresh_interval_seconds INTEGER DEFAULT 300,
    created_by UUID REFERENCES nexus.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tiles_dashboard_id ON nexus.dashboard_tiles(dashboard_id);

-- =====================================================
-- 2. Dashboard Permissions Table (for RBAC)
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus.dashboard_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES nexus.dashboards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES nexus.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES nexus.groups(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_share BOOLEAN DEFAULT FALSE,
    granted_by UUID REFERENCES nexus.users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    CONSTRAINT chk_user_or_group CHECK (
        (user_id IS NOT NULL AND group_id IS NULL) OR 
        (user_id IS NULL AND group_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_dashboard ON nexus.dashboard_permissions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user ON nexus.dashboard_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_group ON nexus.dashboard_permissions(group_id);

-- =====================================================
-- 3. RBAC Helper Function
-- =====================================================
CREATE OR REPLACE FUNCTION nexus.user_has_dashboard_permission(
    p_user_id UUID,
    p_dashboard_id UUID,
    p_permission VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    is_owner BOOLEAN;
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
    
    -- Check if user is admin/superadmin (admins have all permissions)
    IF EXISTS (
        SELECT 1 FROM nexus.user_roles ur
        JOIN nexus.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
        AND LOWER(r.name) IN ('admin', 'superadmin')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check direct permissions
    SELECT CASE p_permission
        WHEN 'view' THEN COALESCE(MAX(dp.can_view), FALSE)
        WHEN 'edit' THEN COALESCE(MAX(dp.can_edit), FALSE)
        WHEN 'delete' THEN COALESCE(MAX(dp.can_delete), FALSE)
        WHEN 'share' THEN COALESCE(MAX(dp.can_share), FALSE)
        ELSE FALSE
    END INTO has_permission
    FROM nexus.dashboard_permissions dp
    WHERE dp.dashboard_id = p_dashboard_id
    AND (dp.user_id = p_user_id OR dp.group_id IN (
        SELECT group_id FROM nexus.user_groups WHERE user_id = p_user_id
    ))
    AND (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP);
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. Get User Dashboards Function
-- =====================================================
CREATE OR REPLACE FUNCTION nexus.get_user_dashboards(p_user_id UUID)
RETURNS TABLE (
    dashboard_id UUID,
    title VARCHAR,
    description TEXT,
    owner_user_id UUID,
    owner_username VARCHAR,
    is_public BOOLEAN,
    is_anonymous_public BOOLEAN,
    is_favorite BOOLEAN,
    tags JSONB,
    tile_count BIGINT,
    can_view BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_share BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_accessed_at TIMESTAMP,
    status VARCHAR,
    version INTEGER,
    published_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        d.id,
        d.title,
        d.description,
        d.owner_user_id,
        u.username,
        d.is_public,
        COALESCE(d.is_anonymous_public, FALSE),
        COALESCE(d.is_favorite, FALSE),
        COALESCE(d.tags, '[]'::jsonb),
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'view'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'edit'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'delete'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'share'),
        d.created_at,
        d.updated_at,
        d.last_accessed_at,
        COALESCE(d.status, 'published'),
        COALESCE(d.version, 1),
        d.published_at
    FROM nexus.dashboards d
    LEFT JOIN nexus.users u ON d.owner_user_id = u.id
    WHERE 
        -- Owner sees everything
        d.owner_user_id = p_user_id
        -- OR has permission
        OR nexus.user_has_dashboard_permission(p_user_id, d.id, 'view')
        -- OR is public
        OR d.is_public = TRUE
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Get Anonymous Public Dashboards Function
-- =====================================================
CREATE OR REPLACE FUNCTION nexus.get_anonymous_public_dashboards()
RETURNS TABLE (
    dashboard_id UUID,
    title VARCHAR,
    description TEXT,
    layout_config JSONB,
    tags JSONB,
    tile_count BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.description,
        COALESCE(d.layout_config, '{}'::jsonb),
        COALESCE(d.tags, '[]'::jsonb),
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        d.created_at,
        d.updated_at
    FROM nexus.dashboards d
    WHERE d.is_anonymous_public = TRUE
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Grant Permissions
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.dashboard_tiles TO nexus_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.dashboard_permissions TO nexus_service;

