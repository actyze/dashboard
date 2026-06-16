# Actyze Observability Documentation

Complete guide to the observability infrastructure for all Actyze services.

## Quick Navigation

### For New Service Implementations
Start with **[ARCHITECTURE.md](ARCHITECTURE.md)** to understand:
- Module structure (logging, metrics, health checks)
- Integration pattern for Python services
- How to add observability to a new service

### For Kubernetes Deployments
See **[KUBERNETES.md](KUBERNETES.md)** for:
- Health probe configuration (liveness, readiness, startup)
- Prometheus metrics collection
- Log routing with Fluent Bit and Loki
- Complete deployment examples

### For External Service Monitoring
Check **[EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md)** to monitor:
- PostgreSQL (metrics, alerting, connection pooling)
- Trino (JMX configuration, health checks)
- Redis (exporter setup, cache metrics)
- Multi-service monitoring stack

### For API Integration
Reference **[API-REFERENCE.md](API-REFERENCE.md)** for:
- Complete function signatures
- Logging API with context variables
- Metrics instrumentation
- Health check framework
- FastAPI integration examples

## Documentation Files

| File | Lines | Purpose |
|------|-------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 300 | System architecture, language-specific modules, integration patterns |
| [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md) | 545 | Monitoring PostgreSQL, Trino, Redis, and other external services |
| [KUBERNETES.md](KUBERNETES.md) | 684 | K8s health probes, metrics collection, log routing, deployment examples |
| [API-REFERENCE.md](API-REFERENCE.md) | 818 | Complete API documentation with code examples |

**Total: 2,347 lines of documentation**

## Core Concepts

### Three Pillars of Observability

1. **Structured Logging** (`structlog`)
   - JSON output with context variables
   - Request ID tracing for distributed debugging
   - Service name and user/query attribution
   - Automatic serialization of custom fields

2. **Prometheus Metrics** (`prometheus-client`)
   - Standard OpenMetrics text format
   - HTTP, query, LLM, cache, and database metrics
   - Histogram buckets for latency quantiles
   - Standard label names for consistency

3. **Health Checks** (custom framework)
   - Liveness probes: is the service alive?
   - Readiness probes: can the service handle traffic?
   - Dependency health checks: are all backends healthy?
   - Concurrent checking for startup performance

### Context Propagation

Every request automatically includes:
- `request_id` — Unique ID for tracing across logs and metrics
- `user_id` — User attribution for audit trails
- `query_id` — Query correlation for NL→SQL→Results
- `service` — Service name for multi-service deployments

These are set once per request and propagated to all logs within that request's context using Python's `contextvars`.

## Service Integration Checklist

When adding a new Python service to Actyze:

- [ ] Copy `shared/observability/python/` to your service
- [ ] Call `configure_logging()` at startup
- [ ] Add HTTP middleware to set `request_id` and wrap requests with `MetricsContext`
- [ ] Implement `/healthz` (liveness) and `/readyz` (readiness) endpoints
- [ ] Register health checks for your service's dependencies
- [ ] Expose `/metrics` endpoint with Prometheus exporter
- [ ] Test health probes: `curl http://localhost:8002/healthz`
- [ ] Verify metrics: `curl http://localhost:8002/metrics`

## Example: Adding to a FastAPI Service

```python
from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
import uuid

from observability.python import (
    configure_logging,
    get_logger,
    set_request_id,
    MetricsContext,
    HealthChecker,
)

logger = get_logger(__name__)
health_checker = HealthChecker()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_logging(service_name="my-service", log_level="INFO")
    logger.info("service_started")
    yield
    # Shutdown
    logger.info("service_stopped")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def add_request_tracing(request: Request, call_next):
    set_request_id(str(uuid.uuid4()))
    with MetricsContext(request.method, request.url.path) as ctx:
        response = await call_next(request)
        ctx.set_status(response.status_code)
        return response

@app.get("/healthz")
async def liveness():
    return {"status": "alive"}

@app.get("/readyz")
async def readiness():
    result = await health_checker.check_all()
    status = 200 if result.healthy else 503
    return result.to_dict(), status

@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

## Key Metrics to Monitor

### Application Level
- `http_requests_total` — Request volume and error rates
- `http_request_duration_seconds` — Latency percentiles
- `nl_queries_total` — NL query volume and success rate
- `llm_tokens_total` — LLM cost attribution

### Dependency Health
- `service_health_status` — Postgres, Trino, Redis, schema-service
- `db_connections_active` / `db_connections_idle` — Connection pool usage
- `cache_hits_total` / `cache_misses_total` — Cache efficiency

### Predictions
- `predictions_total` — Prediction generation volume
- `prediction_duration_seconds` — Pipeline latency

## Useful Prometheus Queries

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# Error rate (5xx responses)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p95 query latency
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Token consumption per provider
rate(llm_tokens_total[1h]) by (provider, token_type)

# Cache hit ratio
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))

# Slow queries (>1 second)
histogram_quantile(0.95, rate(sql_execution_duration_seconds_bucket[5m])) > 1
```

## Deployment Patterns

### Docker Compose (Development)
```bash
docker-compose up -d
curl http://localhost:8002/healthz   # Liveness
curl http://localhost:8002/readyz    # Readiness
curl http://localhost:8002/metrics   # Prometheus
```

### Kubernetes (Production)
- See [KUBERNETES.md](KUBERNETES.md) for complete examples
- Use `livenessProbe`, `readinessProbe`, and `startupProbe` in manifests
- Deploy Prometheus + Grafana for monitoring
- Use Fluent Bit DaemonSet for log collection
- Route to Loki or Datadog for log aggregation

## Performance Impact

- **Logging**: ~1-2% CPU overhead, minimal memory
- **Metrics**: <1% CPU overhead, ~10-50MB memory
- **Context variables**: Zero overhead (thread-local storage)
- **Prometheus scrape**: 30s recommended, <100ms collection time

## Files in This Directory

```
shared/observability/docs/
├── README.md                    # This file (navigation & quick start)
├── ARCHITECTURE.md              # System design and integration patterns
├── EXTERNAL-SERVICES.md         # Postgres, Trino, Redis monitoring guides
├── KUBERNETES.md                # K8s probes, metrics, log routing
└── API-REFERENCE.md             # Complete function signatures & examples
```

## See Also

- **Source Code**: `../python/` — Implementation of logging, metrics, and health modules
- **Project Observability Issue**: https://github.com/actyze/dashboard/issues/142
- **Prometheus Best Practices**: https://prometheus.io/docs/practices/instrumentation/
- **structlog Documentation**: https://www.structlog.org/

## Questions?

For implementation questions, see [API-REFERENCE.md](API-REFERENCE.md).
For deployment questions, see [KUBERNETES.md](KUBERNETES.md).
For monitoring external services, see [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md).
