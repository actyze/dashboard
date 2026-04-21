-- =====================================================
-- V035: Predictive Intelligence Service
-- =====================================================
-- Adds prediction models catalog, prediction pipelines,
-- and run history. Creates prediction_data schema for
-- output tables registered with FAISS for NL→SQL discovery.
--
-- Models: XGBoost, LightGBM (enabled by default), AutoGluon
-- (disabled, enable via Helm). Model selection is automatic
-- based on prediction type and data characteristics.
--
-- Pipelines support two data source modes:
--   - KPI: predictions from a single materialized KPI table
--   - SQL: custom Trino query joining multiple tables
--
-- Three training triggers:
--   - after_kpi_collection: retrain when linked KPI gets new data
--   - scheduled: retrain on independent schedule (N hours)
--   - manual: user triggers explicitly
-- =====================================================

-- 1. Model catalog (system-seeded + extensible)
CREATE TABLE IF NOT EXISTS nexus.prediction_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model_type TEXT NOT NULL,           -- 'xgboost', 'lightgbm', 'autogluon'
    category TEXT NOT NULL,             -- 'tabular', 'timeseries'
    task_type TEXT NOT NULL,            -- 'classification', 'regression', 'forecasting'
    description TEXT,
    default_params JSONB DEFAULT '{}',
    worker_endpoint TEXT NOT NULL,      -- URL to worker container health/train/predict
    is_system BOOLEAN DEFAULT false,    -- true for pre-built defaults
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User-configured prediction pipelines
CREATE TABLE IF NOT EXISTS nexus.prediction_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    prediction_type TEXT NOT NULL,       -- 'forecast', 'classify', 'estimate' (user-facing)
    model_id UUID REFERENCES nexus.prediction_models(id),  -- auto-selected by service

    -- Dual data source: exactly one of (source_kpi_id, source_sql) should be set
    source_type TEXT NOT NULL DEFAULT 'kpi'
        CHECK (source_type IN ('kpi', 'sql')),
    source_kpi_id UUID REFERENCES nexus.kpi_definitions(id) ON DELETE SET NULL,
    source_sql TEXT,                     -- Trino SQL for multi-table joins

    target_column TEXT NOT NULL,
    feature_columns TEXT[],              -- auto-detected, user can adjust
    output_columns TEXT[],               -- columns to include in prediction output (ID/label columns)
    forecast_horizon INT,                -- days ahead (forecast only)
    training_params JSONB DEFAULT '{}',
    output_table TEXT,                   -- prediction_data.{sanitized_name}

    -- Training trigger configuration
    trigger_mode TEXT NOT NULL DEFAULT 'after_kpi_collection'
        CHECK (trigger_mode IN ('after_kpi_collection', 'scheduled', 'manual')),
    schedule_hours INT DEFAULT 24
        CHECK (schedule_hours >= 1 AND schedule_hours <= 720),

    is_active BOOLEAN DEFAULT true,
    owner_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'training', 'ready', 'failed')),
    last_trained_at TIMESTAMPTZ,
    last_error TEXT,
    accuracy_metrics JSONB,              -- raw: {rmse, mae, mape, f1, precision, recall, ...}
    accuracy_display TEXT,               -- business-friendly: "Predictions within ±8%"
    data_quality JSONB,                  -- last quality check results
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Prediction run history
CREATE TABLE IF NOT EXISTS nexus.prediction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES nexus.prediction_pipelines(id) ON DELETE CASCADE,
    status TEXT NOT NULL
        CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    rows_predicted INT,
    error TEXT,
    metrics JSONB                        -- per-run accuracy metrics
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_prediction_pipelines_owner
    ON nexus.prediction_pipelines (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_prediction_pipelines_active
    ON nexus.prediction_pipelines (is_active, next_run_at)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prediction_pipelines_kpi
    ON nexus.prediction_pipelines (source_kpi_id)
    WHERE source_kpi_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_runs_pipeline
    ON nexus.prediction_runs (pipeline_id, started_at DESC);

-- 5. Output schema for prediction tables (registered with FAISS)
CREATE SCHEMA IF NOT EXISTS prediction_data;

-- Grant permissions (skip gracefully in CI where nexus_service role may not exist)
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA prediction_data TO nexus_service';
    EXECUTE 'GRANT CREATE ON SCHEMA prediction_data TO nexus_service';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA prediction_data TO nexus_service';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA prediction_data GRANT ALL ON TABLES TO nexus_service';
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'Role nexus_service does not exist — skipping grants (CI/test environment)';
END $$;

COMMENT ON SCHEMA prediction_data IS 'ML prediction output tables — queryable via Trino, registered with FAISS for NL→SQL discovery';

-- 6. Seed system models (worker_endpoint uses service names from docker-compose/k8s)
INSERT INTO nexus.prediction_models (name, model_type, category, task_type, description, worker_endpoint, is_system, default_params)
VALUES
    ('XGBoost Classifier', 'xgboost', 'tabular', 'classification',
     'Gradient boosted trees for binary/multi-class prediction. Best for: churn, fraud detection, lead scoring.',
     'http://prediction-worker-xgboost:8400', true, '{"objective": "binary:logistic", "eval_metric": "logloss", "n_estimators": 200}'),
    ('XGBoost Regressor', 'xgboost', 'tabular', 'regression',
     'Gradient boosted trees for numeric prediction. Best for: customer lifetime value, pricing, scoring.',
     'http://prediction-worker-xgboost:8400', true, '{"objective": "reg:squarederror", "eval_metric": "rmse", "n_estimators": 200}'),
    ('LightGBM Classifier', 'lightgbm', 'tabular', 'classification',
     'Fast gradient boosted trees for classification. Preferred for large datasets (>100K rows). Best for: promotion effectiveness, conversion prediction.',
     'http://prediction-worker-lightgbm:8400', true, '{"objective": "binary", "metric": "binary_logloss", "n_estimators": 200}'),
    ('LightGBM Regressor', 'lightgbm', 'tabular', 'regression',
     'Fast gradient boosted trees for numeric prediction. Preferred for large datasets (>100K rows). Best for: revenue prediction, demand estimation.',
     'http://prediction-worker-lightgbm:8400', true, '{"objective": "regression", "metric": "rmse", "n_estimators": 200}'),
    ('AutoGluon TimeSeries', 'autogluon', 'timeseries', 'forecasting',
     'Ensemble time-series forecasting (ARIMA + ETS + Theta + tree models). Best for: revenue forecasting, demand forecasting, cost forecasting.',
     'http://prediction-worker-autogluon:8400', true, '{"preset": "fast_training", "time_limit": 300}')
ON CONFLICT DO NOTHING;
