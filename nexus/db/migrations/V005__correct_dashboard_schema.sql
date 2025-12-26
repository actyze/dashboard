-- Migration: Ensure all dashboard columns exist per helm DDL scripts
-- Version: V005
-- Description: Add any missing columns for dashboards table

-- Add published_at and published_by (from versioning)
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES nexus.users(id);

-- Add last_accessed_at for analytics
ALTER TABLE nexus.dashboards 
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_dashboards_published_by ON nexus.dashboards(published_by);

-- Update comments
COMMENT ON COLUMN nexus.dashboards.status IS 'Dashboard status: draft (creator only), published (visible per RBAC), archived (hidden)';
COMMENT ON COLUMN nexus.dashboards.version IS 'Current version number, increments on each publish';
COMMENT ON COLUMN nexus.dashboards.published_at IS 'Timestamp of last publish action';
COMMENT ON COLUMN nexus.dashboards.published_by IS 'User who published this version';
COMMENT ON COLUMN nexus.dashboards.layout_config IS 'Dashboard layout configuration (grid system, row height, etc.)';
COMMENT ON COLUMN nexus.dashboards.tags IS 'Dashboard tags for categorization and filtering';
COMMENT ON COLUMN nexus.dashboards.is_anonymous_public IS 'Allow anonymous public access without authentication';
COMMENT ON COLUMN nexus.dashboards.is_favorite IS 'User favorite flag';
COMMENT ON COLUMN nexus.dashboards.last_accessed_at IS 'Last time dashboard was accessed (for analytics)';

-- Add constraint: anonymous_public implies public
ALTER TABLE nexus.dashboards DROP CONSTRAINT IF EXISTS chk_anonymous_public_implies_public;
ALTER TABLE nexus.dashboards 
ADD CONSTRAINT chk_anonymous_public_implies_public 
CHECK (is_anonymous_public = FALSE OR (is_anonymous_public = TRUE AND is_public = TRUE));

-- Set existing dashboards to published by default to maintain visibility
UPDATE nexus.dashboards 
SET status = 'published',
    published_at = COALESCE(published_at, created_at),
    published_by = COALESCE(published_by, owner_user_id)
WHERE status IS NULL OR (status = 'draft' AND published_at IS NULL);

