# Actyze Observability Module

Reusable observability infrastructure for all Python services in Actyze, including structured logging, Prometheus metrics, and health checks.

This module is designed to be shared across:
- **nexus** (main API service)
- **schema-service** (table discovery and schema management)
- **prediction-workers** (XGBoost, LightGBM, AutoGluon pipelines)
- Any future Python services in the Actyze platform

## Features

### Structured Logging
- **structlog** integration for JSON or console output
- **Context variables** for request tracing (request_id, user_id, query_id, session_id)
- **Service name** included in all log events
- Configurable log levels and formats

### Prometheus Metrics
- **HTTP metrics**: request count, duration, in-progress requests
- **Query metrics**: natural language queries, SQL execution (duration, errors, rows)
- **LLM metrics**: API calls, tokens consumed, latency per provider/model
- **Cache metrics**: hits, misses, size tracking
- **Database metrics**: active/idle connection counts
- **Service health**: external dependency status
- **Prediction metrics**: pipeline execution and duration
- **Audit metrics**: event tracking

### Health Checks
- **HealthChecker**: Concurrent health checks for all dependencies
- **ReadinessChecker**: Readiness probes to determine when service is ready
- **Utility functions**: Pre-built checks for HTTP endpoints, databases, Redis

## Installation

1. Copy the `observability` module to your service:
   ```bash
   cp -r shared/observability/python observability
   ```

2. Install dependencies:
   ```bash
   pip install -r observability/requirements.txt
   ```

3. Or integrate into your service's `requirements.txt`:
   ```
   structlog==24.4.0
   python-json-logger==3.2.1
   prometheus-client==0.24.1
   ```

## Quick Start

### Basic Setup

```python
from observability.logging import configure_logging, get_logger
from observability.metrics import configure_metrics

# Configure at service startup
configure_logging(service_name="my-service", log_level="INFO", log_format="json")
logger = get_logger(__name__)

# Log messages with structured fields
logger.info("service_started", version="0.1.0", port=8000)
```

### Logging with Context

```python
from observability.logging import (
    set_request_id, 
    set_user_id,
    get_logger
)

logger = get_logger(__name__)

# In request handler
set_request_id("req-1234-5678")
set_user_id("user-123")

# Context variables are automatically included in logs
logger.info("query_processing_started", catalog="trino")
```

### HTTP Request Metrics

```python
from observability.metrics import MetricsContext

# Track HTTP requests with context manager
with MetricsContext("GET", "/api/queries") as ctx:
    try:
        # ... handle request
        result = await process_query(sql)
        ctx.set_status(200)
    except Exception as e:
        logger.error("request_failed", error=str(e))
        ctx.set_status(500)
        raise

# Metrics recorded:
# - http_requests_total (with method, endpoint, status)
# - http_request_duration_seconds (with method, endpoint)
# - http_requests_in_progress
```

### Query Execution Metrics

```python
from observability.metrics import record_sql_execution, record_nl_query
import time

# Track natural language query
record_nl_query(status="success", model="claude-3-sonnet")

# Track SQL execution with timing
start = time.time()
try:
    result = await execute_query(sql, catalog="trino")
    record_sql_execution(
        duration=time.time() - start,
        catalog="trino",
        row_count=len(result)
    )
except Exception as e:
    record_sql_execution(
        duration=time.time() - start,
        catalog="trino",
        error=type(e).__name__
    )
    raise
```

### LLM Call Metrics

```python
from observability.metrics import record_llm_call
import time

start = time.time()
try:
    response = await llm_provider.complete(
        model="claude-3-sonnet",
        messages=[{"role": "user", "content": prompt}]
    )
    duration = time.time() - start
    
    record_llm_call(
        provider="anthropic",
        model="claude-3-sonnet",
        duration=duration,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens
    )
except Exception as e:
    record_llm_call(
        provider="anthropic",
        model="claude-3-sonnet",
        status="error"
    )
    raise
```

### Cache Metrics

```python
from observability.metrics import (
    record_cache_hit,
    record_cache_miss,
    set_cache_size
)

# Track cache usage
if key in cache:
    record_cache_hit("query_cache")
    return cache[key]
else:
    record_cache_miss("query_cache")
    result = await fetch_result()
    cache[key] = result
    set_cache_size("query_cache", sys.getsizeof(cache))
    return result
```

### Health Checks

```python
from observability.health import (
    HealthChecker,
    check_http_endpoint,
    check_database_connection
)

# Set up health checker
health = HealthChecker()

# Register checks
async def check_trino():
    return await check_http_endpoint("http://trino:8080/ui/")

async def check_postgres():
    return await check_database_connection(get_db_connection)

health.register("trino", check_trino)
health.register("postgres", check_postgres)

# In your /health endpoint
@app.get("/health")
async def health_check():
    result = await health.check_all()
    if result.healthy:
        return {"status": "healthy"}
    else:
        return {"status": "unhealthy", "checks": [c.to_dict() for c in result.checks]}, 503
```

### Readiness Probes

```python
from observability.health import ReadinessChecker

readiness = ReadinessChecker()

# Register readiness checks (can have required checks)
async def is_schema_loaded():
    return len(tables) > 0  # True if schema is loaded

readiness.register("schema_loaded", is_schema_loaded, required=True)
readiness.register("cache_primed", is_cache_primed, required=False)

# In your /ready endpoint
@app.get("/ready")
async def readiness_probe():
    if await readiness.is_ready():
        return {"ready": True}
    else:
        status = await readiness.get_status()
        return {"ready": False, "status": status}, 503
```

