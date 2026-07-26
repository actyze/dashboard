# Observability Quick Reference Guide

Fast reference for developers implementing observability in Actyze.

## Recording Metrics

### SQL Query Execution
```python
from app.metrics import record_sql_execution

# After SQL query completes
record_sql_execution(
    duration=0.123,        # seconds
    catalog="postgres",
    error=None,            # error type if it failed, or None
    row_count=45
)
```

### Natural Language Query
```python
from app.metrics import record_nl_query

record_nl_query(status="success", model="gpt-4")
```

### LLM API Calls
```python
from app.metrics import record_llm_call

record_llm_call(
    provider="openai",
    model="gpt-4",
    status="success",
    duration=0.987,        # seconds
    input_tokens=234,
    output_tokens=145
)
```

### Cache Operations
```python
from app.metrics import record_cache_hit, record_cache_miss

record_cache_hit("query")      # cache_type
record_cache_miss("metadata")

# Update cache size
from app.metrics import set_cache_size
set_cache_size("query", 1024000)  # bytes
```

### Predictions
```python
from app.metrics import record_prediction, record_prediction_duration

record_prediction(pipeline_type="forecast", status="success")
record_prediction_duration(pipeline_type="detect", duration=45.5)
```

## Audit Logging

### SQL Execution
```python
from app.audit_logger import audit_logger

audit_logger.log_sql_execution(
    user_id="user-42",
    sql_query="SELECT * FROM sales",
    catalog="postgres",
    row_count=1000,
    execution_time_ms=125.3,
    request_id="req-abc123",
    error=None  # set if query failed
)
```

### NL Query Execution
```python
audit_logger.log_nl_query(
    user_id="user-42",
    query_text="Show top customers",
    generated_sql="SELECT customer, SUM(revenue) FROM sales GROUP BY customer",
    catalog="postgres",
    row_count=100,
    llm_model="gpt-4",
    input_tokens=234,
    output_tokens=145,
    request_id="req-abc123",
    execution_time_ms=456.7
)
```

### Predictions
```python
audit_logger.log_prediction_generated(
    user_id="user-42",
    pipeline_type="forecast",
    pipeline_name="Revenue Forecast",
    metric_name="monthly_revenue",
    row_count=12,
    request_id="req-abc123",
    duration_ms=5000
)
```

### Data Export
```python
audit_logger.log_data_export(
    user_id="user-42",
    export_type="dashboard_tile",
    format="csv",
    row_count=500,
    request_id="req-abc123"
)
```

### Authentication/Authorization
```python
audit_logger.log_authentication(
    user_id="user-42",
    success=True,
    request_id="req-abc123"
)

audit_logger.log_authorization_failure(
    user_id="user-42",
    resource="dashboard-123",
    action="delete",
    request_id="req-abc123"
)
```

## Request Context

### Set Context
```python
from app.logging import set_request_id, set_user_id, set_query_id

# Typically done in middleware
set_request_id("req-abc123")
set_user_id("user-42")
set_query_id("query-xyz789")
```

### Get Context
```python
from app.logging import get_request_id, get_user_id, get_query_id

request_id = get_request_id()
user_id = get_user_id()
query_id = get_query_id()
```

### All Context in Logs
Once set, context automatically appears in all logs:
```python
from app.logging import get_logger

logger = get_logger()
logger.info("action_performed", detail="something")
# Output: {..., "request_id": "req-abc123", "user_id": "user-42", "query_id": "query-xyz789", "detail": "something"}
```

## Logging

### Get Logger
```python
from app.logging import get_logger

logger = get_logger()
logger.info("message", key="value")
logger.warning("caution", reason="xyz")
logger.error("failed", exception="...", code=500)
```

### Log with Context
Context is automatic, but you can add custom fields:
```python
logger.info(
    "query_executed",
    duration_ms=123,
    rows=45,
    catalog="postgres"
)
```

