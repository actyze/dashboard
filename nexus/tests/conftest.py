"""Shared pytest fixtures for the Nexus test suite."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt


# ---------------------------------------------------------------------------
# JWT helpers (mirrors app/auth/utils.py but with a fixed test secret)
# ---------------------------------------------------------------------------
TEST_JWT_SECRET = "test-secret-key-for-unit-tests"
TEST_JWT_ALGORITHM = "HS256"


def _make_test_token(
    user_id: str | None = None,
    username: str = "testuser",
    roles: list[str] | None = None,
    expires_minutes: int = 60,
) -> str:
    """Create a valid JWT token for testing."""
    if user_id is None:
        user_id = str(uuid.uuid4())
    if roles is None:
        roles = ["USER"]

    payload = {
        "sub": user_id,
        "username": username,
        "roles": roles,
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm=TEST_JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Patch list — things that require real infra are mocked at import time
# ---------------------------------------------------------------------------

def _make_engine_mock():
    """Create a mock engine with working async context manager for connect()."""
    engine = MagicMock()
    conn_mock = AsyncMock()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=conn_mock)
    cm.__aexit__ = AsyncMock(return_value=False)
    engine.connect = MagicMock(return_value=cm)
    return engine


def _build_patches():
    """Return a list of unittest.mock.patch objects to apply during tests."""
    return [
        # Database manager — avoid real PG connections
        patch("app.database.db_manager.initialize", new_callable=AsyncMock),
        patch("app.database.db_manager.create_tables", new_callable=AsyncMock),
        patch("app.database.db_manager.close", new_callable=AsyncMock),
        # Migrations
        patch("app.migrations.run_migrations", new_callable=AsyncMock, return_value=True),
        # Orchestration service
        patch("app.services.orchestration_service.orchestration_service.initialize", new_callable=AsyncMock),
        patch("app.services.orchestration_service.orchestration_service.shutdown", new_callable=AsyncMock),
        # Telemetry — never phone home in tests
        patch("app.services.telemetry_service.telemetry_service.start", new_callable=AsyncMock),
        patch("app.services.telemetry_service.telemetry_service.stop", new_callable=AsyncMock),
        # Refresh service
        patch("app.services.refresh_service.refresh_service.recover_stuck_jobs", new_callable=AsyncMock),
        # Scheduler
        patch("app.services.scheduler_service.start_scheduler", new_callable=MagicMock),
        patch("app.services.scheduler_service.stop_scheduler", new_callable=MagicMock),
        # db_manager.engine — needed by lifespan for migrations context manager
        patch("app.database.db_manager.engine", new=_make_engine_mock()),
        # JWT decode — use test secret so our test tokens are accepted
        patch(
            "app.auth.utils.SECRET_KEY",
            TEST_JWT_SECRET,
        ),
        patch(
            "app.auth.dependencies.SECRET_KEY",
            TEST_JWT_SECRET,
        ),
    ]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def test_app():
    """Create a fresh FastAPI app instance with all external deps mocked."""
    patches = _build_patches()
    for p in patches:
        p.start()

    # Import app AFTER patches are in place so lifespan picks up mocks
    from main import app

    yield app

    for p in patches:
        p.stop()


@pytest.fixture
async def test_client(test_app):
    """Async HTTP client wired to the test app via ASGI transport."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Return Authorization headers with a valid test JWT."""
    token = _make_test_token(username="testuser", roles=["USER"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers() -> dict[str, str]:
    """Return Authorization headers with an ADMIN test JWT."""
    token = _make_test_token(username="admin", roles=["ADMIN"])
    return {"Authorization": f"Bearer {token}"}
