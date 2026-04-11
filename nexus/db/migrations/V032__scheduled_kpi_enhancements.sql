-- =====================================================
-- V032: Scheduled KPI Feature (Gold Layer)
-- =====================================================
-- Enhances kpi_definitions with owner, interval, status
-- columns and moves kpi_metric_values to a dedicated
-- kpi_data schema so it is queryable via Trino/AI
-- (the nexus schema is blocked from AI/query generation).
--
-- kpi_definitions stays in nexus (system config/metadata).
-- kpi_data.kpi_metric_values holds the queryable time-series.
-- Same pattern as user_uploads.
-- =====================================================

-- 1. Enhance kpi_definitions with scheduling columns
ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL;

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS interval_hours INT NOT NULL DEFAULT 1
        CHECK (interval_hours >= 1 AND interval_hours <= 24);

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMP;

ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_owner
    ON nexus.kpi_definitions (owner_user_id);

-- 2. Create dedicated schema for KPI metric data
CREATE SCHEMA IF NOT EXISTS kpi_data;

GRANT USAGE ON SCHEMA kpi_data TO nexus_service;
GRANT CREATE ON SCHEMA kpi_data TO nexus_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA kpi_data TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA kpi_data GRANT ALL ON TABLES TO nexus_service;

-- 3. Move kpi_metric_values from nexus to kpi_data
ALTER TABLE nexus.kpi_metric_values SET SCHEMA kpi_data;

-- 4. Add composite index for time-range aggregation queries
CREATE INDEX IF NOT EXISTS idx_kpi_metric_values_agg
    ON kpi_data.kpi_metric_values (metric_id, collected_at DESC);

-- 5. Documentation
COMMENT ON SCHEMA kpi_data IS 'Pre-aggregated KPI metric values — queryable via Trino for dashboards';
