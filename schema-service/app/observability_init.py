"""Observability initialization for Schema Service."""

import sys
import time
from pathlib import Path
from typing import Optional
import importlib.util

# Import shared observability modules using importlib to avoid path issues
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
sys.path.insert(0, str(shared_obs_path))

# Import structured_logging
structured_logging_spec = importlib.util.spec_from_file_location(
    "obs_structured_logging", 
    shared_obs_path / "structured_logging.py"
)
obs_structured_logging = importlib.util.module_from_spec(structured_logging_spec)
structured_logging_spec.loader.exec_module(obs_structured_logging)

# Import metrics
metrics_spec = importlib.util.spec_from_file_location(
    "obs_metrics",
    shared_obs_path / "metrics.py"
)
obs_metrics = importlib.util.module_from_spec(metrics_spec)
metrics_spec.loader.exec_module(obs_metrics)

# Import health
health_spec = importlib.util.spec_from_file_location(
    "obs_health",
    shared_obs_path / "health.py"
)
obs_health = importlib.util.module_from_spec(health_spec)
health_spec.loader.exec_module(obs_health)

configure_logging = obs_structured_logging.configure_logging
get_logger = obs_structured_logging.get_logger
configure_metrics = obs_metrics.configure_metrics
HealthChecker = obs_health.HealthChecker
HealthStatus = obs_health.HealthStatus

# Re-export metrics helpers used directly by schema_service.py
MetricsContext = obs_metrics.MetricsContext
record_sql_execution = obs_metrics.record_sql_execution
set_service_health = obs_metrics.set_service_health

logger = get_logger(__name__)


def setup_observability(service_name: str = "schema-service") -> dict:
    """Initialize observability for Schema Service."""
    configure_logging(service_name=service_name, log_level="INFO", log_format="json")
    metrics_registry = configure_metrics()
    health = HealthChecker()

    logger.info(
        "observability_initialized",
        service=service_name,
        logging="structlog",
        metrics="prometheus",
        health_checks="enabled"
    )

    return {
        'logger': logger,
        'metrics_registry': metrics_registry,
        'health': health,
    }


def setup_health_endpoints(app, service_name: str = "schema-service") -> None:
    """Add health check endpoints to FastAPI app."""
    from prometheus_client.exposition import generate_latest

    @app.get("/health", tags=["observability"])
    async def health_check():
        """Liveness probe."""
        return {
            "status": "healthy",
            "service": service_name,
            "timestamp": time.time()
        }

    @app.get("/ready", tags=["observability"])
    async def readiness_check():
        """Readiness probe."""
        return {
            "ready": True,
            "service": service_name,
            "timestamp": time.time()
        }

    @app.get("/metrics", tags=["observability"])
    async def metrics():
        """Prometheus metrics endpoint."""
        metrics_registry = obs_metrics.get_metrics_registry()
        metrics_data = generate_latest(metrics_registry)
        return metrics_data

    logger.info("health_endpoints_added", service=service_name)
