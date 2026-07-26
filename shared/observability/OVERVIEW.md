# Shared Observability Infrastructure

This directory contains reusable observability infrastructure for all Python services in the Actyze platform.

## Structure

```
shared/observability/
├── python/                          # Python observability module
│   ├── __init__.py                 # Public API exports
│   ├── logging.py                  # Structured logging (structlog)
│   ├── metrics.py                  # Prometheus metrics
│   ├── health.py                   # Health checks & readiness probes
│   ├── requirements.txt            # Dependencies
│   └── README.md                   # Detailed usage guide
└── OVERVIEW.md                     # This file
```

## Quick Overview

### Logging (`logging.py`)
- **Framework**: structlog with JSON/console output
- **Context variables**: request_id, user_id, query_id, session_id
- **Functions**:
  - `configure_logging(service_name, log_level, log_format)`
  - `get_logger(name)` - Get a structlog instance
  - `set_request_id(id)` / `get_request_id()`
  - `set_user_id(id)` / `get_user_id()`
  - Context variables are automatically included in all logs

### Metrics (`metrics.py`)
- **Framework**: prometheus-client
- **Categories**:
  - HTTP: requests total, duration, in-progress
  - Queries: NL queries, SQL execution (duration, errors, rows)
  - LLM: calls, tokens, duration per provider/model
  - Cache: hits, misses, size
  - Database: active/idle connections
  - Health: external service status
  - Predictions: count, duration
  - Audit: event tracking
- **Functions**:
  - `configure_metrics()` - Get registry
  - `MetricsContext(method, endpoint)` - Context manager for HTTP metrics
  - `record_sql_execution(duration, catalog, error, row_count)`
  - `record_llm_call(provider, model, status, duration, input_tokens, output_tokens)`
  - `record_cache_hit/miss(cache_type)`
  - `set_service_health(service, healthy)`

### Health (`health.py`)
- **Classes**:
  - `HealthChecker` - Concurrent health checks for dependencies
  - `ReadinessChecker` - Readiness probe checks
  - `HealthStatus` - Single check result
  - `HealthCheckResult` - Aggregated results
- **Utility functions**:
  - `check_http_endpoint(url)`
  - `check_database_connection(get_connection)`
  - `check_redis_connection(redis_client)`
- **Usage**: Register checks at startup, call `check_all()` or `is_ready()` in endpoints

## Services Using This Module

| Service | Status | Notes |
|---------|--------|-------|
| **nexus** | Reference impl | Original logging/metrics (migrate to shared) |
| **schema-service** | Ready to adopt | Uses minimal logging currently |
| **prediction-workers** | Ready to adopt | Can standardize metrics across pipelines |
| **Future services** | Ready | Start with shared module from day 1 |

## Installation in a Service

1. **Copy to your service**:
   ```bash
   cp -r shared/observability/python observability
   ```

2. **Add to requirements.txt**:
   ```
   structlog==24.4.0
   python-json-logger==3.2.1
   prometheus-client==0.24.1
   ```

3. **Or reference via sys.path** (if shared is a package):
   ```python
   import sys
   sys.path.insert(0, '/path/to/shared')
   from observability.python import configure_logging, get_logger
   ```

## Example: Using in FastAPI Service

```python
from fastapi import FastAPI, Request
import uuid

from observability.python import (
    configure_logging,
    get_logger,
    set_request_id,
    MetricsContext,
)

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging("my-service", log_level="INFO", log_format="json")
    logger.info("service_started")
    yield
    logger.info("service_stopped")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    set_request_id(str(uuid.uuid4()))
    return await call_next(request)

@app.get("/api/data")
async def get_data():
    with MetricsContext("GET", "/api/data") as ctx:
        try:
            result = await fetch_data()
            ctx.set_status(200)
            return result
        except Exception as e:
            logger.error("fetch_failed", error=str(e))
            ctx.set_status(500)
            raise

@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

## Migration from Nexus

The Nexus service has reference implementations that should be migrated:

- `nexus/app/logging.py` → `shared/observability/python/logging.py` ✓ (reusable)
- `nexus/app/metrics.py` → `shared/observability/python/metrics.py` ✓ (reusable)
- `nexus/app/audit_logger.py` → Can be simplified with metrics module

Steps:
1. Update Nexus imports: `from app.logging import ...` → `from observability import ...`
2. Verify metrics endpoint still works
3. Document any Nexus-specific extensions
4. Roll out to other services

## Dependencies

All included in `python/requirements.txt`:
- **structlog** (24.4.0) - Structured logging
- **python-json-logger** (3.2.1) - JSON logging support
- **prometheus-client** (0.24.1) - Prometheus metrics

These are also listed in `nexus/requirements.txt`, so no additional dependencies needed for existing services.

## Best Practices

1. **Configure once at startup**:
   ```python
   configure_logging(service_name="my-service")
   ```

2. **Use context managers for HTTP**:
   ```python
   with MetricsContext(method, endpoint) as ctx:
       # Handle request
       ctx.set_status(200)
   ```

3. **Set context variables early**:
   ```python
   set_request_id(request_id)
   set_user_id(user_id)
   # All logs now include these automatically
   ```

4. **Track resource-intensive operations**:
   ```python
   start = time.time()
   result = execute_query(sql)
   record_sql_execution(time.time() - start, catalog="trino")
   ```

5. **Implement health checks**:
   ```python
   health = HealthChecker()
   health.register("database", check_database)
   # In /health endpoint:
   result = await health.check_all()
   return result.to_dict(), 200 if result.healthy else 503
   ```

## See Also

- [Python Module README](python/README.md) - Comprehensive usage guide
- [Prometheus Instrumentation](https://prometheus.io/docs/practices/instrumentation/)
- [structlog Docs](https://www.structlog.org/)
