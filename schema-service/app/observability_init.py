"""Observability initialization for Schema Service.

This module initializes shared observability infrastructure (logging, metrics, health checks)
from the shared observability module.

It's imported once at service startup to configure:
- Structured logging with context variables
- Prometheus metrics collection
- Health check endpoints
- Request tracing and timing
"""

import sys
import time
from pathlib import Path
from typing import Optional

# Add parent directory to path to import from shared observability
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from shared.observability import (
    configure_logging,
    get_logger,
    configure_metrics,
    HealthChecker,
    HealthStatus,
)


logger = get_logger(__name__)


def setup_observability(service_name: str = "schema-service") -> dict:
    """Initialize observability for the Schema Service.

    Configures:
    - Structured logging with service name
    - Prometheus metrics registry
    - Health checker with Trino dependency

    Args:
        service_name: Name of the service for logging context.

    Returns:
        Dictionary with initialized observability components:
        - 'logger': Configured logger instance
        - 'metrics_registry': Prometheus registry
        - 'health': HealthChecker instance
    """
    # Configure structured logging
    configure_logging(service_name=service_name, log_level="INFO", log_format="json")

    # Configure Prometheus metrics
    metrics_registry = configure_metrics()

    # Set up health checker
    health = HealthChecker()

    # Register Trino health check
    async def check_trino(trino_service=None):
        """Check if Trino is accessible."""
        if trino_service is None:
            return HealthStatus(
                name="trino",
                healthy=False,
                error="Trino service not provided"
            )

        try:
            import time
            start = time.time()
            # Test Trino connectivity
            is_healthy = await trino_service.check_connection()
            latency_ms = (time.time() - start) * 1000

            return HealthStatus(
                name="trino",
                healthy=is_healthy,
                latency_ms=latency_ms,
                error=None if is_healthy else "Trino connection check failed"
            )
        except Exception as e:
            return HealthStatus(
                name="trino",
                healthy=False,
                error=f"Trino health check failed: {str(e)}"
            )

    # Note: Trino health check will be registered after schema_service is initialized
    # See schema_service.py initialization

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
    """Add health check endpoints to FastAPI app.

    Adds:
    - GET /health - Basic health status
    - GET /ready - Readiness probe
    - GET /metrics - Prometheus metrics

    Args:
        app: FastAPI application instance.
        service_name: Name of the service.
    """
    from shared.observability import metrics_registry
    from prometheus_client.exposition import generate_latest

    @app.get("/health", tags=["observability"])
    async def health_check():
        """Liveness probe - service is running."""
        return {
            "status": "healthy",
            "service": service_name,
            "timestamp": time.time()
        }

    @app.get("/ready", tags=["observability"])
    async def readiness_check():
        """Readiness probe - service is ready to handle requests."""
        # Add custom readiness logic here
        return {
            "ready": True,
            "service": service_name,
            "timestamp": time.time()
        }

    @app.get("/metrics", tags=["observability"])
    async def metrics():
        """Prometheus metrics endpoint."""
        metrics_data = generate_latest(metrics_registry)
        return metrics_data

    logger.info("health_endpoints_added", service=service_name)
