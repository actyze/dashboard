# Observability Module Integration Guide

Step-by-step guide for integrating the shared observability module into Actyze services.

## Overview

The observability module provides three core capabilities:
1. **Structured Logging** - Context-aware structured logs with structlog
2. **Prometheus Metrics** - HTTP, query, LLM, cache, and database metrics
3. **Health Checks** - Service health and readiness probes

All functionality is in `/shared/observability/python/`, designed to be:
- **Reusable** across all Python services
- **Backward-compatible** with existing Nexus implementation
- **Zero-configuration** (sensible defaults)
- **Extensible** (register custom checks, metrics)

## Integration Paths

### Path 1: Direct Module Copy (Simplest)

Copy the observability module directly into your service:

```bash
# In your service directory (e.g., nexus/)
cp -r ../../shared/observability/python observability
```

Pros: No shared import issues, works in any Python environment
Cons: Duplicate code, harder to update across services

### Path 2: Shared Package Import (Best)

Configure Python path to use shared module:

```python
# In your service __main__.py or app.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

from observability.python import configure_logging, get_logger
```

Pros: Single source of truth, easier to maintain
Cons: Requires careful path setup

### Path 3: Pip Installable (Most Robust)

Convert to proper Python package (future):

```bash
pip install -e ./shared/
from observability.python import configure_logging
```

## Step 1: Install Dependencies

Add to your `requirements.txt`:

```
structlog==24.4.0
python-json-logger==3.2.1
prometheus-client==0.24.1
```

Or just reference the observability requirements:

```bash
pip install -r shared/observability/python/requirements.txt
```

## Step 2: Configure Logging at Startup

In your main application file:

```python
from observability.python import configure_logging, get_logger

# FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup
    configure_logging(
        service_name="my-service",
        log_level="INFO",
        log_format="json"  # Use "console" for development
    )
    logger = get_logger(__name__)
    logger.info("service_started")
    
    yield
    
    # Shutdown
    logger.info("service_stopped")

app = FastAPI(lifespan=lifespan)

# Flask
import logging
configure_logging(service_name="my-service")
logger = get_logger(__name__)
logger.info("service_started")
```

## Step 3: Add Request Context Middleware

### FastAPI

```python
from fastapi import Request
import uuid
from observability.python import set_request_id, set_user_id

@app.middleware("http")
async def add_request_context(request: Request, call_next):
    # Generate or use existing request ID
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    
    # Extract user (adapt to your auth scheme)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        user_id = auth[7:16]  # First 16 chars of token
        set_user_id(user_id)
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

### Flask

```python
from flask import request, g
import uuid
from observability.python import set_request_id, set_user_id

@app.before_request
def add_request_context():
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        set_user_id(auth[7:16])
    
    g.request_id = request_id
```

## Step 4: Instrument HTTP Endpoints

Wrap request handlers with `MetricsContext`:

```python
from observability.python import MetricsContext, get_logger

logger = get_logger(__name__)

@app.get("/api/data")
async def get_data():
    with MetricsContext("GET", "/api/data") as ctx:
        try:
            logger.info("fetching_data")
            result = await fetch_data()
            ctx.set_status(200)
            return result
        except Exception as e:
            logger.error("fetch_failed", error=str(e))
            ctx.set_status(500)
            raise
```

## Step 5: Track Database Operations

Record SQL execution timing and errors:

```python
import time
from observability.python import record_sql_execution

async def query_database(sql: str, catalog: str = "postgres"):
    start = time.time()
    try:
        result = await db.fetch(sql)
        record_sql_execution(
            duration=time.time() - start,
            catalog=catalog,
            row_count=len(result)
        )
        return result
    except Exception as e:
        record_sql_execution(
            duration=time.time() - start,
            catalog=catalog,
            error=type(e).__name__
        )
        raise
```

## Step 6: Track LLM API Calls

Record provider, model, tokens, and latency:

```python
import time
from observability.python import record_llm_call

