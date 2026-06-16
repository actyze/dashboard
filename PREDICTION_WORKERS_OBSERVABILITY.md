# Prediction Workers Observability Instrumentation

## Summary
All 3 prediction workers (XGBoost, LightGBM, AutoGluon) have been instrumented with shared observability from `/shared/observability/python/`.

## Changes Made

### 1. Created observability_init.py in each worker
**Files:**
- `docker/prediction-worker-xgboost/observability_init.py`
- `docker/prediction-worker-lightgbm/observability_init.py`
- `docker/prediction-worker-autogluon/observability_init.py`

**Features:**
- Imports and re-exports shared observability modules (logging, metrics, health)
- Implements `setup_health_endpoints(app, service_name)` function that configures:
  - **GET /health** - Liveness probe (always healthy if running)
  - **GET /ready** - Readiness probe (checks Postgres and Trino connectivity)
  - **GET /metrics** - Prometheus metrics endpoint

**Health Checks:**
- PostgreSQL connectivity check (5-second timeout)
- Trino connectivity check (SELECT 1 query)

### 2. Updated main.py for each worker

**Imports Added:**
- `observability_init`: configure_logging, get_logger, setup_health_endpoints
- `observability.metrics`: MetricsContext, record_prediction, record_prediction_duration

**Initialization:**
```python
configure_logging(service_name="prediction-worker-{type}", log_level="INFO", log_format="json")
logger = get_logger(__name__)
setup_health_endpoints(app, "prediction-worker-{type}")
```

**Metrics Instrumentation:**

#### /train Endpoint
- Wraps in `MetricsContext("POST", "/train")`
- Records:
  - `record_prediction({type}, status="success"|"error")`
  - `record_prediction_duration({type}, duration_seconds)`
  - Structured log: `training_completed` with task_type, duration_s, row_count, status
  - Sets HTTP status code (200 for success, 400 for validation errors, 500 for failures)

#### /predict Endpoint
- Wraps in `MetricsContext("POST", "/predict")`
- Records:
  - `record_prediction({type}, status="success"|"error")`
  - `record_prediction_duration({type}, duration_seconds)`
  - Structured log: `prediction_completed` with duration_s, row_count, status
  - Sets HTTP status code (200 for success, 400 for validation errors, 500 for failures)

**Error Handling:**
- ValueError → 400 status, "validation_error" log, error metric recorded
- Other exceptions → 500 status, "{operation}_failed" log, error metric recorded
- All errors include duration_s for SLO tracking

### 3. Updated requirements.txt in each worker

Added observability dependencies:
```
structlog==24.4.0
python-json-logger==3.2.1
prometheus-client==0.24.1
```

## Observability Capabilities

### Metrics Exposed on /metrics Endpoint
(via Prometheus client)

**Prediction-specific:**
- `predictions_total{pipeline_type="xgboost|lightgbm|autogluon", status="success|error"}`
- `prediction_duration_seconds{pipeline_type="xgboost|lightgbm|autogluon"}`

**HTTP Requests:**
- `http_requests_total{method="POST", endpoint="/train|/predict", status=200|400|500}`
- `http_request_duration_seconds{method="POST", endpoint="/train|/predict"}`
- `http_requests_in_progress`

### Structured Logging

**Training Completion:**
```json
{
  "event": "training_completed",
  "task_type": "classification",
  "duration_s": 1.234,
  "row_count": 1000,
  "status": "success"
}
```

**Prediction Completion:**
```json
{
  "event": "prediction_completed",
  "duration_s": 0.456,
  "row_count": 100,
  "status": "success"
}
```

**Errors:**
```json
{
  "event": "training_failed",
  "error": "Exception message",
  "duration_s": 0.789,
  "exc_info": "traceback"
}
```

### Health Endpoints

**Liveness (GET /health):**
```json
{
  "status": "alive",
  "service": "prediction-worker-xgboost"
}
```

**Readiness (GET /ready):**
```json
{
  "ready": true,
  "service": "prediction-worker-xgboost",
  "checks": [
    {
      "name": "postgres",
      "healthy": true,
      "latency_ms": 5.2
    },
    {
      "name": "trino",
      "healthy": true,
      "latency_ms": 12.3
    }
  ],
  "timestamp": "2026-06-15T00:00:00.000Z"
}
```

## Worker-Specific Details

### XGBoost Worker
- File: `docker/prediction-worker-xgboost/`
- Service name: `prediction-worker-xgboost`
- Handles: classification, regression, anomaly_detection
- Metrics pipeline_type: `xgboost`

### LightGBM Worker
- File: `docker/prediction-worker-lightgbm/`
- Service name: `prediction-worker-lightgbm`
- Handles: classification, regression
- Metrics pipeline_type: `lightgbm`

### AutoGluon Worker
- File: `docker/prediction-worker-autogluon/`
- Service name: `prediction-worker-autogluon`
- Handles: forecasting (timeseries)
- Metrics pipeline_type: `autogluon`

## Consistent Patterns Across All 3 Workers

1. **Identical observability_init.py** - Code is identical, can be refactored to shared location if needed
2. **Same logging configuration** - JSON output, structlog, context variables
3. **Same metrics recording** - Both /train and /predict endpoints instrumented identically
4. **Same health checks** - Postgres and Trino connectivity checks
5. **Same endpoints** - /health, /ready, /metrics available on all workers

## Integration with Prometheus

To scrape metrics from workers in Kubernetes:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prediction-worker-xgboost
spec:
  ports:
  - port: 8000
    targetPort: 8000
    name: metrics  # Prometheus will scrape port 8000/metrics
```

Add to Prometheus scrape config:
```yaml
scrape_configs:
- job_name: 'prediction-workers'
  kubernetes_sd_configs:
  - role: service
  relabel_configs:
  - source_labels: [__meta_kubernetes_service_name]
    regex: 'prediction-worker-.*'
    action: keep
```

## Dependency Chain

1. **observability_init.py** imports from `../../shared/observability/`
2. **main.py** imports from `observability_init.py` and `observability.metrics`
3. **config.py** provides database connection details for health checks
4. **requirements.txt** declares observability dependencies

## Testing Observability

### Manual Health Checks
```bash
# Liveness
curl http://localhost:8000/health

# Readiness (with dependency checks)
curl http://localhost:8000/ready

# Metrics (Prometheus format)
curl http://localhost:8000/metrics
```

### Integration Tests
Each worker's observability can be tested by:
1. Calling POST /train with valid request
2. Checking Prometheus metrics at /metrics
3. Verifying structured logs appear in stdout

## Future Enhancements

1. **Shared observability_init.py** - Move to shared/ location to reduce duplication
2. **Custom metrics** - Add model-specific metrics (accuracy, precision, recall, feature importance)
3. **Tracing** - Add OpenTelemetry span tracking for distributed tracing
4. **Alerting** - Configure Prometheus alerts based on error rates or latency SLOs
5. **Dashboard** - Create Grafana dashboard to visualize prediction worker metrics
