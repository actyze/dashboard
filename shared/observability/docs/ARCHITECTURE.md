# Observability Architecture

This document describes the observability infrastructure across all Actyze services.

## Overview

Actyze uses a modular observability approach:

- **Logging**: Structured JSON logs via structlog
- **Metrics**: Prometheus-compatible metrics via prometheus-client
- **Health Checks**: Service health endpoints and dependency probes
- **Tracing**: Request ID propagation for distributed tracing

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Actyze Services                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Nexus      │  │ Schema Svc   │  │ Predictions  │     │
│  │  (FastAPI)   │  │  (FastAPI)   │  │  (Workers)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │             │
│         └────────┬────────┴────────┬────────┘             │
│                  │                 │                      │
│  ┌───────────────▼─────────────────▼──────────────────┐  │
│  │   shared/observability/python                      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────┐   │  │
│  │  │  logging.py │  │metrics.py│  │ health.py  │   │  │
│  │  └─────────────┘  └──────────┘  └────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼──────┐  ┌─────▼──────┐  ┌────▼──────┐
    │  Prometheus│  │   Logs     │  │ Health    │
    │  /metrics  │  │  stdout    │  │ /healthz  │
    │   port8002 │  │   (JSON)   │  │ /readyz   │
    └────────────┘  └────────────┘  └───────────┘
```

## Language-Specific Modules

### Python (`shared/observability/python/`)

The primary observability module used by all Python services.

#### Core Components

**logging.py**
- Structured logging with context variables
- JSON and human-readable output formats
- Context managers for request tracing
- Available in all Python services via `from observability import ...`

**metrics.py**
- Prometheus metric definitions (counters, histograms, gauges)
- HTTP, query, LLM, cache, database, and audit metrics
- Thread-safe metric recording
- Metrics registry management

**health.py**
- Health check framework for dependencies
- Concurrent health checking
- Readiness probe implementation
- HTTP, database, and Redis health checks

#### Dependencies

```
structlog==24.4.0              # Structured logging
python-json-logger==3.2.1      # JSON output support
prometheus-client==0.24.1      # Metrics export
```

### JavaScript/TypeScript (Optional Future)

For frontend metrics and browser event tracking:

```
shared/observability/javascript/
├── metrics.ts                 # Browser-side metrics
├── logging.ts                 # Client-side logging
└── README.md
```

Currently, frontend metrics are logged to browser console and can be ingested via JavaScript error tracking services.

## Service Integration Pattern

Every Python service using shared observability follows this pattern:

### 1. Initialization (in main.py or app startup)

```python
from observability.python import configure_logging, get_logger

logger = get_logger(__name__)

def startup():
    configure_logging(
        service_name="my-service",
        log_level="INFO",
        log_format="json"
    )
    logger.info("service_started")
```

### 2. HTTP Middleware (FastAPI)

```python
from fastapi import Request
from observability.python import set_request_id, MetricsContext
import uuid

@app.middleware("http")
async def add_request_tracing(request: Request, call_next):
    request_id = str(uuid.uuid4())
    set_request_id(request_id)
    
    with MetricsContext(request.method, request.url.path) as ctx:
        response = await call_next(request)
        ctx.set_status(response.status_code)
        return response
```

### 3. Health Endpoints

```python
from observability.python import HealthChecker, check_database_connection

health_checker = HealthChecker()

@app.on_event("startup")
async def setup_health():
    health_checker.register("database", check_database_connection)

@app.get("/healthz")
async def liveness():
    return {"status": "alive", "service": "my-service"}

@app.get("/readyz")
async def readiness():
    result = await health_checker.check_all()
    status = 200 if result.healthy else 503
    return result.to_dict(), status

@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

### 4. Operation-Specific Logging

```python
from observability.python import get_logger, record_sql_execution
import time

logger = get_logger(__name__)

async def execute_query(sql: str, catalog: str):
    start = time.time()
    try:
        result = await query_engine.execute(sql, catalog=catalog)
        duration = time.time() - start
        
        logger.info(
            "sql_execution_success",
            catalog=catalog,
            row_count=len(result),
            duration_ms=duration * 1000
        )
        
        record_sql_execution(
            duration=duration,
            catalog=catalog,
            row_count=len(result)
        )
        
        return result
    except Exception as e:
        duration = time.time() - start
        logger.error(
            "sql_execution_failed",
            catalog=catalog,
            error=str(e),
            duration_ms=duration * 1000
        )
        raise
```

## How New Services Integrate

When adding a new service to Actyze:

### Step 1: Import the observability module

```bash
# Option A: Copy to your service
cp -r shared/observability/python your-service/observability

# Option B: Reference via sys.path (if package structure available)
import sys
sys.path.insert(0, '/path/to/shared')
from observability.python import ...

# Option C: Install as local package (future)
pip install -e shared/observability/python
```

### Step 2: Configure at startup

All logs and metrics automatically use the configured service name and context variables.

### Step 3: Use in request handlers

```python
with MetricsContext(method, endpoint) as ctx:
    # Handle request
    ctx.set_status(status_code)
```

### Step 4: Implement health endpoints

Register health checks for your service's dependencies and expose `/healthz`, `/readyz`, and `/metrics`.

## Metric Naming Convention

All metrics follow Prometheus naming conventions:

```
<namespace>_<subsystem>_<name>_<unit>

Examples:
  http_requests_total          # Counter, no unit
  http_request_duration_seconds # Histogram, unit=seconds
  db_connections_active        # Gauge, no unit
  sql_result_rows              # Histogram, no unit
```

## Label Standardization

Common labels across metrics:

| Label | Values | Example |
|-------|--------|---------|
| `method` | HTTP methods | GET, POST, DELETE |
| `endpoint` | Request path | /api/queries, /health |
| `status` | HTTP status code | 200, 400, 500 |
| `catalog` | Data source name | postgres, trino, mysql |
| `provider` | LLM provider | openai, anthropic, cohere |
| `model` | Model name | gpt-4, claude-opus, gpt-3.5-turbo |
| `error_type` | Error category | timeout, auth, syntax |
| `cache_type` | Cache category | query, metadata, llm |
| `service` | Service name | nexus, schema-service |

## Context Propagation

The observability module uses Python's `contextvars` for thread-safe context:

```python
# Automatically included in all logs:
- request_id     # Request tracing
- user_id        # User attribution
- query_id       # Query correlation
- session_id     # Session tracking (optional)
```

These are set once per request and automatically propagated to all logs and metrics within that request's context.

## Observability Endpoints Summary

Every service exposes:

| Endpoint | Purpose | Format | Status Codes |
|----------|---------|--------|--------------|
| `/healthz` | Liveness | JSON | 200 always |
| `/readyz` | Readiness | JSON | 200 or 503 |
| `/metrics` | Prometheus | Text | 200 always |
| `/api/health/predictions` | Predictions health (Nexus only) | JSON | 200 or 503 |

## Performance Considerations

- **Logging overhead**: ~1-2% CPU impact, minimal memory
- **Metrics overhead**: <1% CPU impact, ~10-50MB memory for registry
- **Context variables**: No performance impact (thread-local storage)
- **Scrape frequency**: 30s recommended for Prometheus

## See Also

- [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md) - Monitoring Postgres, Trino, Redis
- [KUBERNETES.md](KUBERNETES.md) - Health probes and log routing in K8s
- [API-REFERENCE.md](API-REFERENCE.md) - Complete API documentation
- [../python/README.md](../python/README.md) - Python module usage guide
