-- Migration: Add dashboard versioning and publishing
-- Version: V008
-- Description: Add dashboard_versions table and versioning functions

-- =====================================================
-- Dashboard Version History Table
-- =====================================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard ON nexus.dashboard_versions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON nexus.dashboard_versions(dashboard_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_created_by ON nexus.dashboard_versions(created_by);

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
        COALESCE(v_dashboard_record.layout_config, '{}'::jsonb),
        COALESCE(v_dashboard_record.is_public, FALSE),
        COALESCE(v_dashboard_record.is_favorite, FALSE),
        COALESCE(v_dashboard_record.tags, '[]'::jsonb),
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
-- Grant Permissions
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.dashboard_versions TO nexus_service;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE nexus.dashboard_versions IS 'Version history for dashboards with full snapshots';
COMMENT ON COLUMN nexus.dashboard_versions.tiles_snapshot IS 'JSON array of all tiles configuration at this version';
COMMENT ON COLUMN nexus.dashboard_versions.version_notes IS 'User-provided notes about this version';
COMMENT ON COLUMN nexus.dashboard_versions.change_summary IS 'Auto-generated summary of changes';

