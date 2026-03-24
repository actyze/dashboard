-- =====================================================
-- V010: Tile Cache, Refresh Jobs, KPI Definitions
-- =====================================================
-- Implements PostgreSQL-native tile result caching,
-- a job queue for batch refresh (SKIP LOCKED pattern),
-- and KPI metric definitions for future batch collection.
--
-- Design principles:
--   - Content-addressed cache keys (SHA-256 of SQL) so identical
--     queries across tiles share cached results
--   - SKIP LOCKED job queue works safely across multiple Nexus pods
--     without Redis
--   - APScheduler SQLAlchemyJobStore tables created separately by the
--     scheduler at startup; this migration owns the domain tables only
--   - 2-hour default refresh interval (7200s) baked in as column default

-- =====================================================
-- 1. TILE CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus.tile_cache (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tile_id             UUID NOT NULL REFERENCES nexus.dashboard_tiles(id) ON DELETE CASCADE,
    dashboard_id        UUID NOT NULL REFERENCES nexus.dashboards(id) ON DELETE CASCADE,

    -- Content-addressed key: SHA-256 of the tile's sql_query.
    -- Identical SQL in different tiles shares one logical cache entry
    -- but each tile row is independent for TTL/status tracking.
    cache_key           VARCHAR(64) NOT NULL,

    -- Full query_results payload as returned by Trino service
    cached_data         JSONB,
    row_count           INTEGER,
    execution_time_ms   INTEGER,

    -- Lifecycle
    cached_at           TIMESTAMP,
    expires_at          TIMESTAMP,  -- cached_at + tile.refresh_interval_seconds
    refresh_status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (refresh_status IN ('pending','running','success','failed','stale')),
    error_message       TEXT,

    -- Who triggered this cache entry (NULL = scheduled)
    refreshed_by        UUID REFERENCES nexus.users(id) ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tile_cache_tile_id UNIQUE (tile_id)
);

CREATE INDEX IF NOT EXISTS idx_tile_cache_dashboard_id  ON nexus.tile_cache (dashboard_id);
CREATE INDEX IF NOT EXISTS idx_tile_cache_cache_key     ON nexus.tile_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_tile_cache_expires_at    ON nexus.tile_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_tile_cache_refresh_status ON nexus.tile_cache (refresh_status);

DROP TRIGGER IF EXISTS set_timestamp_tile_cache ON nexus.tile_cache;
CREATE TRIGGER set_timestamp_tile_cache
BEFORE UPDATE ON nexus.tile_cache
FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- =====================================================
-- 2. REFRESH JOBS (job queue, SKIP LOCKED pattern)
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus.refresh_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Extensible job type: 'dashboard' | 'tile' | 'kpi_metric'
    job_type        VARCHAR(50) NOT NULL DEFAULT 'dashboard'
                        CHECK (job_type IN ('dashboard','tile','kpi_metric')),

    -- The entity this job operates on
    entity_id       UUID NOT NULL,
    entity_type     VARCHAR(50) NOT NULL DEFAULT 'dashboard'
                        CHECK (entity_type IN ('dashboard','tile','kpi_metric')),

    -- Job lifecycle
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','running','completed','failed','partial','cancelled')),

    -- Progress tracking (for batch dashboard jobs)
    total_items     INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    failed_items    INTEGER NOT NULL DEFAULT 0,

    -- Timing
    scheduled_for   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- when to run
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,

    -- Who triggered and how
    created_by      UUID REFERENCES nexus.users(id) ON DELETE SET NULL,
    triggered_by    VARCHAR(20) NOT NULL DEFAULT 'manual'
                        CHECK (triggered_by IN ('manual','scheduled','api')),

    -- Flexible payload: tile_ids[], error details, future KPI params
    metadata        JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_jobs_status        ON nexus.refresh_jobs (status);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_entity        ON nexus.refresh_jobs (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_scheduled_for ON nexus.refresh_jobs (scheduled_for)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_created_at    ON nexus.refresh_jobs (created_at DESC);

DROP TRIGGER IF EXISTS set_timestamp_refresh_jobs ON nexus.refresh_jobs;
CREATE TRIGGER set_timestamp_refresh_jobs
BEFORE UPDATE ON nexus.refresh_jobs
FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- =====================================================
-- 3. KPI DEFINITIONS (Phase 2 placeholder)
-- =====================================================
-- Intentionally inactive (is_active = false) until Phase 2.
-- Schema is final so future work only needs inserts/updates.
CREATE TABLE IF NOT EXISTS nexus.kpi_definitions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                      VARCHAR(200) NOT NULL UNIQUE,
    description               TEXT,
    sql_query                 TEXT NOT NULL,

    -- Refresh schedule
    refresh_interval_seconds  INTEGER NOT NULL DEFAULT 7200,  -- 2 hours
    last_refreshed_at         TIMESTAMP,
    next_refresh_at           TIMESTAMP,

    -- Lifecycle
    is_active                 BOOLEAN NOT NULL DEFAULT FALSE,
    created_by                UUID REFERENCES nexus.users(id) ON DELETE SET NULL,
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Extensible: thresholds, unit, aggregation_type, alert config, etc.
    metadata                  JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_active ON nexus.kpi_definitions (is_active)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_next_refresh ON nexus.kpi_definitions (next_refresh_at)
    WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS set_timestamp_kpi_definitions ON nexus.kpi_definitions;
CREATE TRIGGER set_timestamp_kpi_definitions
BEFORE UPDATE ON nexus.kpi_definitions
FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- =====================================================
-- 4. KPI METRIC VALUES (time-series, Phase 2 placeholder)
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus.kpi_metric_values (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id    UUID NOT NULL REFERENCES nexus.kpi_definitions(id) ON DELETE CASCADE,
    collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    value        JSONB NOT NULL,   -- flexible: scalar, row, or full result set
    metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_kpi_metric_values_metric_id    ON nexus.kpi_metric_values (metric_id);
CREATE INDEX IF NOT EXISTS idx_kpi_metric_values_collected_at ON nexus.kpi_metric_values (collected_at DESC);

-- =====================================================
-- 5. SET DEFAULT refresh_interval_seconds = 7200 (2h)
--    on existing dashboard_tiles if still at 300 (5m default)
-- =====================================================
ALTER TABLE nexus.dashboard_tiles
    ALTER COLUMN refresh_interval_seconds SET DEFAULT 7200;

UPDATE nexus.dashboard_tiles
SET refresh_interval_seconds = 7200
WHERE refresh_interval_seconds = 300 OR refresh_interval_seconds IS NULL;
