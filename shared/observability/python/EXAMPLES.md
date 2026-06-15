# Observability Module Examples

Real-world examples of using the Actyze observability module in different service contexts.

## Example 1: FastAPI Service with Full Observability

```python
"""Nexus API service with observability."""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uuid
import time

from observability import (
    configure_logging,
    get_logger,
    set_request_id,
    set_user_id,
    MetricsContext,
    HealthChecker,
    check_http_endpoint,
    record_sql_execution,
)

logger = get_logger(__name__)

# Initialize health checker
health = HealthChecker()

async def check_trino():
    return await check_http_endpoint("http://trino:8080/ui/")

async def check_postgres():
    from observability import check_database_connection
    return await check_database_connection(get_db_connection)

health.register("trino", check_trino)
health.register("postgres", check_postgres)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Service startup and shutdown."""
    # Startup
    configure_logging(service_name="nexus", log_level="INFO", log_format="json")
    logger.info("service_starting", version="0.1.0")
    
    yield
    
    # Shutdown
    logger.info("service_stopping")

app = FastAPI(title="Nexus API", lifespan=lifespan)

@app.middleware("http")
async def add_request_context(request: Request, call_next):
    """Add request_id and user_id to context before processing."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    
    # Extract user from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        set_user_id(token[:16])  # First 16 chars of token
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

@app.get("/api/queries")
async def list_queries(limit: int = 100):
    """List available queries."""
    with MetricsContext("GET", "/api/queries") as ctx:
        try:
            logger.info("fetching_queries", limit=limit)
            
            # Track database operation
            start = time.time()
            queries = await db.fetch(
                "SELECT id, name, created_at FROM queries LIMIT $1",
                limit
            )
            duration = time.time() - start
            
            record_sql_execution(
                duration=duration,
                catalog="postgres",
                row_count=len(queries)
            )
            
            ctx.set_status(200)
            logger.info("queries_fetched", count=len(queries))
            return {"queries": queries}
            
        except Exception as e:
            logger.error("query_fetch_failed", error=str(e), error_type=type(e).__name__)
            ctx.set_status(500)
            raise

@app.post("/api/queries/execute")
async def execute_nl_query(request: dict):
    """Execute a natural language query."""
    from observability import record_nl_query, record_llm_call
    
    with MetricsContext("POST", "/api/queries/execute") as ctx:
        try:
            query_text = request.get("query")
            logger.info("nl_query_received", query_text=query_text[:100])
            
            # Track LLM call
            start = time.time()
            try:
                response = await llm.complete(
                    model="claude-3-sonnet",
                    messages=[{"role": "user", "content": query_text}]
                )
                duration = time.time() - start
                
                record_llm_call(
                    provider="anthropic",
                    model="claude-3-sonnet",
                    duration=duration,
                    input_tokens=response.usage.input_tokens,
                    output_tokens=response.usage.output_tokens
                )
                record_nl_query(status="success", model="claude-3-sonnet")
                
                sql = response.content
                logger.info("sql_generated", sql=sql[:200])
                
                # Execute generated SQL
                start = time.time()
                result = await execute_sql(sql, catalog="trino")
                duration = time.time() - start
                
                record_sql_execution(
                    duration=duration,
                    catalog="trino",
                    row_count=len(result)
                )
                
                ctx.set_status(200)
                return {"result": result}
                
            except Exception as llm_error:
                record_nl_query(status="error", model="claude-3-sonnet")
                raise
                
        except Exception as e:
            logger.error("nl_query_failed", error=str(e))
            ctx.set_status(500)
            raise

@app.get("/health")
async def health_check():
    """Kubernetes liveness probe."""
    result = await health.check_all()
    
    if result.healthy:
        return {"status": "healthy"}
    else:
        logger.warning("health_check_failed", checks=[
            c.to_dict() for c in result.checks if not c.healthy
        ])
        return JSONResponse(
            {"status": "unhealthy", "checks": [c.to_dict() for c in result.checks]},
            status_code=503
        )

@app.get("/ready")
async def readiness_probe():
    """Kubernetes readiness probe."""
    # Check if schema is loaded (required for queries)
    if not schema_loaded():
        return JSONResponse(
            {"ready": False, "reason": "schema_loading"},
            status_code=503
        )
    return {"ready": True}

@app.get("/metrics")
async def metrics_endpoint():
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return JSONResponse(
        content=generate_latest().decode(),
        media_type=CONTENT_TYPE_LATEST
    )
```

