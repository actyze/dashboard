-- Migration: Fix dashboard_tiles missing columns
-- Version: V007
-- Description: Add last_refreshed_at, updated_at, and constraints to dashboard_tiles

-- Add missing columns
ALTER TABLE nexus.dashboard_tiles 
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp_dashboard_tiles ON nexus.dashboard_tiles;
CREATE TRIGGER set_timestamp_dashboard_tiles 
    BEFORE UPDATE ON nexus.dashboard_tiles 
    FOR EACH ROW 
    EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- Add constraints if they don't exist
DO $$ 
BEGIN
    -- Chart type constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_schema = 'nexus' 
        AND table_name = 'dashboard_tiles' 
        AND constraint_name = 'valid_chart_type'
    ) THEN
        ALTER TABLE nexus.dashboard_tiles 
        ADD CONSTRAINT valid_chart_type CHECK (chart_type IN (
            -- Basic Charts
            'bar', 'line', 'scatter', 'pie', 'donut',
            -- Statistical Charts
            'box', 'violin', 'histogram', 'histogram2d',
            -- 3D Charts
            'scatter3d', 'line3d', 'surface', 'mesh3d',
            -- Financial Charts
            'candlestick', 'ohlc', 'waterfall', 'funnel',
            -- Maps & Geo
            'scattergeo', 'choropleth', 'scattermapbox',
            -- Specialized
            'heatmap', 'contour', 'sankey', 'sunburst', 'treemap',
            'parallel', 'parcoords', 'table', 'indicator',
            -- Multi-series
            'area', 'stackedbar', 'groupedbar', 'bubble'
        ));
    END IF;

    -- Grid position constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_schema = 'nexus' 
        AND table_name = 'dashboard_tiles' 
        AND constraint_name = 'valid_grid_position'
    ) THEN
        ALTER TABLE nexus.dashboard_tiles 
        ADD CONSTRAINT valid_grid_position CHECK (position_x >= 0 AND position_y >= 0);
    END IF;

    -- Grid dimensions constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_schema = 'nexus' 
        AND table_name = 'dashboard_tiles' 
        AND constraint_name = 'valid_grid_dimensions'
    ) THEN
        ALTER TABLE nexus.dashboard_tiles 
        ADD CONSTRAINT valid_grid_dimensions CHECK (width > 0 AND width <= 12 AND height > 0);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN nexus.dashboard_tiles.last_refreshed_at IS 'Timestamp of last data refresh';
COMMENT ON COLUMN nexus.dashboard_tiles.updated_at IS 'Timestamp of last tile update';
COMMENT ON COLUMN nexus.dashboard_tiles.refresh_interval_seconds IS 'Auto-refresh interval (null = manual only)';

