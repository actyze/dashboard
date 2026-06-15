# SPDX-License-Identifier: AGPL-3.0-only
"""Observability initialization for prediction workers.

Imports shared observability modules and configures logging, metrics, and health checks.
"""

import sys
import os

# Add parent directories to Python path to allow importing from shared/observability
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))

from observability.logging import configure_logging, get_logger
from observability.metrics import configure_metrics, metrics_registry
from observability.health import HealthChecker, HealthStatus
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

__all__ = [
    'configure_logging',
    'get_logger',
    'configure_metrics',
    'metrics_registry',
    'HealthChecker',
    'HealthStatus',
    'generate_latest',
    'CONTENT_TYPE_LATEST',
    'setup_health_endpoints',
]


def setup_health_endpoints(app, service_name: str):
    """Set up health check and readiness endpoints for FastAPI app.

    Args:
        app: FastAPI application instance.
        service_name: Name of the service for logging.

    Configures:
        - GET /health: Liveness probe (always returns healthy if service is running)
        - GET /ready: Readiness probe (checks dependencies)
        - GET /metrics: Prometheus metrics endpoint
    """
    import asyncio
    from config import get_postgres_config, get_trino_config

    logger = get_logger(__name__)

    async def check_postgres():
        """Check PostgreSQL connectivity."""
        try:
            import psycopg2
            config = get_postgres_config()
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['user'],
                password=config['password'],
                connect_timeout=5
            )
            conn.close()
            return HealthStatus(name="postgres", healthy=True)
        except Exception as e:
            logger.warning("postgres_health_check_failed", error=str(e))
            return HealthStatus(name="postgres", healthy=False, error=str(e))

    async def check_trino():
        """Check Trino connectivity."""
        try:
            import trino
            config = get_trino_config()
            conn = trino.dbapi.connect(
                host=config['host'],
                port=config['port'],
                user=config['user'],
                password=config['password'] or None,
                catalog=config['catalog'],
                schema=config['schema'],
                http_scheme='https' if config['ssl'] else 'http',
            )
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return HealthStatus(name="trino", healthy=True)
        except Exception as e:
            logger.warning("trino_health_check_failed", error=str(e))
            return HealthStatus(name="trino", healthy=False, error=str(e))

    # Create health checker
    health_checker = HealthChecker()
    health_checker.register("postgres", check_postgres)
    health_checker.register("trino", check_trino)

    @app.get("/health")
    async def liveness():
        """Liveness probe — service is alive and running."""
        return {
            "status": "alive",
            "service": service_name,
        }

    @app.get("/ready")
    async def readiness():
        """Readiness probe — check if dependencies are available."""
        result = await health_checker.check_all()
        return {
            "ready": result.healthy,
            "service": service_name,
            "checks": [check.to_dict() for check in result.checks],
            "timestamp": result.timestamp,
        }

    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint."""
        from fastapi.responses import Response
        return Response(content=generate_latest(metrics_registry), media_type=CONTENT_TYPE_LATEST)

    logger.info("health_endpoints_configured", service_name=service_name)
    return health_checker
