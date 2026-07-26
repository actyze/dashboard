"""Health check and readiness probe utilities for Actyze services.

This module provides reusable health check and readiness probe functionality
for monitoring service dependencies (database, cache, external APIs, etc.).

Example:
    from observability.health import HealthChecker, HealthStatus

    # Create health checker
    health = HealthChecker()

    # Register dependency checks
    async def check_database():
        try:
            # ... check database connection
            return HealthStatus(name="database", healthy=True)
        except Exception as e:
            return HealthStatus(name="database", healthy=False, error=str(e))

    health.register("database", check_database)

    # Perform full health check
    result = await health.check_all()
    if result.healthy:
        # All dependencies are healthy
        pass
    else:
        # Some dependencies are unhealthy
        for check in result.checks:
            if not check.healthy:
                print(f"{check.name}: {check.error}")
"""

from typing import Callable, Dict, Optional, List
from dataclasses import dataclass, asdict
import asyncio


@dataclass
class HealthStatus:
    """Health status of a single component.

    Attributes:
        name: Name of the health check component.
        healthy: Whether the component is healthy.
        error: Optional error message if unhealthy.
        latency_ms: Optional latency of the health check in milliseconds.
    """
    name: str
    healthy: bool
    error: Optional[str] = None
    latency_ms: Optional[float] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class HealthCheckResult:
    """Result of a full health check.

    Attributes:
        healthy: Whether all checks passed.
        checks: List of individual health check results.
        timestamp: ISO timestamp when check was performed.
    """
    healthy: bool
    checks: List[HealthStatus]
    timestamp: str

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'healthy': self.healthy,
            'checks': [check.to_dict() for check in self.checks],
            'timestamp': self.timestamp
        }


class HealthChecker:
    """Service health checker with registered dependency checks.

    Example:
        health = HealthChecker()

        async def check_db():
            # ... check database
            return HealthStatus(name="database", healthy=True)

        health.register("database", check_db)
        result = await health.check_all()
    """

    def __init__(self):
        """Initialize health checker."""
        self._checks: Dict[str, Callable] = {}

    def register(self, name: str, check_func: Callable) -> None:
        """Register a health check function.

        Args:
            name: Unique name for the check.
            check_func: Async function that returns HealthStatus.
        """
        self._checks[name] = check_func

    async def check_all(self) -> HealthCheckResult:
        """Perform all registered health checks.

        Returns:
            HealthCheckResult with status of all checks.
        """
        import time
        from datetime import datetime

        checks = []
        tasks = []

        # Create tasks for all checks
        for name, check_func in self._checks.items():
            tasks.append(self._run_check(name, check_func))

        # Run all checks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                # Handle unexpected errors
                checks.append(HealthStatus(
                    name="unknown",
                    healthy=False,
                    error=f"Health check failed: {str(result)}"
                ))
            else:
                checks.append(result)

        # Overall health is true only if all checks passed
        overall_healthy = all(check.healthy for check in checks)

        return HealthCheckResult(
            healthy=overall_healthy,
            checks=checks,
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )

    async def check_specific(self, name: str) -> Optional[HealthStatus]:
        """Perform a specific health check.

        Args:
            name: Name of the registered check to run.

        Returns:
            HealthStatus if check exists, None otherwise.
        """
        if name not in self._checks:
            return None

        check_func = self._checks[name]
        return await self._run_check(name, check_func)

    @staticmethod
    async def _run_check(name: str, check_func: Callable) -> HealthStatus:
        """Run a single health check with timing.

        Args:
            name: Name of the check.
            check_func: Async function that returns HealthStatus.

        Returns:
            HealthStatus with latency populated.
        """
        import time

        start = time.time()
        try:
            status = await check_func()
            latency_ms = (time.time() - start) * 1000
            status.latency_ms = latency_ms
            return status
        except Exception as e:
            latency_ms = (time.time() - start) * 1000
            return HealthStatus(
                name=name,
                healthy=False,
                error=str(e),
                latency_ms=latency_ms
            )