## FastAPI Integration Example

Complete example of integrating observability into a FastAPI service:

```python
from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
import time
import uuid

from observability import (
    configure_logging,
    get_logger,
    set_request_id,
    set_user_id,
    MetricsContext,
    HealthChecker,
)

logger = get_logger(__name__)

# Set up health checks
health = HealthChecker()

async def check_database():
    # ... check database
    from observability import HealthStatus
    return HealthStatus(name="database", healthy=True)

health.register("database", check_database)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_logging(service_name="nexus", log_level="INFO", log_format="json")
    logger.info("service_starting")
    yield
    # Shutdown
    logger.info("service_stopping")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def add_context(request: Request, call_next):
    """Add request_id and user_id to context before processing."""
    request_id = str(uuid.uuid4())
    set_request_id(request_id)
    
    # Try to extract user from auth header
    auth_header = request.headers.get("Authorization", "")
    if auth_header:
        set_user_id(auth_header.split()[-1][:8])  # First 8 chars of token
    
    return await call_next(request)

@app.get("/api/queries")
async def get_queries():
    """Example endpoint with metrics tracking."""
    with MetricsContext("GET", "/api/queries") as ctx:
        try:
            logger.info("fetching_queries")
            queries = await db.query("SELECT * FROM queries LIMIT 100")
            ctx.set_status(200)
            return {"queries": queries}
        except Exception as e:
            logger.error("query_failed", error=str(e))
            ctx.set_status(500)
            raise

@app.get("/health")
async def health_check():
    """Kubernetes liveness probe."""
    result = await health.check_all()
    status = 200 if result.healthy else 503
    return result.to_dict(), status

@app.get("/ready")
async def readiness_probe():
    """Kubernetes readiness probe."""
    # Basic checks for startup completion
    return {"ready": True}, 200
```

## Metrics Endpoint

To expose Prometheus metrics in FastAPI:

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

Then configure your Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'nexus'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Log Output Formats

### JSON Format (Production)

```json
{
  "event": "query_processing_started",
  "log_level": "info",
  "timestamp": "2025-06-14T15:30:45.123456",
  "request_id": "req-1234-5678",
  "user_id": "user-123",
  "query_id": "query-456",
  "catalog": "trino",
  "duration_ms": 1234
}
```

### Console Format (Development)

```
2025-06-14 15:30:45 [info     ] query_processing_started
    catalog=trino duration_ms=1234 request_id=req-1234-5678 user_id=user-123
```

## Available Metrics Reference

### HTTP Metrics
- `http_requests_total{method, endpoint, status}` - Total requests
- `http_request_duration_seconds{method, endpoint}` - Request latency histogram
- `http_requests_in_progress` - In-flight request count

### Query Metrics
- `nl_queries_total{status, model}` - Natural language queries processed
- `sql_execution_duration_seconds{catalog}` - SQL execution time
- `sql_execution_errors_total{catalog, error_type}` - SQL errors
- `sql_result_rows{catalog}` - Rows returned by queries

### LLM Metrics
- `llm_calls_total{provider, model, status}` - API calls
- `llm_tokens_total{provider, model, token_type}` - Tokens consumed (input/output)
- `llm_call_duration_seconds{provider, model}` - Call latency

### Cache Metrics
- `cache_hits_total{cache_type}` - Cache hits
- `cache_misses_total{cache_type}` - Cache misses
- `cache_size_bytes{cache_type}` - Cache size

### Database Metrics
- `db_connections_active` - Active connections
- `db_connections_idle` - Idle connections

### Prediction Metrics
- `predictions_total{pipeline_type, status}` - Predictions generated
- `prediction_duration_seconds{pipeline_type}` - Pipeline execution time

### Health Metrics
- `service_health_status{service}` - External service health (1=healthy, 0=unhealthy)

## Testing

Example test using the observability module:

```python
import pytest
from observability import (
    get_logger,
    set_request_id,
    MetricsContext,
    HealthChecker,
)

@pytest.mark.asyncio
async def test_health_check():
    """Test health checker."""
    health = HealthChecker()
    
    async def always_healthy():
        from observability import HealthStatus
        return HealthStatus(name="test", healthy=True)
    
    health.register("test_check", always_healthy)
    result = await health.check_all()
    
    assert result.healthy
    assert len(result.checks) == 1
    assert result.checks[0].name == "test_check"

def test_metrics_context():
    """Test metrics context manager."""
    with MetricsContext("POST", "/api/data") as ctx:
        ctx.set_status(201)
    
    # Metrics should be recorded (verify via Prometheus scrape)
```

## Migration from Nexus Implementation

If migrating from the Nexus implementation:

1. Move `nexus/app/logging.py` → `shared/observability/python/logging.py`
2. Move `nexus/app/metrics.py` → `shared/observability/python/metrics.py`
3. Move `nexus/app/audit_logger.py` → implement as a wrapper using the metrics/logging modules
4. Update imports in Nexus: `from observability import ...` instead of `from app import ...`
5. Repeat for other services

## AGPL Compliance

This module is part of the Actyze project and is licensed under AGPL-3.0. All source code files include the appropriate license header.

## See Also

- [Nexus API Observability](../../nexus/README.md) - Service-specific observability setup
- [Prometheus Best Practices](https://prometheus.io/docs/practices/instrumentation/)
- [structlog Documentation](https://www.structlog.org/)
