-- =====================================================
-- V033: KPI Materialized Tables (Gold Layer)
-- =====================================================
-- Each KPI now creates a real typed Postgres table in
-- kpi_data schema, registered with FAISS for AI discovery.
-- On each collection, the table is truncated and refilled
-- with fresh results plus a collected_at timestamp column.
-- =====================================================

-- 1. Track the materialized table name per KPI
ALTER TABLE nexus.kpi_definitions
    ADD COLUMN IF NOT EXISTS materialized_table VARCHAR(63);
