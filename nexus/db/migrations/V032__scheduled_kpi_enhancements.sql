-- =====================================================
-- V032: Scheduled KPI Feature (Gold Layer)
-- =====================================================
-- Enhances kpi_definitions with owner, interval, status,
-- and materialized table columns. Moves kpi_metric_values
-- to a dedicated kpi_data schema queryable via Trino/AI
-- (the nexus schema is blocked from AI/query generation).
--
-- Each KPI creates a real typed Postgres table in kpi_data
-- schema, registered with FAISS for AI discovery. Each
-- collection appends new rows with a collected_at timestamp,
-- building an additive time-series.
--
-- kpi_definitions stays in nexus (system config/metadata).
-- kpi_data holds materialized KPI tables + metric value log.
-- Same isolation pattern as user_uploads.
-- =====================================================

-- 1. Enhance kpi_definitions with scheduling + materialization columns
ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL;

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS interval_hours INT NOT NULL DEFAULT 1
        CHECK (interval_hours >= 1 AND interval_hours <= 24);

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMP;

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS materialized_table VARCHAR(63);

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_owner
    ON nexus.kpi_definitions (owner_user_id);

-- 2. Create dedicated schema for KPI metric data
CREATE SCHEMA IF NOT EXISTS kpi_data;

-- Grant permissions (skip gracefully in CI where nexus_service role may not exist)
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA kpi_data TO nexus_service';
    EXECUTE 'GRANT CREATE ON SCHEMA kpi_data TO nexus_service';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA kpi_data TO nexus_service';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA kpi_data GRANT ALL ON TABLES TO nexus_service';
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'Role nexus_service does not exist — skipping grants (CI/test environment)';
END $$;

-- 3. Move kpi_metric_values from nexus to kpi_data
ALTER TABLE nexus.kpi_metric_values SET SCHEMA kpi_data;

-- 4. Add composite index for time-range aggregation queries
CREATE INDEX IF NOT EXISTS idx_kpi_metric_values_agg
    ON kpi_data.kpi_metric_values (metric_id, collected_at DESC);

-- 5. Documentation
COMMENT ON SCHEMA kpi_data IS 'Pre-aggregated KPI metric values and materialized gold tables — queryable via Trino for dashboards';
