-- =====================================================
-- Dashboard Versioning & Publishing System
-- =====================================================
-- Adds draft/published status and version history
-- Draft dashboards only visible to creator
-- Published dashboards visible per RBAC rules

-- Add status and versioning columns to dashboards table
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES nexus.users(id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_dashboards_status ON nexus.dashboards(status);
CREATE INDEX IF NOT EXISTS idx_dashboards_published_by ON nexus.dashboards(published_by);

-- Comment on new columns
COMMENT ON COLUMN nexus.dashboards.status IS 'Dashboard status: draft (creator only), published (visible per RBAC), archived (hidden)';
COMMENT ON COLUMN nexus.dashboards.version IS 'Current version number, increments on each publish';
COMMENT ON COLUMN nexus.dashboards.published_at IS 'Timestamp of last publish action';
COMMENT ON COLUMN nexus.dashboards.published_by IS 'User who published this version';

-- =====================================================
-- Dashboard Version History Table
-- =====================================================
-- Stores complete snapshots of dashboard + tiles at each version

CREATE TABLE IF NOT EXISTS nexus.dashboard_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES nexus.dashboards(id) ON DELETE CASCADE,
    
    -- Version Info
    version INTEGER NOT NULL,
    
    -- Dashboard Snapshot (at time of version)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    configuration JSONB DEFAULT '{}'::jsonb,
    layout_config JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Tiles Snapshot (JSON array of all tiles at this version)
    tiles_snapshot JSONB DEFAULT '[]'::jsonb,
    
    -- Version Metadata
    created_by UUID NOT NULL REFERENCES nexus.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version_notes TEXT,
    change_summary TEXT,
    
    -- Ensure unique version per dashboard
    CONSTRAINT unique_dashboard_version UNIQUE (dashboard_id, version)
);

-- Indexes for efficient version queries
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard ON nexus.dashboard_versions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON nexus.dashboard_versions(dashboard_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_created_by ON nexus.dashboard_versions(created_by);

COMMENT ON TABLE nexus.dashboard_versions IS 'Version history for dashboards with full snapshots';
COMMENT ON COLUMN nexus.dashboard_versions.tiles_snapshot IS 'JSON array of all tiles configuration at this version';
COMMENT ON COLUMN nexus.dashboard_versions.version_notes IS 'User-provided notes about this version';
COMMENT ON COLUMN nexus.dashboard_versions.change_summary IS 'Auto-generated summary of changes';

-- =====================================================
-- Function: Create Dashboard Version Snapshot
-- =====================================================

CREATE OR REPLACE FUNCTION nexus.create_dashboard_version(
    p_dashboard_id UUID,
    p_user_id UUID,
    p_version_notes TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_new_version INTEGER;
    v_dashboard_record RECORD;
    v_tiles_snapshot JSONB;
BEGIN
    -- Get current dashboard data
    SELECT * INTO v_dashboard_record
    FROM nexus.dashboards
    WHERE id = p_dashboard_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dashboard not found: %', p_dashboard_id;
    END IF;
    
    -- Get next version number
    v_new_version := COALESCE(
        (SELECT MAX(version) + 1 FROM nexus.dashboard_versions WHERE dashboard_id = p_dashboard_id),
        1
    );
    
    -- Create snapshot of all current tiles
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'title', title,
            'description', description,
            'sql_query', sql_query,
            'natural_language_query', natural_language_query,
            'chart_type', chart_type,
            'chart_config', chart_config,
            'position_x', position_x,
            'position_y', position_y,
            'width', width,
            'height', height,
            'refresh_interval_seconds', refresh_interval_seconds
        )
    ), '[]'::jsonb)
    INTO v_tiles_snapshot
    FROM nexus.dashboard_tiles
    WHERE dashboard_id = p_dashboard_id;
    
    -- Insert version record
    INSERT INTO nexus.dashboard_versions (
        dashboard_id,
        version,
        title,
        description,
        configuration,
        layout_config,
        is_public,
        is_favorite,
        tags,
        tiles_snapshot,
        created_by,
        version_notes,
        change_summary
    ) VALUES (
        p_dashboard_id,
        v_new_version,
        v_dashboard_record.title,
        v_dashboard_record.description,
        v_dashboard_record.configuration,
        v_dashboard_record.layout_config,
        v_dashboard_record.is_public,
        v_dashboard_record.is_favorite,
        v_dashboard_record.tags,
        v_tiles_snapshot,
        p_user_id,
        p_version_notes,
        'Version ' || v_new_version || ' created'
    );
    
    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Publish Dashboard
-- =====================================================
-- Creates version snapshot and changes status to published