class ReadinessChecker:
    """Readiness probe checker for determining when service is ready to serve traffic.

    This is separate from liveness checks — a service can be alive but not ready
    to handle requests if its dependencies aren't initialized.

    Example:
        readiness = ReadinessChecker()

        async def check_schema_service():
            # ... verify schema service is accessible
            return True

        readiness.register("schema_service", check_schema_service)
        ready = await readiness.is_ready()
    """

    def __init__(self):
        """Initialize readiness checker."""
        self._checks: Dict[str, Callable] = {}
        self._required_checks: set = set()

    def register(self, name: str, check_func: Callable, required: bool = False) -> None:
        """Register a readiness check function.

        Args:
            name: Unique name for the check.
            check_func: Async function that returns True if ready, False otherwise.
            required: Whether this check must pass for service to be ready.
        """
        self._checks[name] = check_func
        if required:
            self._required_checks.add(name)

    async def is_ready(self) -> bool:
        """Check if all required checks pass.

        Returns:
            True if all required checks pass, False otherwise.
        """
        tasks = []
        check_names = []

        for name, check_func in self._checks.items():
            tasks.append(check_func())
            check_names.append(name)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Check required checks
        for name, result in zip(check_names, results):
            if name in self._required_checks:
                if isinstance(result, Exception) or not result:
                    return False

        return True

    async def get_status(self) -> Dict[str, bool]:
        """Get status of all readiness checks.

        Returns:
            Dict mapping check names to their status (True = ready).
        """
        tasks = []
        check_names = list(self._checks.keys())

        for check_func in self._checks.values():
            tasks.append(check_func())

        results = await asyncio.gather(*tasks, return_exceptions=True)

        status = {}
        for name, result in zip(check_names, results):
            if isinstance(result, Exception):
                status[name] = False
            else:
                status[name] = bool(result)

        return status


# Utility functions for common health checks

async def check_http_endpoint(url: str, timeout: float = 5.0) -> HealthStatus:
    """Check if an HTTP endpoint is reachable.

    Args:
        url: URL to check (e.g., 'http://localhost:8000/health').
        timeout: Request timeout in seconds.

    Returns:
        HealthStatus indicating if endpoint is healthy.
    """
    import time

    try:
        import httpx
        start = time.time()
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            latency_ms = (time.time() - start) * 1000
            return HealthStatus(
                name="http_endpoint",
                healthy=response.status_code < 500,
                latency_ms=latency_ms
            )
    except Exception as e:
        return HealthStatus(
            name="http_endpoint",
            healthy=False,
            error=f"HTTP check failed: {str(e)}"
        )


async def check_database_connection(
    get_connection: Callable,
    timeout: float = 5.0
) -> HealthStatus:
    """Check if database is accessible.

    Args:
        get_connection: Async function that creates a database connection.
        timeout: Check timeout in seconds.

    Returns:
        HealthStatus indicating if database is healthy.
    """
    import time

    try:
        start = time.time()
        conn = await asyncio.wait_for(get_connection(), timeout=timeout)
        await conn.close()
        latency_ms = (time.time() - start) * 1000
        return HealthStatus(
            name="database",
            healthy=True,
            latency_ms=latency_ms
        )
    except asyncio.TimeoutError:
        return HealthStatus(
            name="database",
            healthy=False,
            error="Connection timeout"
        )
    except Exception as e:
        return HealthStatus(
            name="database",
            healthy=False,
            error=str(e)
        )


async def check_redis_connection(
    redis_client,
    timeout: float = 5.0
) -> HealthStatus:
    """Check if Redis is accessible.

    Args:
        redis_client: Redis client instance.
        timeout: Check timeout in seconds.

    Returns:
        HealthStatus indicating if Redis is healthy.
    """
    import time

    try:
        start = time.time()
        await asyncio.wait_for(redis_client.ping(), timeout=timeout)
        latency_ms = (time.time() - start) * 1000
        return HealthStatus(
            name="redis",
            healthy=True,
            latency_ms=latency_ms
        )
    except asyncio.TimeoutError:
        return HealthStatus(
            name="redis",
            healthy=False,
            error="Redis ping timeout"
        )
    except Exception as e:
        return HealthStatus(
            name="redis",
            healthy=False,
            error=str(e)
        )
