"""Actyze Observability Module - Reusable logging, metrics, and health checks.

This module provides observability infrastructure for all Python services in Actyze,
including structured logging, Prometheus metrics, and health checks.

Submodules:
    logging: Structured logging with context variables (request_id, user_id, etc.)
    metrics: Prometheus metrics collection (HTTP, queries, LLM, cache, database)
    health: Health checks and readiness probes for service dependencies

Quick Start:

    # In your service startup code:
    from observability.logging import configure_logging, get_logger
    from observability.metrics import configure_metrics
    from observability.health import HealthChecker

    # Configure structured logging
    configure_logging(service_name="my-service", log_level="INFO", log_format="json")
    logger = get_logger(__name__)

    # Configure metrics
    metrics_registry = configure_metrics()

    # Set up health checks
    health = HealthChecker()
    health.register("database", check_database_connection)

    # Use in your request handlers:
    from observability.logging import set_request_id, set_user_id
    from observability.metrics import MetricsContext, record_sql_execution

    # Track HTTP request
    with MetricsContext("GET", "/api/endpoint") as ctx:
        try:
            set_request_id("req-123")
            set_user_id("user-456")

            # Track SQL execution
            import time
            start = time.time()
            result = await execute_query(sql)
            record_sql_execution(time.time() - start, catalog="trino", row_count=len(result))

            ctx.set_status(200)
        except Exception as e:
            logger.error("request_failed", error=str(e))
            ctx.set_status(500)
            raise
"""

# Logging exports
from observability.logging import (
    configure_logging,
    get_logger,
    get_request_id,
    set_request_id,
    get_user_id,
    set_user_id,
    get_query_id,
    set_query_id,
    get_session_id,
    set_session_id,
)

# Metrics exports
from observability.metrics import (
    configure_metrics,
    metrics_registry,
    MetricsContext,
    record_nl_query,
    record_sql_execution,
    record_llm_call,
    record_cache_hit,
    record_cache_miss,
    set_cache_size,
    set_db_connections,
    set_service_health,
    record_prediction,
    record_prediction_duration,
    record_audit_event,
)

# Health exports
from observability.health import (
    HealthChecker,
    HealthStatus,
    HealthCheckResult,
    ReadinessChecker,
    check_http_endpoint,
    check_database_connection,
    check_redis_connection,
)

__all__ = [
    # Logging
    'configure_logging',
    'get_logger',
    'get_request_id',
    'set_request_id',
    'get_user_id',
    'set_user_id',
    'get_query_id',
    'set_query_id',
    'get_session_id',
    'set_session_id',
    # Metrics
    'configure_metrics',
    'metrics_registry',
    'MetricsContext',
    'record_nl_query',
    'record_sql_execution',
    'record_llm_call',
    'record_cache_hit',
    'record_cache_miss',
    'set_cache_size',
    'set_db_connections',
    'set_service_health',
    'record_prediction',
    'record_prediction_duration',
    'record_audit_event',
    # Health
    'HealthChecker',
    'HealthStatus',
    'HealthCheckResult',
    'ReadinessChecker',
    'check_http_endpoint',
    'check_database_connection',
    'check_redis_connection',
]

__version__ = '0.1.0'