async def call_llm(prompt: str, model: str = "claude-3-sonnet"):
    start = time.time()
    try:
        response = await llm_client.complete(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        
        record_llm_call(
            provider="anthropic",
            model=model,
            duration=time.time() - start,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens
        )
        return response.content
    except Exception as e:
        record_llm_call(
            provider="anthropic",
            model=model,
            status="error"
        )
        raise
```

## Step 7: Implement Health Checks

Create a health check endpoint:

```python
from observability.python import (
    HealthChecker,
    check_http_endpoint,
    check_database_connection
)

health = HealthChecker()

# Register dependency checks
async def check_database():
    return await check_database_connection(get_db_connection)

async def check_external_api():
    return await check_http_endpoint("http://api.example.com/health")

health.register("database", check_database)
health.register("external_api", check_external_api)

# Health endpoint
@app.get("/health")
async def health_check():
    result = await health.check_all()
    status_code = 200 if result.healthy else 503
    return result.to_dict(), status_code
```

## Step 8: Expose Prometheus Metrics

Add metrics endpoint:

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

@app.get("/metrics")
async def metrics():
    from fastapi import Response
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

Or with Flask:

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

@app.route("/metrics")
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}
```

## Step 9: Configure Kubernetes Probes

Update your deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  template:
    spec:
      containers:
      - name: app
        image: my-service:latest
        ports:
        - containerPort: 8000
        
        # Liveness probe - is the service alive?
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
          failureThreshold: 3
        
        # Readiness probe - can it handle traffic?
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
          failureThreshold: 3
```

## Step 10: Configure Prometheus Scrape

In your Prometheus `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'my-service'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Integration Checklist

- [ ] Dependencies installed (structlog, prometheus-client)
- [ ] Observability module copied or imported
- [ ] Logging configured at startup with `configure_logging()`
- [ ] Request context middleware added
- [ ] HTTP endpoints wrapped with `MetricsContext`
- [ ] Database operations tracked with `record_sql_execution()`
- [ ] LLM calls tracked with `record_llm_call()`
- [ ] Cache operations tracked with `record_cache_hit/miss()`
- [ ] Health checks registered
- [ ] `/health` endpoint implemented
- [ ] `/ready` endpoint implemented
- [ ] `/metrics` endpoint exposed
- [ ] Kubernetes probes configured
- [ ] Prometheus scrape config added

## Migration from Nexus Implementation

If you're in Nexus and want to use the shared module:

### Before (Current)
```python
from app.logging import configure_logging, get_logger
from app.metrics import record_sql_execution, MetricsContext
from app.audit_logger import audit_logger
```

### After (Shared)
```python
from observability.python import (
    configure_logging,
    get_logger,
    record_sql_execution,
    MetricsContext,
)
# Audit logging is now done via metrics
from observability.python import record_audit_event
```

Steps:
1. Copy `shared/observability/python/` to `nexus/observability/`
2. Update imports (see above)
3. Test endpoints and metrics
4. Remove `nexus/app/logging.py`, `nexus/app/metrics.py`
5. Implement audit functionality using `record_audit_event()`

## Troubleshooting

### Issue: Import errors for observability module

**Solution**: Ensure Python path is set correctly:
```python
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))  # Current service
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
```

### Issue: Metrics not appearing in Prometheus

**Check**:
1. Is `/metrics` endpoint reachable? `curl http://localhost:8000/metrics`
2. Is Prometheus configured to scrape it?
3. Are metrics actually being recorded? Check logs.

### Issue: Logs are not in JSON format

**Solution**: Ensure `log_format="json"` in configure_logging:
```python
configure_logging(
    service_name="my-service",
    log_format="json"  # Not "console"
)
```

### Issue: Context variables (request_id, user_id) not in logs

**Solution**: Ensure middleware is setting them BEFORE request processing:
```python
@app.middleware("http")
async def add_context(request: Request, call_next):
    set_request_id(...)  # BEFORE call_next
    return await call_next(request)
```

### Issue: Health check endpoint returns 503

**Solution**: Check health check details:
```python
result = await health.check_all()
for check in result.checks:
    if not check.healthy:
        logger.error(f"{check.name} failed: {check.error}")
```

## Best Practices

1. **Configure once at startup** - Don't reconfigure logging on each request
2. **Use context managers** - Always use `MetricsContext` for HTTP endpoints
3. **Set context early** - Set request_id/user_id in middleware before processing
4. **Track important operations** - Database queries, LLM calls, cache operations
5. **Implement health checks** - For all external dependencies
6. **Use structured fields** - Log important data as fields, not in messages
7. **Monitor in production** - Set up Prometheus and alerts for key metrics

## Example Services

Real-world integration examples:

- [FastAPI Service](python/EXAMPLES.md#example-1-fastapi-service-with-full-observability)
- [Background Worker](python/EXAMPLES.md#example-2-background-worker-with-task-metrics)
- [Caching Service](python/EXAMPLES.md#example-3-schema-service-with-caching-metrics)
- [Testing](python/EXAMPLES.md#example-4-testing-with-observability)

See `shared/observability/python/EXAMPLES.md` for complete examples.

## Next Steps

1. **Choose integration path** (copy vs. shared import)
2. **Follow the checklist** above in order
3. **Test locally** with `log_format="console"` first
4. **Test with JSON** logs to verify structure
5. **Deploy to Kubernetes** with health/readiness probes
6. **Verify metrics** are being scraped by Prometheus
7. **Set up Grafana dashboards** for key metrics

## See Also

- [Module README](python/README.md) - Comprehensive API reference
- [Examples](python/EXAMPLES.md) - Real-world code samples
- [Overview](OVERVIEW.md) - High-level architecture
- [Prometheus Best Practices](https://prometheus.io/docs/practices/instrumentation/)
- [structlog Documentation](https://www.structlog.org/)
