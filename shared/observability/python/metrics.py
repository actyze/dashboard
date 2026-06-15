"""Prometheus metrics and observability instrumentation for Actyze services.

This module provides reusable Prometheus metrics for tracking HTTP requests,
query execution, LLM calls, caching, and database connections.

Example:
    from observability.metrics import (
        configure_metrics,
        record_sql_execution,
        record_llm_call,
        MetricsContext
    )

    # Configure metrics once at startup
    registry = configure_metrics()

    # Track HTTP requests
    with MetricsContext("GET", "/api/queries") as ctx:
        # ... handle request
        ctx.set_status(200)

    # Track query execution
    import time
    start = time.time()
    try:
        # ... execute SQL
        record_sql_execution(time.time() - start, catalog="trino", row_count=100)
    except Exception as e:
        record_sql_execution(time.time() - start, catalog="trino", error=type(e).__name__)

    # Track LLM calls
    record_llm_call(
        provider="anthropic",
        model="claude-3-sonnet",
        duration=1.5,
        input_tokens=150,
        output_tokens=200
    )
"""

from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, REGISTRY
from typing import Optional
import time


# Create default registry
metrics_registry = REGISTRY


# ============================================================================
# HTTP Metrics
# ============================================================================

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status'],
    registry=metrics_registry
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=metrics_registry
)

http_requests_in_progress = Gauge(
    'http_requests_in_progress',
    'Number of HTTP requests currently being processed',
    registry=metrics_registry
)


# ============================================================================
# Query Execution Metrics
# ============================================================================

nl_queries_total = Counter(
    'nl_queries_total',
    'Total natural language queries processed',
    ['status', 'model'],
    registry=metrics_registry
)

sql_execution_duration_seconds = Histogram(
    'sql_execution_duration_seconds',
    'SQL query execution duration in seconds',
    ['catalog'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0),
    registry=metrics_registry
)

sql_execution_errors_total = Counter(
    'sql_execution_errors_total',
    'Total SQL execution errors',
    ['catalog', 'error_type'],
    registry=metrics_registry
)

sql_result_rows = Histogram(
    'sql_result_rows',
    'Number of rows returned from SQL queries',
    ['catalog'],
    buckets=(1, 10, 100, 1000, 10000),
    registry=metrics_registry
)


# ============================================================================
# LLM Metrics
# ============================================================================

llm_calls_total = Counter(
    'llm_calls_total',
    'Total LLM API calls',
    ['provider', 'model', 'status'],
    registry=metrics_registry
)

llm_tokens_total = Counter(
    'llm_tokens_total',
    'Total tokens consumed by LLM calls',
    ['provider', 'model', 'token_type'],
    registry=metrics_registry
)

llm_call_duration_seconds = Histogram(
    'llm_call_duration_seconds',
    'LLM API call duration in seconds',
    ['provider', 'model'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0),
    registry=metrics_registry
)


# ============================================================================
# Cache Metrics
# ============================================================================

cache_hits_total = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_type'],
    registry=metrics_registry
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_type'],
    registry=metrics_registry
)

cache_size_bytes = Gauge(
    'cache_size_bytes',
    'Current cache size in bytes',
    ['cache_type'],
    registry=metrics_registry
)


# ============================================================================
# Database Connection Metrics
# ============================================================================

db_connections_active = Gauge(
    'db_connections_active',
    'Number of active database connections',
    registry=metrics_registry
)

db_connections_idle = Gauge(
    'db_connections_idle',
    'Number of idle database connections',
    registry=metrics_registry
)


# ============================================================================
# Service Health Metrics
# ============================================================================

service_health_status = Gauge(
    'service_health_status',
    'Health status of external services (1=healthy, 0=unhealthy)',
    ['service'],
    registry=metrics_registry
)


# ============================================================================
# Prediction Metrics
# ============================================================================

predictions_total = Counter(
    'predictions_total',
    'Total predictions generated',
    ['pipeline_type', 'status'],
    registry=metrics_registry
)

prediction_duration_seconds = Histogram(
    'prediction_duration_seconds',
    'Prediction pipeline execution duration in seconds',
    ['pipeline_type'],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 300.0),
    registry=metrics_registry
)


# ============================================================================
# Audit Log Metrics
# ============================================================================

audit_events_total = Counter(
    'audit_events_total',
    'Total audit events logged',
    ['event_type'],
    registry=metrics_registry
)


# ============================================================================
# Context Manager for HTTP Metrics
# ============================================================================