### Configuration
```bash
LOG_LEVEL=DEBUG          # DEBUG, INFO, WARN, ERROR
LOG_FORMAT=json          # json or text
```

## Health Checks

### From Client
```bash
# Liveness (is service alive?)
curl http://localhost:8002/healthz

# Readiness (is service ready for traffic?)
curl http://localhost:8002/readyz

# Kubernetes
kubectl exec pod-name -- curl localhost:8002/readyz
```

### In Code
```python
# The endpoints are automatic
# Just make sure to set app_started flag on successful startup
# (already done in main.py lifespan)
```

## Prometheus Queries

### Request Rate
```promql
rate(http_requests_total[5m])
```

### Error Rate
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### Query Latency (p95)
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### NL Query Volume
```promql
rate(nl_queries_total[1h]) by (model)
```

### LLM Cost (OpenAI pricing)
```promql
(sum(llm_tokens_total{token_type="input"}) * 0.00003) +
(sum(llm_tokens_total{token_type="output"}) * 0.00006)
```

### Cache Hit Ratio
```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

### Service Health
```promql
service_health_status
```

## Common Patterns

### Timing an Operation
```python
import time
from app.metrics import record_sql_execution

start = time.time()
# ... do work ...
duration = time.time() - start

record_sql_execution(duration=duration, catalog="postgres", row_count=100)
```

### Try-Catch Metrics
```python
from app.metrics import record_llm_call

try:
    result = await llm_service.call(prompt)
    record_llm_call(provider="openai", model="gpt-4", status="success", duration=1.5)
except Exception as e:
    record_llm_call(provider="openai", model="gpt-4", status="error")
    raise
```

### Per-User Tracking
```python
from app.logging import set_user_id

# In request handler
current_user = get_current_user()
set_user_id(current_user.id)

# All subsequent logs in this request will include user_id
logger.info("user_action", action="query")
```

## Viewing Metrics

### Local Development
```bash
# In terminal 1
cd nexus && python -m uvicorn main:app --reload

# In terminal 2
# Raw metrics
curl http://localhost:8002/metrics

# Specific metric
curl http://localhost:8002/metrics | grep http_requests_total

# Format (Prometheus format)
curl -H "Accept: application/openmetrics-text" http://localhost:8002/metrics
```

### Docker
```bash
# View logs
docker logs nexus

# View logs as JSON
docker logs nexus | jq

# View only audit events
docker logs nexus | jq 'select(.event_type != null)'

# View errors
docker logs nexus | jq 'select(.level == "ERROR")'
```

### Kubernetes
```bash
# View logs
kubectl logs -f deployment/nexus

# View metrics
kubectl exec -it pod/nexus -- curl localhost:8002/metrics | head -50

# Check health
kubectl exec -it pod/nexus -- curl localhost:8002/readyz
```

## Environment Configuration

### Logging
```bash
docker run \
  -e LOG_LEVEL=DEBUG \
  -e LOG_FORMAT=json \
  actyze:latest
```

### Prometheus
```bash
docker run \
  -e PROMETHEUS_ENABLED=true \
  actyze:latest

# Then scrape
curl http://container:8002/metrics
```

## Troubleshooting

### Metrics not recording?
1. Check if endpoint is hit: `curl http://localhost:8002/metrics`
2. Check logs for errors: `docker logs nexus | jq 'select(.level == "ERROR")'`
3. Verify imports: `grep -n "from app.metrics" nexus/app/api.py`

### Logs not showing?
1. Check log level: `echo $LOG_LEVEL`
2. Check log format: `echo $LOG_FORMAT`
3. View raw: `docker logs nexus | head -20`

### Health check failing?
1. Check if service started: `curl http://localhost:8002/healthz`
2. Check readiness: `curl http://localhost:8002/readyz`
3. View logs: `docker logs nexus | tail -50`

---

For full details, see [docs/observability.md](observability.md)
