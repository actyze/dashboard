-- Add Anonymous/Public Dashboard Support
-- Allows dashboards to be viewed without authentication
-- Useful for: public status pages, embedded widgets, marketing dashboards

SET search_path TO nexus, public;

-- =============================================================================
-- 1. ADD is_anonymous_public FLAG
-- =============================================================================

-- Add new column to distinguish between authenticated-public vs anonymous-public
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'nexus' 
        AND table_name = 'dashboards' 
        AND column_name = 'is_anonymous_public'
    ) THEN
        ALTER TABLE nexus.dashboards 
        ADD COLUMN is_anonymous_public BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_dashboards_anonymous_public 
    ON nexus.dashboards(is_anonymous_public) 
    WHERE is_anonymous_public = TRUE;

-- Add comment
COMMENT ON COLUMN nexus.dashboards.is_anonymous_public IS 
    'TRUE = Dashboard viewable without authentication (anonymous access). 
     FALSE = Requires authentication (use is_public for authenticated-only public access)';

-- =============================================================================
-- 2. FUNCTION TO GET ANONYMOUS-PUBLIC DASHBOARDS
-- =============================================================================

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
        d.layout_config,
        d.tags,
        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id),
        d.created_at,
        d.updated_at
    FROM nexus.dashboards d
    WHERE d.is_anonymous_public = TRUE
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. SECURITY CONSTRAINTS
-- =============================================================================

-- Add constraint: anonymous-public dashboards must also be public
ALTER TABLE nexus.dashboards DROP CONSTRAINT IF EXISTS chk_anonymous_public_implies_public;
ALTER TABLE nexus.dashboards 
    ADD CONSTRAINT chk_anonymous_public_implies_public 
    CHECK (is_anonymous_public = FALSE OR (is_anonymous_public = TRUE AND is_public = TRUE));

COMMENT ON CONSTRAINT chk_anonymous_public_implies_public ON nexus.dashboards IS 
    'Ensures anonymous-public dashboards are also marked as public (is_public=TRUE)';

-- =============================================================================
-- 4. EXAMPLE: MARK EXECUTIVE DASHBOARD AS ANONYMOUS-PUBLIC
-- =============================================================================

-- Optionally mark Executive Dashboard as anonymous-public (for demo purposes)
UPDATE nexus.dashboards 
SET is_anonymous_public = TRUE, is_public = TRUE
WHERE title = 'Executive Dashboard' 
  AND is_anonymous_public = FALSE;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 
    title,
    is_public as authenticated_public,
    is_anonymous_public as anonymous_public,
    (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id) as tiles
FROM nexus.dashboards d
ORDER BY d.title;

SELECT 'Anonymous Public Dashboard Support Enabled' as status;

