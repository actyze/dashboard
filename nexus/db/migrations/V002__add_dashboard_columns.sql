Y-- Migration: Add missing columns to dashboards table
-- Version: V002
-- Description: Add layout_config, tags, is_anonymous_public, is_favorite, status, and version columns

-- Add layout_config column for dashboard layout configuration
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb;

-- Add tags column for categorization
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add is_anonymous_public column for anonymous public access (no login required)
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS is_anonymous_public BOOLEAN DEFAULT FALSE;

-- Add is_favorite column for user favorites
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Add status column for dashboard workflow (draft, published, archived)
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Add version column for versioning support
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_dashboards_status ON nexus.dashboards(status);

-- Create index on is_favorite for quick filtering
CREATE INDEX IF NOT EXISTS idx_dashboards_is_favorite ON nexus.dashboards(is_favorite);

-- Create index on is_anonymous_public for public dashboard queries
CREATE INDEX IF NOT EXISTS idx_dashboards_is_anonymous_public ON nexus.dashboards(is_anonymous_public);

-- Comment on new columns
COMMENT ON COLUMN nexus.dashboards.layout_config IS 'Dashboard layout configuration (grid system, row height, etc.)';
COMMENT ON COLUMN nexus.dashboards.tags IS 'Dashboard tags for categorization and filtering';
COMMENT ON COLUMN nexus.dashboards.is_anonymous_public IS 'Allow anonymous public access without authentication';
COMMENT ON COLUMN nexus.dashboards.is_favorite IS 'User favorite flag';
COMMENT ON COLUMN nexus.dashboards.status IS 'Dashboard workflow status: draft, published, archived';
COMMENT ON COLUMN nexus.dashboards.version IS 'Dashboard version number for versioning support';

