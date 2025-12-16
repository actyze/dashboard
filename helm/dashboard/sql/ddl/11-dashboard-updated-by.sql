-- Add updated_by field to track who last modified the dashboard
-- This helps with audit trails and showing "last updated by" in the UI

-- 1. Add updated_by column to dashboards table
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES nexus.users(id) ON DELETE SET NULL;

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_dashboards_updated_by ON nexus.dashboards(updated_by);

-- 3. Update the get_user_dashboards function to return updated_by information
DROP FUNCTION IF EXISTS nexus.get_user_dashboards(UUID);

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
    updated_by UUID,
    updated_by_username VARCHAR,
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
        u_owner.username,
        d.is_public,
        COALESCE(d.is_anonymous_public, FALSE),
        d.is_favorite,
        d.tags,
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'view'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'edit'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'delete'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'share'),
        d.created_at,
        d.updated_at,
        d.updated_by,
        u_updated.username,
        d.last_accessed_at,
        d.status,
        d.version,
        d.published_at
    FROM nexus.dashboards d
    LEFT JOIN nexus.users u_owner ON d.owner_user_id = u_owner.id
    LEFT JOIN nexus.users u_updated ON d.updated_by = u_updated.id
    WHERE 
        -- VISIBILITY RULES:
        -- 1. Owner sees everything (including drafts)
        d.owner_user_id = p_user_id
        -- 2. Published public dashboards visible to all
        OR (d.is_public = TRUE AND d.status = 'published')
        -- 3. Published dashboards with explicit user permissions
        OR (d.status = 'published' AND EXISTS (
            SELECT 1 FROM nexus.dashboard_permissions dp
            WHERE dp.dashboard_id = d.id 
            AND dp.user_id = p_user_id
            AND dp.can_view = TRUE
            AND (dp.expires_at IS NULL OR dp.expires_at > NOW())
        ))
        -- 4. Published dashboards with group permissions
        OR (d.status = 'published' AND EXISTS (
            SELECT 1 FROM nexus.dashboard_permissions dp
            JOIN nexus.user_groups ug ON dp.group_id = ug.group_id
            WHERE dp.dashboard_id = d.id
            AND ug.user_id = p_user_id
            AND dp.can_view = TRUE
            AND (dp.expires_at IS NULL OR dp.expires_at > NOW())
        ));
END;
$$ LANGUAGE plpgsql;

-- 4. Set updated_by for existing records (set to owner initially)
UPDATE nexus.dashboards 
SET updated_by = owner_user_id 
WHERE updated_by IS NULL AND owner_user_id IS NOT NULL;

COMMENT ON COLUMN nexus.dashboards.updated_by IS 'User who last updated the dashboard';

