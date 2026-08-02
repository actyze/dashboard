"""Initialize observability for prediction-worker-autogluon."""

import sys
import time
from pathlib import Path
import importlib.util

# Import shared modules
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
sys.path.insert(0, str(shared_obs_path))

structured_logging_spec = importlib.util.spec_from_file_location("obs_structured_logging", shared_obs_path / "structured_logging.py")
obs_structured_logging = importlib.util.module_from_spec(structured_logging_spec)
structured_logging_spec.loader.exec_module(obs_structured_logging)

metrics_spec = importlib.util.spec_from_file_location("obs_metrics", shared_obs_path / "metrics.py")
obs_metrics = importlib.util.module_from_spec(metrics_spec)
metrics_spec.loader.exec_module(obs_metrics)

health_spec = importlib.util.spec_from_file_location("obs_health", shared_obs_path / "health.py")
obs_health = importlib.util.module_from_spec(health_spec)
health_spec.loader.exec_module(obs_health)


def configure_observability(service_name: str = "prediction-worker-autogluon", log_level: str = "INFO"):
    """Configure all observability components for prediction worker."""
    
    # Configure structured logging
    obs_structured_logging.configure_logging(
        service_name=service_name,
        log_level=log_level,
        log_format="json"
    )
    
    # Configure Prometheus metrics
    obs_metrics.configure_metrics()
    
    return obs_structured_logging, obs_metrics, obs_health

# Re-export the names main.py imports. Without these the module exposes only
# configure_observability, and `from observability_init import configure_logging`
# raises ImportError at startup — which is what has been crash-looping the
# prediction workers. schema-service/app/observability_init.py does the same.
configure_logging = obs_structured_logging.configure_logging
get_logger = obs_structured_logging.get_logger
configure_metrics = obs_metrics.configure_metrics
MetricsContext = obs_metrics.MetricsContext
record_prediction = obs_metrics.record_prediction
record_prediction_duration = obs_metrics.record_prediction_duration

logger = get_logger(__name__)


def setup_health_endpoints(app, service_name: str = "prediction-worker-autogluon") -> None:
    """Add liveness, readiness and metrics endpoints to the FastAPI app."""
    from fastapi import Response
    from prometheus_client import CONTENT_TYPE_LATEST
    from prometheus_client.exposition import generate_latest

    @app.get("/health", tags=["observability"])
    async def health_check():
        """Liveness probe."""
        return {
            "status": "healthy",
            "service": service_name,
            "timestamp": time.time(),
        }

    @app.get("/ready", tags=["observability"])
    async def readiness_check():
        """Readiness probe."""
        return {
            "ready": True,
            "service": service_name,
            "timestamp": time.time(),
        }

    @app.get("/metrics", tags=["observability"])
    async def metrics():
        """Prometheus metrics endpoint."""
        # `metrics_registry` is the module-level Prometheus REGISTRY.
        # There is no get_metrics_registry() accessor in the shared library.
        return Response(
            generate_latest(obs_metrics.metrics_registry),
            media_type=CONTENT_TYPE_LATEST,
        )

    logger.info("health_endpoints_added", service=service_name)