## Example 2: Background Worker with Task Metrics

```python
"""Prediction worker service (XGBoost, LightGBM, etc.)."""

import asyncio
import time
from observability import (
    configure_logging,
    get_logger,
    set_request_id,
    record_prediction,
    record_prediction_duration,
    MetricsContext,
)

logger = get_logger(__name__)

async def run_prediction_pipeline(job_id: str, pipeline_type: str):
    """Run prediction pipeline and track metrics."""
    set_request_id(job_id)
    
    with MetricsContext("INTERNAL", f"/pipelines/{pipeline_type}") as ctx:
        try:
            logger.info("pipeline_started", pipeline_type=pipeline_type)
            
            start = time.time()
            
            # Load data
            logger.info("loading_data")
            data = await load_training_data()
            
            # Train model
            logger.info("training_model", samples=len(data))
            model = await train_model(data, pipeline_type=pipeline_type)
            
            # Generate predictions
            logger.info("generating_predictions", test_samples=1000)
            predictions = model.predict(test_data)
            
            duration = time.time() - start
            
            # Record metrics
            record_prediction(pipeline_type=pipeline_type, status="success")
            record_prediction_duration(pipeline_type=pipeline_type, duration=duration)
            
            logger.info(
                "pipeline_completed",
                pipeline_type=pipeline_type,
                duration_ms=duration * 1000,
                predictions_count=len(predictions)
            )
            
            ctx.set_status(200)
            return predictions
            
        except Exception as e:
            duration = time.time() - start
            record_prediction(pipeline_type=pipeline_type, status="error")
            logger.error(
                "pipeline_failed",
                pipeline_type=pipeline_type,
                error=str(e),
                duration_ms=duration * 1000
            )
            ctx.set_status(500)
            raise

async def main():
    """Worker main loop."""
    configure_logging(
        service_name="prediction-worker",
        log_level="INFO",
        log_format="json"
    )
    logger.info("worker_started")
    
    while True:
        try:
            # Get job from queue
            job = await get_next_job()
            if not job:
                await asyncio.sleep(1)
                continue
            
            # Run prediction
            await run_prediction_pipeline(job.id, job.pipeline_type)
            await mark_job_complete(job.id)
            
        except Exception as e:
            logger.error("worker_error", error=str(e))
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
```

## Example 3: Schema Service with Caching Metrics

```python
"""Schema service with table discovery and caching."""

import hashlib
import sys
from observability import (
    configure_logging,
    get_logger,
    record_cache_hit,
    record_cache_miss,
    set_cache_size,
)

logger = get_logger(__name__)

class SchemaCache:
    """In-memory schema cache with observability."""
    
    def __init__(self):
        self.cache = {}
    
    def get_schema(self, catalog: str, schema: str):
        """Get schema from cache or load it."""
        cache_key = f"{catalog}.{schema}"
        
        # Check cache
        if cache_key in self.cache:
            record_cache_hit("schema_cache")
            logger.info("schema_cache_hit", cache_key=cache_key)
            return self.cache[cache_key]
        
        # Cache miss - load from source
        record_cache_miss("schema_cache")
        logger.info("schema_cache_miss", cache_key=cache_key)
        
        schema_info = self._load_schema(catalog, schema)
        self.cache[cache_key] = schema_info
        
        # Update cache size metric
        cache_size = sum(sys.getsizeof(v) for v in self.cache.values())
        set_cache_size("schema_cache", cache_size)
        
        logger.info(
            "schema_loaded",
            cache_key=cache_key,
            table_count=len(schema_info.tables),
            cache_size_bytes=cache_size
        )
        
        return schema_info
    
    def clear_cache(self):
        """Clear cache and log."""
        self.cache.clear()
        set_cache_size("schema_cache", 0)
        logger.info("schema_cache_cleared")

def main():
    configure_logging("schema-service", log_level="INFO", log_format="json")
    logger.info("service_started")
    
    cache = SchemaCache()
    
    # Simulate schema lookups
    for i in range(100):
        schema = cache.get_schema("trino", "default")
        if i % 10 == 0:
            logger.info("schema_lookups", total=i)
    
    logger.info("service_stopped")
```

## Example 4: Testing with Observability

