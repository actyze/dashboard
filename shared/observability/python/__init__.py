"""Actyze Observability Module - Reusable logging, metrics, and health checks.

This module provides observability infrastructure for all Python services in Actyze,
including structured logging, Prometheus metrics, and health checks.

Submodules:
    structured_logging: Structured logging with context variables (request_id, user_id, etc.)
    metrics: Prometheus metrics collection (HTTP, queries, LLM, cache, database)
    health: Health checks and readiness probes for service dependencies

Quick Start:

    # In your service startup code:
    from observability.structured_logging import configure_logging, get_logger
    from observability.metrics import configure_metrics
    from observability.health import HealthChecker

    # Configure structured logging
    configure_logging(service_name="my-service", log_level="INFO", log_format="json")
    logger = get_logger(__name__)
    logger.info("service_started", service="my-service")

    # Configure metrics
    from prometheus_client import start_http_server
    start_http_server(8000)

    # Set up health checks
    checker = HealthChecker(service_name="my-service")
    await checker.add_check("postgres", check_postgres)
    await checker.startup()

Examples:
    See EXAMPLES.md for 6 real-world integration examples.
"""

# Mark version
__version__ = "1.0.0"

# Import and re-export structured logging
from structured_logging import (
    configure_logging,
    get_logger,
    set_context,
    clear_context,
    get_request_id,
    set_request_id,
    get_user_id,
    set_user_id,
    get_query_id,
    set_query_id,
    get_session_id,
    set_session_id,
    get_trace_id,
    set_trace_id,
    get_all_context,
)

# Import and re-export metrics
from metrics import (
    configure_metrics,
    get_metrics_registry,
    # HTTP metrics
    http_requests_total,
    http_request_duration_seconds,
    http_requests_in_progress,
    # Query metrics
    nl_queries_total,
    nl_queries_cached,
    sql_execution_duration_seconds,
    sql_rows_affected,
    sql_errors_total,
    # LLM metrics
    llm_calls_total,
    llm_tokens_used_total,
    llm_call_duration_seconds,
    llm_errors_total,
    # Cache metrics
    cache_hits_total,
    cache_misses_total,
    cache_size_bytes,
    # Database metrics
    db_connections_active,
    db_connections_idle,
    db_connection_pool_size,
    # Health metrics
    service_health_status,
    external_service_health_status,
    # Prediction metrics
    predictions_total,
    prediction_duration_seconds,
    predictions_failed_total,
    # Audit metrics
    audit_events_total,
)

# Import and re-export health checks
from health import (
    HealthChecker,
    HealthStatus,
    HealthCheckResult,
    check_http_endpoint,
    check_postgres,
    check_redis,
    check_trino,
)

# Define public API
__all__ = [
    # Logging
    "configure_logging",
    "get_logger",
    "set_context",
    "clear_context",
    "get_request_id",
    "set_request_id",
    "get_user_id",
    "set_user_id",
    "get_query_id",
    "set_query_id",
    "get_session_id",
    "set_session_id",
    "get_trace_id",
    "set_trace_id",
    "get_all_context",
    # Metrics
    "configure_metrics",
    "get_metrics_registry",
    "http_requests_total",
    "http_request_duration_seconds",
    "http_requests_in_progress",
    "nl_queries_total",
    "nl_queries_cached",
    "sql_execution_duration_seconds",
    "sql_rows_affected",
    "sql_errors_total",
    "llm_calls_total",
    "llm_tokens_used_total",
    "llm_call_duration_seconds",
    "llm_errors_total",
    "cache_hits_total",
    "cache_misses_total",
    "cache_size_bytes",
    "db_connections_active",
    "db_connections_idle",
    "db_connection_pool_size",
    "service_health_status",
    "external_service_health_status",
    "predictions_total",
    "prediction_duration_seconds",
    "predictions_failed_total",
    "audit_events_total",
    # Health
    "HealthChecker",
    "HealthStatus",
    "HealthCheckResult",
    "check_http_endpoint",
    "check_postgres",
    "check_redis",
    "check_trino",
]