class MetricsContext:
    """Context manager for tracking HTTP request metrics.

    Example:
        with MetricsContext("GET", "/api/queries") as ctx:
            try:
                response = handle_request()
                ctx.set_status(200)
            except Exception:
                ctx.set_status(500)
    """

    def __init__(self, method: str, endpoint: str):
        """Initialize metrics context.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint path.
        """
        self.method = method
        self.endpoint = endpoint
        self.start_time = None
        self.status = 500  # Default to error if not set

    def __enter__(self):
        """Enter context manager."""
        self.start_time = time.time()
        http_requests_in_progress.inc()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager and record metrics."""
        duration = time.time() - self.start_time
        http_request_duration_seconds.labels(
            method=self.method,
            endpoint=self.endpoint
        ).observe(duration)
        http_requests_total.labels(
            method=self.method,
            endpoint=self.endpoint,
            status=self.status
        ).inc()
        http_requests_in_progress.dec()

    def set_status(self, status: int) -> None:
        """Set HTTP response status code.

        Args:
            status: HTTP status code (200, 404, 500, etc.).
        """
        self.status = status


# ============================================================================
# Recording Functions
# ============================================================================

def configure_metrics(registry: Optional[CollectorRegistry] = None) -> CollectorRegistry:
    """Configure metrics registry (for future extensions).

    Args:
        registry: Optional custom Prometheus registry. Defaults to global REGISTRY.

    Returns:
        The configured registry.
    """
    return registry or metrics_registry


def record_nl_query(status: str = "success", model: str = "unknown") -> None:
    """Record a natural language query.

    Args:
        status: Query status ('success' or 'error').
        model: LLM model used for the query.
    """
    nl_queries_total.labels(status=status, model=model).inc()


def record_sql_execution(
    duration: float,
    catalog: str,
    error: Optional[str] = None,
    row_count: int = 0
) -> None:
    """Record SQL query execution.

    Args:
        duration: Query execution duration in seconds.
        catalog: Database catalog (e.g., 'trino', 'postgres').
        error: Optional error type if query failed.
        row_count: Number of rows returned.
    """
    sql_execution_duration_seconds.labels(catalog=catalog).observe(duration)
    if error:
        sql_execution_errors_total.labels(catalog=catalog, error_type=error).inc()
    if row_count > 0:
        sql_result_rows.labels(catalog=catalog).observe(row_count)


def record_llm_call(
    provider: str,
    model: str,
    status: str = "success",
    duration: float = 0,
    input_tokens: int = 0,
    output_tokens: int = 0
) -> None:
    """Record an LLM API call.

    Args:
        provider: LLM provider (e.g., 'anthropic', 'openai', 'google').
        model: Model name (e.g., 'claude-3-sonnet').
        status: Call status ('success' or 'error').
        duration: Call duration in seconds.
        input_tokens: Number of input tokens consumed.
        output_tokens: Number of output tokens generated.
    """
    llm_calls_total.labels(provider=provider, model=model, status=status).inc()
    if duration > 0:
        llm_call_duration_seconds.labels(provider=provider, model=model).observe(duration)
    if input_tokens > 0:
        llm_tokens_total.labels(provider=provider, model=model, token_type="input").inc(input_tokens)
    if output_tokens > 0:
        llm_tokens_total.labels(provider=provider, model=model, token_type="output").inc(output_tokens)


def record_cache_hit(cache_type: str) -> None:
    """Record a cache hit.

    Args:
        cache_type: Type of cache (e.g., 'query', 'schema', 'embedding').
    """
    cache_hits_total.labels(cache_type=cache_type).inc()


def record_cache_miss(cache_type: str) -> None:
    """Record a cache miss.

    Args:
        cache_type: Type of cache (e.g., 'query', 'schema', 'embedding').
    """
    cache_misses_total.labels(cache_type=cache_type).inc()


def set_cache_size(cache_type: str, size_bytes: int) -> None:
    """Set current cache size.

    Args:
        cache_type: Type of cache (e.g., 'query', 'schema', 'embedding').
        size_bytes: Cache size in bytes.
    """
    cache_size_bytes.labels(cache_type=cache_type).set(size_bytes)


def set_db_connections(active: int, idle: int) -> None:
    """Set database connection counts.

    Args:
        active: Number of active connections.
        idle: Number of idle connections.
    """
    db_connections_active.set(active)
    db_connections_idle.set(idle)


def set_service_health(service: str, healthy: bool) -> None:
    """Set health status of a service.

    Args:
        service: Service name (e.g., 'trino', 'postgres', 'redis').
        healthy: Whether the service is healthy.
    """
    service_health_status.labels(service=service).set(1 if healthy else 0)


def record_prediction(pipeline_type: str, status: str = "success") -> None:
    """Record a prediction.

    Args:
        pipeline_type: Type of prediction pipeline (e.g., 'xgboost', 'lightgbm').
        status: Prediction status ('success' or 'error').
    """
    predictions_total.labels(pipeline_type=pipeline_type, status=status).inc()


def record_prediction_duration(pipeline_type: str, duration: float) -> None:
    """Record prediction execution duration.

    Args:
        pipeline_type: Type of prediction pipeline (e.g., 'xgboost', 'lightgbm').
        duration: Execution duration in seconds.
    """
    prediction_duration_seconds.labels(pipeline_type=pipeline_type).observe(duration)


def record_audit_event(event_type: str) -> None:
    """Record an audit event.

    Args:
        event_type: Type of audit event (e.g., 'query_executed', 'schema_changed').
    """
    audit_events_total.labels(event_type=event_type).inc()
