# Actyze Observability Guide

Actyze is instrumented with comprehensive observability features to monitor and troubleshoot self-hosted deployments. This guide covers metrics, logging, health checks, and integration with common monitoring stacks.

## Table of Contents

- [Quick Start](#quick-start)
- [Health Endpoints](#health-endpoints)
- [Prometheus Metrics](#prometheus-metrics)
- [Structured Logging](#structured-logging)
- [Audit Logging](#audit-logging)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)

## Quick Start

Actyze exposes observability endpoints on each service:

| Endpoint | Purpose | Format |
|----------|---------|--------|
| `/healthz` | Liveness probe (is service alive?) | JSON |
| `/readyz` | Readiness probe (is service ready for traffic?) | JSON |
| `/health` | Deprecated health check | JSON |
| `/metrics` | Prometheus metrics | OpenMetrics text format |
| `/api/health/predictions` | Prediction worker health aggregation | JSON |

### Minimal Kubernetes Setup

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nexus
spec:
  containers:
  - name: nexus
    image: actyze:latest
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8002
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /readyz
        port: 8002
      initialDelaySeconds: 15
      periodSeconds: 5
```

## Health Endpoints

### Liveness: `/healthz`

Returns 200 immediately when the process is alive. Use for Kubernetes `livenessProbe`.

```bash
curl http://localhost:8002/healthz
# {"status": "alive", "service": "nexus", "version": "1.0.0"}
```

### Readiness: `/readyz`

Returns 200 only when the service is fully initialized and dependencies are healthy. Use for Kubernetes `readinessProbe`.

- Returns 503 if service is still starting up
- Returns 503 if external services (database, schema service, etc.) are unhealthy
- Returns 200 once fully ready to serve traffic

```bash
curl http://localhost:8002/readyz
# {"status": "ready", "service": "nexus", "version": "1.0.0"}

# During startup or degradation:
curl http://localhost:8002/readyz
# 503 Service Unavailable
# {"status": "not_ready", "message": "Service not fully initialized"}
```

### Prediction Workers: `/api/health/predictions`

Aggregates health of all prediction worker backends (XGBoost, LightGBM, AutoGluon).

```bash
curl http://localhost:8002/api/health/predictions
{
  "status": "healthy",  # "healthy", "degraded", or "unhealthy"
  "services": {
    "xgboost": true,
    "lightgbm": true,
    "autogluon": false
  },
  "message": "All prediction workers healthy"
}
```

## Prometheus Metrics

### Metrics Endpoint

Actyze exposes Prometheus-compatible metrics at `/metrics` in OpenMetrics text format.

```bash
curl http://localhost:8002/metrics | head -20
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{endpoint="/api/queries",method="POST",status="200"} 152.0
http_requests_total{endpoint="/api/queries",method="POST",status="400"} 3.0
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{endpoint="/api/queries",le="0.01",method="POST"} 12.0
```

### Available Metrics

#### HTTP Request Metrics
- `http_requests_total{method, endpoint, status}` — Total requests by method, endpoint, and status code
- `http_request_duration_seconds{method, endpoint}` — Request latency histogram (buckets: 10ms to 10s)
- `http_requests_in_progress` — Current number of in-flight requests

#### Query Execution Metrics
- `nl_queries_total{status, model}` — Total NL queries processed
- `sql_execution_duration_seconds{catalog}` — SQL query latency by source catalog
- `sql_execution_errors_total{catalog, error_type}` — SQL execution errors by type
- `sql_result_rows{catalog}` — Histogram of result set sizes

#### LLM Integration Metrics
- `llm_calls_total{provider, model, status}` — Total LLM API calls
- `llm_tokens_total{provider, model, token_type}` — Token consumption (input/output)
- `llm_call_duration_seconds{provider, model}` — LLM API latency

#### Cache Metrics
- `cache_hits_total{cache_type}` — Cache hit count
- `cache_misses_total{cache_type}` — Cache miss count
- `cache_size_bytes{cache_type}` — Current cache size in bytes

#### Database Metrics
- `db_connections_active` — Active database connections
- `db_connections_idle` — Idle database connections

#### Prediction Metrics
- `predictions_total{pipeline_type, status}` — Total predictions generated
- `prediction_duration_seconds{pipeline_type}` — Prediction execution latency

#### Service Health Metrics
- `service_health_status{service}` — Health status of external services (1=healthy, 0=unhealthy)

#### Audit Metrics
- `audit_events_total{event_type}` — Count of audit events by type

### Metric Labels

All metrics include context via labels:
- `method` — HTTP method (GET, POST, etc.)
- `endpoint` — Request path
- `status` — HTTP status code
- `catalog` — Data source (Trino catalog name)
- `provider` — LLM provider (openai, anthropic, etc.)
- `model` — Model name
- `pipeline_type` — Prediction pipeline type (forecast, detect, classify)
- `cache_type` — Cache category (query, metadata, llm, etc.)

### Prometheus Scrape Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'actyze-nexus'
    static_configs:
      - targets: ['localhost:8002']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'actyze-schema-service'
    static_configs:
      - targets: ['localhost:8001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'actyze-dashboard-frontend'
    # Frontend metrics are logged to stdout (see below)
    # No HTTP metrics endpoint on React app
```

### Useful Prometheus Queries

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p95 query latency
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Token consumption per provider
rate(llm_tokens_total[1h]) by (provider, token_type)

# Cache hit ratio
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

## Structured Logging

All services output structured JSON logs to stdout. Each log entry includes:

- `timestamp` — ISO 8601 timestamp
- `level` — Log level (INFO, WARNING, ERROR, etc.)
- `service` — Service name (nexus, schema-service, etc.)
- `event` — Event identifier
- `request_id` — Unique request ID for tracing
- `user_id` — User who initiated the action
- `query_id` — Query identifier (for NL queries)
- Custom fields — Event-specific context

### Example Logs

```json
{"timestamp": "2024-06-14T10:30:45.123Z", "level": "INFO", "service": "nexus", "event": "http_request", "request_id": "req-abc123", "method": "POST", "endpoint": "/api/queries", "status_code": 200, "duration_ms": 145.3}

{"timestamp": "2024-06-14T10:30:45.456Z", "level": "INFO", "service": "nexus", "event": "sql_execution", "request_id": "req-abc123", "user_id": "user-42", "query_id": "query-789", "catalog": "postgres", "row_count": 250, "execution_time_ms": 85.2}

{"timestamp": "2024-06-14T10:30:46.789Z", "level": "INFO", "service": "nexus", "event": "llm_call", "request_id": "req-abc123", "provider": "openai", "model": "gpt-4", "input_tokens": 234, "output_tokens": 145, "duration_ms": 987.5}
```

### Configuring Log Level

Set `LOG_LEVEL` environment variable (default: INFO):

```bash
docker run -e LOG_LEVEL=DEBUG actyze:latest
docker run -e LOG_LEVEL=WARN actyze:latest
```

### Log Format

By default, logs are JSON. To use human-readable format for development:

```bash
docker run -e LOG_FORMAT=text actyze:latest
```

### Routing Logs with Fluent Bit

Example Fluent Bit config to parse and forward Actyze JSON logs:

```ini
[INPUT]
    Name    tail
    Path    /var/log/actyze/nexus.log
    Tag     actyze.nexus
    Format  json

[FILTER]
    Name    parser
    Match   actyze.*
    Key_Name log

[OUTPUT]
    Name    loki
    Match   actyze.*
    Host    loki
    Port    3100
    Labels  service=actyze, env=prod
```

### Routing Logs with Filebeat

Example Filebeat config:

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/actyze/nexus.log
    - /var/log/actyze/schema-service.log
  json.message_key: event
  fields:
    service: actyze
    env: prod

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "actyze-%{+yyyy.MM.dd}"
```

### Routing Logs with Vector

Example Vector config:

```toml
[sources.actyze_logs]
type = "file"
include = ["/var/log/actyze/*.log"]
read_from = "beginning"

[transforms.parse_json]
type = "remap"
inputs = ["actyze_logs"]
source = """
. = parse_json!(.message)
"""

[sinks.datadog]
type = "datadog_logs"
inputs = ["parse_json"]
default_api_key = "${DATADOG_API_KEY}"
site = "datadoghq.com"
```

## Audit Logging

Audit logs track security and compliance events. They are written to the same stdout stream but can be filtered by `event_type`.

### Audit Events

- `nl_query_executed` — NL query submitted, SQL generated, results returned
- `sql_execution` — Raw SQL execution with catalog, row count, errors
- `prediction_generated` — Prediction pipeline execution
- `data_exported` — User exported data (CSV, JSON)
- `dashboard_created` — Dashboard created
- `dashboard_modified` — Dashboard modified
- `schema_change` — Table exclusions, metadata edits
- `authentication` — Login attempts
- `authorization_failure` — Access denied
- `api_error` — API errors with user and endpoint context

### Audit Log Example

```json
{"timestamp": "2024-06-14T10:30:45.123Z", "level": "INFO", "service": "nexus", "event_type": "nl_query_executed", "request_id": "req-abc123", "user_id": "user-42", "query_text": "Show revenue by month", "generated_sql": "SELECT month, SUM(revenue) FROM sales GROUP BY month", "catalog": "postgres", "row_count": 12, "llm_model": "gpt-4", "input_tokens": 234, "output_tokens": 145, "execution_time_ms": 145}

{"timestamp": "2024-06-14T10:30:50.456Z", "level": "INFO", "service": "nexus", "event_type": "authentication", "user_id": "user-42", "success": true}

{"timestamp": "2024-06-14T10:31:00.789Z", "level": "INFO", "service": "nexus", "event_type": "authorization_failure", "user_id": "user-42", "resource": "dashboard-123", "action": "delete"}
```

### Filtering Audit Logs

Extract just audit events for compliance monitoring:

```bash
# Docker compose
docker-compose logs nexus | jq 'select(.event_type != null)'

# Kubernetes
kubectl logs -l app=nexus | jq 'select(.event_type != null)'

# Fluent Bit (separate audit stream)
[FILTER]
    Name    grep
    Match   actyze.nexus
    Regex   log event_type
```

## Integration Examples

### Prometheus + Grafana

1. **Prometheus scrapes Nexus metrics:**
   ```yaml
   global:
     scrape_interval: 30s
   scrape_configs:
     - job_name: actyze
       static_configs:
         - targets: ['nexus:8002']
   ```

2. **Grafana dashboard queries:**
   ```
   Rate of NL queries: rate(nl_queries_total[5m])
   Average query latency: avg(http_request_duration_seconds_sum) / avg(http_request_duration_seconds_count)
   Error rate: rate(http_requests_total{status=~"5.."}[5m])
   LLM token cost: sum(rate(llm_tokens_total[1h])) by (provider)
   ```

3. **Alerts:**
   ```yaml
   - alert: HighErrorRate
     expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
     for: 5m
   - alert: PredictionWorkerDown
     expr: service_health_status{service=~"prediction_worker_.*"} == 0
     for: 2m
   ```

### Datadog

1. **Create Datadog API key** at https://app.datadoghq.com/account/api-keys

2. **Configure container agent:**
   ```yaml
   env:
     - name: DD_AGENT_HOST
       value: "datadog-agent"
     - name: DD_TRACE_ENABLED
       value: "true"
   ```

3. **Ingest metrics via Datadog Agent:**
   ```yaml
   init_config:
   instances:
     - prometheus_url: http://nexus:8002/metrics
       namespace: actyze
       metrics:
         - http_requests_total
         - http_request_duration_seconds
         - nl_queries_total
   ```

### New Relic

1. **Create license key** at https://one.newrelic.com/nr1-core

2. **Forward metrics via OTLP (requires OpenTelemetry integration — coming in Milestone 2)**

### Splunk

Ship logs to Splunk via HTTP Event Collector (HEC):

```ini
# Fluent Bit config
[OUTPUT]
    Name    splunk
    Match   *
    host    splunk.example.com
    port    8088
    token   ${SPLUNK_HEC_TOKEN}
    send_raw on
    event_key log
```

### ELK Stack (Elasticsearch + Logstash + Kibana)

1. **Logstash pipeline:**
   ```
   input { file { path => "/var/log/actyze/*.log" } }
   filter { json { source => "message" } }
   output { elasticsearch { hosts => ["elasticsearch:9200"] index => "actyze-%{+YYYY.MM.dd}" } }
   ```

2. **Kibana dashboards:**
   - Query volume trends
   - Error rate heatmaps
   - User activity timelines
   - LLM cost attribution

## Best Practices

### 1. Monitoring

- **Set up alerts** for error rate, latency p95, and service health
- **Monitor LLM costs** via `llm_tokens_total` metrics
- **Track prediction quality** via pipeline-specific metrics
- **Alert on prediction worker degradation** via `/api/health/predictions`

### 2. Logging

- **Use `request_id`** to trace requests across logs and metrics
- **Include `user_id`** for audit trails and user-level analysis
- **Query `query_id`** to correlate NL input with generated SQL and execution details
- **Set appropriate log levels** (DEBUG for development, INFO for staging, WARN for production)

### 3. Performance

- **Metrics overhead:** <2% CPU/memory impact
- **Logging overhead:** Negligible; structured logs are efficient
- **Prometheus scrape frequency:** 30s recommended (adjust based on alerting SLOs)

### 4. Compliance

- **Audit logs are append-only** and should be forwarded to a secure store
- **Include `user_id` and `request_id`** in all audit events for accountability
- **Retention:** Keep audit logs for 1-2 years (per your data governance policy)
- **Encryption:** Use TLS when shipping logs externally

### 5. Cost Attribution

Track LLM token usage by user or team:

```promql
# Token consumption per user
sum by (user_id, token_type) (rate(llm_tokens_total[1h]))

# Top 10 users by token consumption
topk(10, sum by (user_id) (llm_tokens_total))

# Cost estimate (assuming OpenAI GPT-4: $0.00003/input, $0.00006/output)
(sum(llm_tokens_total{token_type="input"}) * 0.00003) +
(sum(llm_tokens_total{token_type="output"}) * 0.00006)
```

### 6. Troubleshooting

Use logs and metrics together:

```bash
# Find slow queries
kubectl logs -f deployment/nexus | jq 'select(.event == "sql_execution" and .execution_time_ms > 1000)'

# Identify user with most errors
kubectl logs deployment/nexus | jq 'select(.level == "ERROR")' | jq '.user_id' | sort | uniq -c | sort -rn

# Monitor prediction worker health in real-time
watch -n 5 'curl -s http://nexus:8002/api/health/predictions | jq'
```

## What's Next

- **Milestone 2** (OpenTelemetry): Distributed tracing for the NL→LLM→SQL→Trino call chain
- **Milestone 3** (Production Hardening): Cost attribution dashboards, slow-query analyzer, tested integrations

See the main [observability issue (#142)](https://github.com/actyze/dashboard/issues/142) for progress.