```python
"""Unit tests with observability."""

import pytest
from observability import (
    configure_logging,
    get_logger,
    MetricsContext,
    HealthChecker,
    HealthStatus,
)

@pytest.fixture(autouse=True)
def configure_test_logging():
    """Configure logging for tests."""
    configure_logging("test-service", log_level="DEBUG", log_format="console")

def test_metrics_context():
    """Test HTTP metrics tracking."""
    with MetricsContext("GET", "/test") as ctx:
        ctx.set_status(200)
    # Metrics recorded to Prometheus registry

def test_metrics_context_error():
    """Test error status tracking."""
    with MetricsContext("POST", "/test") as ctx:
        ctx.set_status(500)
    # Error metrics recorded

@pytest.mark.asyncio
async def test_health_checker():
    """Test health checker."""
    health = HealthChecker()
    
    async def mock_check():
        return HealthStatus(name="mock", healthy=True)
    
    health.register("mock_service", mock_check)
    result = await health.check_all()
    
    assert result.healthy
    assert len(result.checks) == 1
    assert result.checks[0].name == "mock_service"
    assert result.checks[0].latency_ms is not None

@pytest.mark.asyncio
async def test_health_checker_failure():
    """Test health checker with failing check."""
    health = HealthChecker()
    
    async def failing_check():
        raise Exception("Service unavailable")
    
    health.register("failing_service", failing_check)
    result = await health.check_all()
    
    assert not result.healthy
    assert result.checks[0].healthy == False
    assert "unavailable" in result.checks[0].error

def test_logger_context():
    """Test logger with context variables."""
    from observability import set_request_id, set_user_id
    
    logger = get_logger(__name__)
    
    set_request_id("test-123")
    set_user_id("user-456")
    
    # Log includes context automatically
    logger.info("test_event", data="test")
    # Log output includes request_id and user_id
```

## Example 5: Async Database Connection Pool

```python
"""Database pool with connection monitoring."""

from observability import set_db_connections

class DatabasePool:
    """Connection pool with observability."""
    
    def __init__(self, min_size: int = 5, max_size: int = 20):
        self.min_size = min_size
        self.max_size = max_size
        self.active = 0
        self.idle = 0
    
    async def get_connection(self):
        """Get connection and update metrics."""
        conn = await self._get_or_create_connection()
        self.active += 1
        self.idle -= 1
        self._update_metrics()
        return conn
    
    async def release_connection(self, conn):
        """Release connection and update metrics."""
        await conn.close()
        self.active -= 1
        self.idle += 1
        self._update_metrics()
    
    def _update_metrics(self):
        """Update Prometheus metrics."""
        set_db_connections(active=self.active, idle=self.idle)
```

## Example 6: LLM Provider Integration

```python
"""LLM provider with token and latency tracking."""

import time
from observability import record_llm_call, get_logger

logger = get_logger(__name__)

async def generate_sql_with_llm(query: str, provider: str = "anthropic"):
    """Generate SQL from natural language query."""
    
    start = time.time()
    try:
        response = await llm_client.complete(
            model="claude-3-sonnet",
            messages=[{"role": "user", "content": query}],
            max_tokens=1000
        )
        
        duration = time.time() - start
        
        # Record metrics
        record_llm_call(
            provider=provider,
            model="claude-3-sonnet",
            duration=duration,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens
        )
        
        logger.info(
            "sql_generated",
            provider=provider,
            model="claude-3-sonnet",
            duration_ms=duration * 1000,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens
        )
        
        return response.content
        
    except Exception as e:
        duration = time.time() - start
        record_llm_call(
            provider=provider,
            model="claude-3-sonnet",
            status="error",
            duration=duration
        )
        logger.error("sql_generation_failed", error=str(e))
        raise
```

## Running the Examples

1. **Ensure dependencies are installed**:
   ```bash
   pip install -r shared/observability/python/requirements.txt
   ```

2. **Set Python path** (if using shared module):
   ```bash
   export PYTHONPATH=/path/to/dashboard:/path/to/dashboard/shared:$PYTHONPATH
   ```

3. **Run service**:
   ```bash
   python example_service.py
   ```

4. **View logs** (JSON format):
   ```bash
   tail -f logs/service.log | jq '.'
   ```

5. **Scrape metrics**:
   ```bash
   curl http://localhost:8000/metrics
   ```
