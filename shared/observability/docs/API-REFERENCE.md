# Observability API Reference

Complete API documentation for the shared observability module in `shared/observability/python/`.

## Table of Contents

- [Logging Module](#logging-module)
- [Metrics Module](#metrics-module)
- [Health Module](#health-module)
- [Configuration](#configuration)

---

## Logging Module

The logging module provides structured logging with context propagation.

### Functions

#### `configure_logging(service_name, log_level="INFO", log_format="json")`

Initialize structured logging for a service.

**Parameters:**
- `service_name` (str): Name of the service (e.g., "nexus", "schema-service")
- `log_level` (str): Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL). Default: INFO
- `log_format` (str): Output format ("json" or "text"). Default: json

**Returns:** None

**Example:**
```python
from observability.python import configure_logging

configure_logging(
    service_name="my-service",
    log_level="INFO",
    log_format="json"
)
```

#### `get_logger(name)`

Get a structlog logger instance for a module.

**Parameters:**
- `name` (str): Module name (typically `__name__`)

**Returns:** structlog.BoundLogger

**Example:**
```python
from observability.python import get_logger

logger = get_logger(__name__)
logger.info("application_started", version="1.0.0")
```

#### Context Variables

##### `set_request_id(request_id: str)` / `get_request_id() -> Optional[str]`

Set and retrieve the current request ID for distributed tracing.

**Example:**
```python
from observability.python import set_request_id, get_request_id
import uuid

request_id = str(uuid.uuid4())
set_request_id(request_id)
# Now all logs include this request_id automatically
```

##### `set_user_id(user_id: str)` / `get_user_id() -> Optional[str]`

Set and retrieve the current user ID for audit trails.

**Example:**
```python
from observability.python import set_user_id

set_user_id("user-42")
# All logs include user_id for this request
```

##### `set_query_id(query_id: str)` / `get_query_id() -> Optional[str]`

Set and retrieve the current query ID for query correlation.

**Example:**
```python
from observability.python import set_query_id

set_query_id("query-789")
# Correlate NL query with generated SQL and results
```

### Logging Examples

#### HTTP Request Logging

```python
from observability.python import get_logger, set_request_id
import uuid

logger = get_logger(__name__)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    set_request_id(request_id)
    
    logger.info(
        "http_request_received",
        method=request.method,
        path=request.url.path
    )
    
    response = await call_next(request)
    
    logger.info(
        "http_response_sent",
        method=request.method,
        path=request.url.path,
        status=response.status_code
    )
    
    return response
```

#### SQL Query Logging

```python
from observability.python import get_logger, get_query_id
import time

logger = get_logger(__name__)

async def execute_query(sql: str, catalog: str):
    query_id = get_query_id()
    start = time.time()
    
    try:
        result = await db.execute(sql)
        duration = time.time() - start
        
        logger.info(
            "sql_execution",
            query_id=query_id,
            catalog=catalog,
            row_count=len(result),
            duration_ms=duration * 1000
        )
        
        return result
    except Exception as e:
        duration = time.time() - start
        logger.error(
            "sql_error",
            query_id=query_id,
            catalog=catalog,
            error=str(e),
            error_type=type(e).__name__,
            duration_ms=duration * 1000
        )
        raise
```

#### LLM Integration Logging

```python
from observability.python import get_logger, set_request_id
import time

logger = get_logger(__name__)

async def call_llm(prompt: str, provider: str, model: str):
    start = time.time()
    
    try:
        response = await llm_client.generate(
            prompt=prompt,
            provider=provider,
            model=model
        )
        duration = time.time() - start
        
        logger.info(
            "llm_call_success",
            provider=provider,
            model=model,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            duration_ms=duration * 1000
        )
        
        return response
    except Exception as e:
        duration = time.time() - start
        logger.error(
            "llm_call_failed",
            provider=provider,
            model=model,
            error=str(e),
            duration_ms=duration * 1000
        )
        raise
```

---

## Metrics Module

The metrics module provides Prometheus-compatible metric instrumentation.

### Metric Types

#### Counter

Monotonically increasing counter for event counts.

```python
from observability.python.metrics import http_requests_total

# Increment by 1
http_requests_total.labels(
    method="POST",
    endpoint="/api/queries",
    status="200"
).inc()

# Increment by custom value
http_requests_total.labels(
    method="POST",
    endpoint="/api/queries",
    status="200"
).inc(5)
```

#### Histogram

Distribution of measurement values (latencies, sizes).

```python
from observability.python.metrics import http_request_duration_seconds

# Record latency
http_request_duration_seconds.labels(
    method="POST",
    endpoint="/api/queries"
).observe(0.145)  # 145 milliseconds
```

#### Gauge

Metric that can increase or decrease.

```python
from observability.python.metrics import http_requests_in_progress

# Increment
http_requests_in_progress.inc()

# Decrement
http_requests_in_progress.dec()

# Set specific value
http_requests_in_progress.set(42)
```

### Available Metrics

#### HTTP Request Metrics

```python
from observability.python.metrics import (
    http_requests_total,              # Counter
    http_request_duration_seconds,    # Histogram
    http_requests_in_progress         # Gauge
)

# HTTP request tracking
http_requests_total.labels(
    method="POST",
    endpoint="/api/queries",
    status="200"
).inc()

http_request_duration_seconds.labels(
    method="POST",
    endpoint="/api/queries"
).observe(duration_seconds)

http_requests_in_progress.inc()
# ... handle request ...
http_requests_in_progress.dec()
```

#### Query Execution Metrics

```python
from observability.python.metrics import (
    nl_queries_total,                 # Counter
    sql_execution_duration_seconds,   # Histogram
    sql_execution_errors_total,       # Counter
    sql_result_rows                   # Histogram
)

# Natural Language queries
nl_queries_total.labels(
    status="success",
    model="gpt-4"
).inc()

# SQL execution tracking
sql_execution_duration_seconds.labels(
    catalog="postgres"
).observe(execution_time)

sql_result_rows.labels(
    catalog="postgres"
).observe(row_count)

# Execution errors
sql_execution_errors_total.labels(
    catalog="postgres",
    error_type="timeout"
).inc()
```

#### LLM Integration Metrics

```python
from observability.python.metrics import (
    llm_calls_total,                  # Counter
    llm_tokens_total,                 # Counter
    llm_call_duration_seconds         # Histogram
)

# LLM API calls
llm_calls_total.labels(
    provider="openai",
    model="gpt-4",
    status="success"
).inc()

# Token consumption (input and output)
llm_tokens_total.labels(
    provider="openai",
    model="gpt-4",
    token_type="input"
).inc(234)

llm_tokens_total.labels(
    provider="openai",
    model="gpt-4",
    token_type="output"
).inc(145)

# LLM API latency
llm_call_duration_seconds.labels(
    provider="openai",
    model="gpt-4"
).observe(duration)
```

#### Cache Metrics

```python
from observability.python.metrics import (
    cache_hits_total,                 # Counter
    cache_misses_total,               # Counter
    cache_size_bytes                  # Gauge
)

# Cache hit
cache_hits_total.labels(cache_type="query").inc()

# Cache miss
cache_misses_total.labels(cache_type="query").inc()

# Cache size
cache_size_bytes.labels(cache_type="query").set(1048576)  # 1MB
```

#### Database Connection Metrics

```python
from observability.python.metrics import (
    db_connections_active,            # Gauge
    db_connections_idle               # Gauge
)

# Connection pool tracking
db_connections_active.set(42)
db_connections_idle.set(8)
```

#### Health Metrics

```python
from observability.python.metrics import service_health_status

# Service health (1 = healthy, 0 = unhealthy)
service_health_status.labels(service="postgres").set(1)
service_health_status.labels(service="redis").set(0)  # Unhealthy
```

#### Prediction Metrics

```python
from observability.python.metrics import (
    predictions_total,                # Counter
    prediction_duration_seconds       # Histogram
)

# Prediction generation
predictions_total.labels(
    pipeline_type="forecast",
    status="success"
).inc()

prediction_duration_seconds.labels(
    pipeline_type="forecast"
).observe(duration)
```

#### Audit Metrics

```python
from observability.python.metrics import audit_events_total

# Audit event tracking
audit_events_total.labels(event_type="nl_query_executed").inc()
audit_events_total.labels(event_type="data_exported").inc()
audit_events_total.labels(event_type="authentication").inc()
```

### MetricsContext Helper

Use the `MetricsContext` context manager for automatic HTTP metric tracking:

```python
from observability.python import MetricsContext

@app.get("/api/data")
async def get_data():
    with MetricsContext(method="GET", endpoint="/api/data") as ctx:
        try:
            data = await fetch_data()
            ctx.set_status(200)
            return data
        except Exception as e:
            ctx.set_status(500)
            raise
```

This automatically records:
- `http_requests_total` (with status code)
- `http_request_duration_seconds`
- `http_requests_in_progress` (incremented on entry, decremented on exit)

---

## Health Module

The health module provides service health checking and readiness probes.

### Classes

#### `HealthChecker`

Manages health checks for service dependencies.

**Methods:**

##### `register(name: str, check_fn: Callable[[], Awaitable[bool]])`

Register a health check function.

**Parameters:**
- `name` (str): Check name (e.g., "database", "redis")
- `check_fn` (async callable): Function returning True if healthy, False otherwise

**Example:**
```python
from observability.python import HealthChecker

health_checker = HealthChecker()

async def check_database():
    try:
        conn = await db.acquire()
        await conn.fetchval("SELECT 1")
        await conn.release()
        return True
    except Exception:
        return False

health_checker.register("database", check_database)
```

##### `async check_all() -> HealthCheckResult`

Run all registered health checks concurrently.

**Returns:** HealthCheckResult

**Example:**
```python
result = await health_checker.check_all()
print(result.healthy)  # True if all checks pass
print(result.to_dict())  # Dictionary with details
```

##### `async is_ready() -> bool`

Quick check if service is ready (all checks must pass).

**Returns:** bool

**Example:**
```python
if await health_checker.is_ready():
    return {"status": "ready"}, 200
else:
    return {"status": "not_ready"}, 503
```

#### `HealthCheckResult`

Result of health check execution.

**Attributes:**
- `healthy` (bool): True if all checks passed
- `checks` (dict): Individual check results
- `timestamp` (str): ISO 8601 timestamp

**Methods:**

##### `to_dict() -> dict`

Convert to JSON-serializable dictionary.

**Example:**
```python
result = await health_checker.check_all()
return result.to_dict(), 200 if result.healthy else 503
```

### Health Check Utility Functions

#### `check_http_endpoint(url: str, timeout: float = 5.0) -> bool`

Check if an HTTP endpoint is responding.

**Parameters:**
- `url` (str): Full URL to check
- `timeout` (float): Request timeout in seconds

**Example:**
```python
from observability.python import check_http_endpoint

async def check_schema_service():
    return await check_http_endpoint("http://schema-service:8001/healthz")

health_checker.register("schema-service", check_schema_service)
```

#### `check_database_connection(get_connection: Callable) -> bool`

Check database connectivity.

**Parameters:**
- `get_connection` (callable): Function returning database connection

**Example:**
```python
from observability.python import check_database_connection
import asyncpg

async def get_db():
    return await asyncpg.connect(
        host="postgres",
        user="actyze",
        password="password",
        database="actyze"
    )

health_checker.register("postgres", lambda: check_database_connection(get_db))
```

#### `check_redis_connection(redis_client) -> bool`

Check Redis connectivity.

**Parameters:**
- `redis_client` (redis.Redis or redis.AsyncRedis): Redis client instance

**Example:**
```python
from observability.python import check_redis_connection
import redis

redis_client = redis.asyncio.Redis(host="redis", port=6379)
health_checker.register("redis", lambda: check_redis_connection(redis_client))
```

### Complete Health Check Example

```python
from fastapi import FastAPI
from observability.python import (
    configure_logging,
    get_logger,
    HealthChecker,
    check_http_endpoint,
    MetricsContext
)
import asyncpg
import redis.asyncio

logger = get_logger(__name__)
app = FastAPI()
health_checker = HealthChecker()

# Database connection pool
db_pool = None

async def get_db():
    global db_pool
    return db_pool

@app.on_event("startup")
async def startup():
    configure_logging(service_name="my-service", log_level="INFO")
    
    # Setup database
    global db_pool
    db_pool = await asyncpg.create_pool(
        host="postgres",
        user="actyze",
        password="password",
        database="actyze",
        min_size=5,
        max_size=20
    )
    
    # Register health checks
    async def check_database():
        try:
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error("postgres_check_failed", error=str(e))
            return False
    
    async def check_trino():
        return await check_http_endpoint("http://trino:8080/v1/info")
    
    health_checker.register("database", check_database)
    health_checker.register("trino", check_trino)
    
    logger.info("service_started")

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()
    logger.info("service_stopped")

@app.get("/healthz")
async def liveness():
    """Liveness probe: is the process alive?"""
    return {"status": "alive", "service": "my-service"}

@app.get("/readyz")
async def readiness():
    """Readiness probe: is the service ready for traffic?"""
    result = await health_checker.check_all()
    status = 200 if result.healthy else 503
    return result.to_dict(), status

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/data")
async def get_data():
    """Example endpoint with metrics tracking"""
    with MetricsContext(method="GET", endpoint="/api/data") as ctx:
        try:
            async with db_pool.acquire() as conn:
                data = await conn.fetch("SELECT * FROM data LIMIT 10")
            ctx.set_status(200)
            return {"data": data}
        except Exception as e:
            ctx.set_status(500)
            logger.error("get_data_failed", error=str(e))
            raise
```

---

## Configuration

### Environment Variables

All configuration is via environment variables:

| Variable | Default | Values | Description |
|----------|---------|--------|-------------|
| `LOG_LEVEL` | INFO | DEBUG, INFO, WARNING, ERROR, CRITICAL | Logging level |
| `LOG_FORMAT` | json | json, text | Output format |
| `SERVICE_NAME` | actyze | string | Service identifier in logs |
| `PROMETHEUS_PORT` | 8002 | 1-65535 | Metrics endpoint port |

### Configuration Example

```python
import os
from observability.python import configure_logging

# Read from environment
log_level = os.getenv("LOG_LEVEL", "INFO")
log_format = os.getenv("LOG_FORMAT", "json")
service_name = os.getenv("SERVICE_NAME", "my-service")

# Configure at startup
configure_logging(
    service_name=service_name,
    log_level=log_level,
    log_format=log_format
)
```

---

## Integration with FastAPI

Complete example integrating all modules:

```python
from fastapi import FastAPI, Request
from fastapi.responses import Response
from contextlib import asynccontextmanager
import uuid

from observability.python import (
    configure_logging,
    get_logger,
    set_request_id,
    MetricsContext,
    HealthChecker,
    check_http_endpoint
)

logger = get_logger(__name__)
health_checker = HealthChecker()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_logging(service_name="my-service")
    health_checker.register("trino", lambda: check_http_endpoint("http://trino:8080"))
    logger.info("app_started")
    yield
    # Shutdown
    logger.info("app_shutdown")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def add_request_tracing(request: Request, call_next):
    request_id = str(uuid.uuid4())
    set_request_id(request_id)
    
    with MetricsContext(request.method, request.url.path) as ctx:
        try:
            response = await call_next(request)
            ctx.set_status(response.status_code)
            return response
        except Exception as e:
            ctx.set_status(500)
            logger.error("request_error", error=str(e))
            raise

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
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md) - Monitoring external services
- [KUBERNETES.md](KUBERNETES.md) - Kubernetes deployment
- [../python/README.md](../python/README.md) - Python module source code
