-- Page View Dashboards: GrapesJS-based page builder
-- SPDX-License-Identifier: AGPL-3.0-only
--
-- Adds view_type and page_data to dashboards for page-builder mode.
-- Adds block_assets table for image storage.
-- Updates get_user_dashboards to return view_type.

-- 1. Add columns to dashboards
ALTER TABLE nexus.dashboards
    ADD COLUMN IF NOT EXISTS view_type VARCHAR(20) DEFAULT 'grid',
    ADD COLUMN IF NOT EXISTS page_data JSONB DEFAULT '{}'::jsonb;

-- 2. Image assets table (stored as bytea in Postgres)
CREATE TABLE IF NOT EXISTS nexus.block_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES nexus.dashboards(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_asset_size CHECK (size_bytes <= 5242880),
    CONSTRAINT chk_asset_mime CHECK (
        mime_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp')
    )
);

CREATE INDEX IF NOT EXISTS idx_block_assets_dashboard_id
    ON nexus.block_assets(dashboard_id);

-- 3. Update get_user_dashboards to include view_type
DROP FUNCTION IF EXISTS nexus.get_user_dashboards(UUID);

CREATE OR REPLACE FUNCTION nexus.get_user_dashboards(p_user_id UUID)
RETURNS TABLE (
    dashboard_id UUID, title VARCHAR, description TEXT, owner_user_id UUID,
    owner_username VARCHAR, is_public BOOLEAN, is_anonymous_public BOOLEAN,
    is_favorite BOOLEAN, tags JSONB, tile_count BIGINT,
    can_view BOOLEAN, can_edit BOOLEAN, can_delete BOOLEAN, can_share BOOLEAN,
    created_at TIMESTAMP, updated_at TIMESTAMP, last_accessed_at TIMESTAMP,
    status VARCHAR, version INTEGER, published_at TIMESTAMP,
    view_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        d.id, d.title, d.description, d.owner_user_id, u.username,
        d.is_public, COALESCE(d.is_anonymous_public, FALSE), COALESCE(d.is_favorite, FALSE),
        COALESCE(d.tags, '[]'::jsonb),
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'view'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'edit'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'delete'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'share'),
        d.created_at, d.updated_at, d.last_accessed_at,
        COALESCE(d.status, 'published'), COALESCE(d.version, 1), d.published_at,
        COALESCE(d.view_type, 'grid')
    FROM nexus.dashboards d
    LEFT JOIN nexus.users u ON d.owner_user_id = u.id
    WHERE d.owner_user_id = p_user_id
        OR nexus.user_has_dashboard_permission(p_user_id, d.id, 'view')
        OR d.is_public = TRUE
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
