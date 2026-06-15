"""Prometheus metrics and observability instrumentation - wrapper around shared library.

This module re-exports metrics from the shared observability library,
ensuring consistent metrics across all Actyze services.
"""

import sys
from pathlib import Path
import importlib.util

# Add shared observability/python directory to path
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
if str(shared_obs_path) not in sys.path:
    sys.path.insert(0, str(shared_obs_path))

# Import shared metrics module explicitly to avoid naming conflicts
metrics_spec = importlib.util.spec_from_file_location("obs_metrics", shared_obs_path / "metrics.py")
obs_metrics = importlib.util.module_from_spec(metrics_spec)
metrics_spec.loader.exec_module(obs_metrics)

# Re-export all metrics from shared library
configure_metrics = obs_metrics.configure_metrics
metrics_registry = obs_metrics.metrics_registry

# HTTP Metrics
http_requests_total = obs_metrics.http_requests_total
http_request_duration_seconds = obs_metrics.http_request_duration_seconds
http_requests_in_progress = obs_metrics.http_requests_in_progress

# Query Execution Metrics
nl_queries_total = obs_metrics.nl_queries_total
sql_execution_duration_seconds = obs_metrics.sql_execution_duration_seconds
sql_execution_errors_total = obs_metrics.sql_execution_errors_total
sql_result_rows = obs_metrics.sql_result_rows

# LLM Metrics
llm_calls_total = obs_metrics.llm_calls_total
llm_tokens_total = obs_metrics.llm_tokens_total
llm_call_duration_seconds = obs_metrics.llm_call_duration_seconds

# Cache Metrics
cache_hits_total = obs_metrics.cache_hits_total
cache_misses_total = obs_metrics.cache_misses_total
cache_size_bytes = obs_metrics.cache_size_bytes

# Database Metrics
db_connections_active = obs_metrics.db_connections_active
db_connections_idle = obs_metrics.db_connections_idle

# Service Health Metrics
service_health_status = obs_metrics.service_health_status

# Prediction Metrics
predictions_total = obs_metrics.predictions_total
prediction_duration_seconds = obs_metrics.prediction_duration_seconds

# Audit Metrics
audit_events_total = obs_metrics.audit_events_total

# Context Manager
MetricsContext = obs_metrics.MetricsContext

# Recording Functions
record_nl_query = obs_metrics.record_nl_query
record_sql_execution = obs_metrics.record_sql_execution
record_llm_call = obs_metrics.record_llm_call
record_cache_hit = obs_metrics.record_cache_hit
record_cache_miss = obs_metrics.record_cache_miss
set_cache_size = obs_metrics.set_cache_size
set_db_connections = obs_metrics.set_db_connections
set_service_health = obs_metrics.set_service_health
record_prediction = obs_metrics.record_prediction
record_prediction_duration = obs_metrics.record_prediction_duration
record_audit_event = obs_metrics.record_audit_event

__all__ = [
    # Configuration
    'configure_metrics',
    'metrics_registry',
    # HTTP Metrics
    'http_requests_total',
    'http_request_duration_seconds',
    'http_requests_in_progress',
    # Query Execution Metrics
    'nl_queries_total',
    'sql_execution_duration_seconds',
    'sql_execution_errors_total',
    'sql_result_rows',
    # LLM Metrics
    'llm_calls_total',
    'llm_tokens_total',
    'llm_call_duration_seconds',
    # Cache Metrics
    'cache_hits_total',
    'cache_misses_total',
    'cache_size_bytes',
    # Database Metrics
    'db_connections_active',
    'db_connections_idle',
    # Service Health Metrics
    'service_health_status',
    # Prediction Metrics
    'predictions_total',
    'prediction_duration_seconds',
    # Audit Metrics
    'audit_events_total',
    # Context Manager
    'MetricsContext',
    # Recording Functions
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
]