CREATE OR REPLACE FUNCTION nexus.publish_dashboard(
    p_dashboard_id UUID,
    p_user_id UUID,
    p_version_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_version INTEGER;
    v_result JSONB;
BEGIN
    -- Create version snapshot
    v_new_version := nexus.create_dashboard_version(
        p_dashboard_id, 
        p_user_id, 
        COALESCE(p_version_notes, 'Published version ' || (SELECT COALESCE(MAX(version), 0) + 1 FROM nexus.dashboard_versions WHERE dashboard_id = p_dashboard_id))
    );
    
    -- Update dashboard to published status
    UPDATE nexus.dashboards
    SET 
        status = 'published',
        version = v_new_version,
        published_at = CURRENT_TIMESTAMP,
        published_by = p_user_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_dashboard_id;
    
    -- Return result
    v_result := jsonb_build_object(
        'dashboard_id', p_dashboard_id,
        'version', v_new_version,
        'status', 'published',
        'published_at', CURRENT_TIMESTAMP,
        'published_by', p_user_id
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Revert Dashboard to Previous Version
-- =====================================================

CREATE OR REPLACE FUNCTION nexus.revert_dashboard_version(
    p_dashboard_id UUID,
    p_target_version INTEGER,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_version_record RECORD;
    v_tile JSONB;
BEGIN
    -- Get the target version snapshot
    SELECT * INTO v_version_record
    FROM nexus.dashboard_versions
    WHERE dashboard_id = p_dashboard_id AND version = p_target_version;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Version % not found for dashboard %', p_target_version, p_dashboard_id;
    END IF;
    
    -- Update dashboard to match version snapshot
    UPDATE nexus.dashboards
    SET
        title = v_version_record.title,
        description = v_version_record.description,
        configuration = v_version_record.configuration,
        layout_config = v_version_record.layout_config,
        is_public = v_version_record.is_public,
        is_favorite = v_version_record.is_favorite,
        tags = v_version_record.tags,
        updated_at = CURRENT_TIMESTAMP,
        status = 'draft' -- Reverted versions start as draft
    WHERE id = p_dashboard_id;
    
    -- Delete all current tiles
    DELETE FROM nexus.dashboard_tiles WHERE dashboard_id = p_dashboard_id;
    
    -- Restore tiles from snapshot
    FOR v_tile IN SELECT * FROM jsonb_array_elements(v_version_record.tiles_snapshot)
    LOOP
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id,
            title,
            description,
            sql_query,
            natural_language_query,
            chart_type,
            chart_config,
            position_x,
            position_y,
            width,
            height,
            refresh_interval_seconds,
            created_by
        ) VALUES (
            p_dashboard_id,
            v_tile->>'title',
            v_tile->>'description',
            v_tile->>'sql_query',
            v_tile->>'natural_language_query',
            v_tile->>'chart_type',
            (v_tile->>'chart_config')::jsonb,
            (v_tile->>'position_x')::INTEGER,
            (v_tile->>'position_y')::INTEGER,
            (v_tile->>'width')::INTEGER,
            (v_tile->>'height')::INTEGER,
            (v_tile->>'refresh_interval_seconds')::INTEGER,
            p_user_id
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Update get_user_dashboards to filter drafts
-- =====================================================
-- Drafts only visible to owner, published visible per RBAC

DROP FUNCTION IF EXISTS nexus.get_user_dashboards(UUID);

CREATE OR REPLACE FUNCTION nexus.get_user_dashboards(p_user_id UUID)
RETURNS TABLE (
    dashboard_id UUID,
    title VARCHAR,
    description TEXT,
    owner_user_id UUID,
    owner_username VARCHAR,
    is_public BOOLEAN,
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
        d.is_favorite,
        d.tags,
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'view'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'edit'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'delete'),
        nexus.user_has_dashboard_permission(p_user_id, d.id, 'share'),
        d.created_at,
        d.updated_at,
        d.last_accessed_at,
        d.status,
        d.version,
        d.published_at
    FROM nexus.dashboards d
    LEFT JOIN nexus.users u ON d.owner_user_id = u.id
    WHERE 
        -- VISIBILITY RULES:
        -- 1. Owner sees everything (including drafts)
        (d.owner_user_id = p_user_id)
        
        -- 2. Published dashboards visible per existing RBAC rules
        OR (
            d.status = 'published' AND (
                -- Public dashboards
                d.is_public = TRUE
                -- OR has direct permission
                OR EXISTS (
                    SELECT 1 FROM nexus.dashboard_permissions dp
                    WHERE dp.dashboard_id = d.id 
                        AND dp.user_id = p_user_id
                        AND (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP)
                )
                -- OR user's group has permission
                OR EXISTS (
                    SELECT 1 FROM nexus.dashboard_permissions dp
                    JOIN nexus.user_groups ug ON dp.group_id = ug.group_id
                    WHERE dp.dashboard_id = d.id 
                        AND ug.user_id = p_user_id
                        AND (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP)
                )
                -- OR user is admin/superadmin
                OR EXISTS (
                    SELECT 1 FROM nexus.user_roles ur
                    JOIN nexus.roles r ON ur.role_id = r.id
                    WHERE ur.user_id = p_user_id 
                        AND LOWER(r.name) IN ('admin', 'superadmin')
                )
            )
        )
        
        -- 3. Never show archived to non-owners
        AND (d.status != 'archived' OR d.owner_user_id = p_user_id)
        
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Set existing dashboards to published by default
-- =====================================================
-- This ensures existing dashboards remain visible

UPDATE nexus.dashboards 
SET status = 'published',
    published_at = created_at,
    published_by = owner_user_id
WHERE status IS NULL OR status = 'draft';

-- =====================================================
-- Grant necessary permissions
-- =====================================================

GRANT SELECT ON nexus.dashboard_versions TO nexus_service;
GRANT INSERT ON nexus.dashboard_versions TO nexus_service;
GRANT UPDATE ON nexus.dashboard_versions TO nexus_service;
GRANT DELETE ON nexus.dashboard_versions TO nexus_service;

