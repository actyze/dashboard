# SPDX-License-Identifier: AGPL-3.0-only
"""
Integration test fixtures — real PostgreSQL, real ORM, real auth.

Requires a running PostgreSQL instance. CI provides one automatically.
Locally, use the Docker stack: docker/start.sh

Env vars (defaults match CI):
    POSTGRES_HOST      localhost
    POSTGRES_PORT      5432
    POSTGRES_DATABASE  test
    POSTGRES_USER      test
    POSTGRES_PASSWORD  test
"""

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# ---------------------------------------------------------------------------
# Database configuration — read from env, fall back to CI defaults
# ---------------------------------------------------------------------------
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DATABASE", "test")
DB_USER = os.getenv("POSTGRES_USER", "test")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "test")
DB_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

TEST_JWT_SECRET = "integration-test-secret"


# ---------------------------------------------------------------------------
# Session-scoped engine + schema setup (runs once per test session)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the entire test session."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def db_engine():
    """Create the async engine and run real migrations for an accurate schema.

    Uses psql to run the actual SQL migration files so the test database
    schema exactly matches production — including PL/pgSQL functions,
    triggers, and complex DDL that can't be split on semicolons.
    """
    import subprocess
    from pathlib import Path

    engine = create_async_engine(DB_URL, echo=False, pool_size=10, max_overflow=10)

    # Run all migration SQL files via psql — handles $$ blocks, multi-statement, etc.
    migrations_dir = Path(__file__).parent.parent.parent / "db" / "migrations"
    migration_files = sorted(migrations_dir.glob("V*.sql"))
    psql_url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    for sql_file in migration_files:
        subprocess.run(
            ["psql", psql_url, "-f", str(sql_file), "--no-psqlrc", "-q"],
            capture_output=True, text=True, timeout=30,
        )
        # Ignore errors — migrations use IF NOT EXISTS / ON CONFLICT for idempotency

    yield engine

    # Teardown: clean up test data. Delete in FK-safe order.
    async with engine.begin() as conn:
        test_user_ids = "SELECT id FROM nexus.users WHERE email LIKE '%@test.local' OR email LIKE '%@example.com'"
        await conn.execute(text(f"DELETE FROM nexus.schema_exclusions WHERE excluded_by IN ({test_user_ids})"))
        await conn.execute(text(f"DELETE FROM nexus.user_schema_preferences WHERE user_id IN ({test_user_ids})"))
        await conn.execute(text(f"DELETE FROM nexus.query_history WHERE user_id IN ({test_user_ids})"))
        await conn.execute(text(f"DELETE FROM nexus.dashboard_tiles WHERE dashboard_id IN (SELECT id FROM nexus.dashboards WHERE owner_user_id IN ({test_user_ids}))"))
        await conn.execute(text(f"DELETE FROM nexus.dashboards WHERE owner_user_id IN ({test_user_ids})"))
        await conn.execute(text(f"DELETE FROM nexus.user_roles WHERE user_id IN ({test_user_ids})"))
        await conn.execute(text(f"DELETE FROM nexus.users WHERE email LIKE '%@test.local' OR email LIKE '%@example.com'"))
    await engine.dispose()


@pytest.fixture(scope="session")
async def setup_engine():
    """Separate engine used ONLY for test data setup (create_user, etc.).

    This avoids connection-pool conflicts with the app engine.
    """
    engine = create_async_engine(DB_URL, echo=False, pool_size=2)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(setup_engine):
    """Yields the setup engine — tests use create_user(db_session, ...)."""
    yield setup_engine


# ---------------------------------------------------------------------------
# Test user factory
# ---------------------------------------------------------------------------

async def create_user(
    engine,
    username: str = "testuser",
    password: str = "testpass123",
    email: str | None = None,
    roles: list[str] | None = None,
) -> dict:
    """Create a user in the real database and return their info.

    Uses a SEPARATE engine from the app to avoid connection conflicts.
    Appends a UUID suffix to ensure uniqueness across test runs.
    """
    import bcrypt

    suffix = uuid.uuid4().hex[:8]
    unique_username = f"{username}_{suffix}"
    if email is None:
        email = f"{unique_username}@test.local"
    if roles is None:
        roles = ["USER"]

    user_id = uuid.uuid4()
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO nexus.users (id, username, email, password_hash, full_name, is_active, created_at, updated_at)
            VALUES (:id, :username, :email, :hash, :full_name, true, NOW(), NOW())
        """), {"id": user_id, "username": unique_username, "email": email, "hash": password_hash, "full_name": username.title()})

        for role_name in roles:
            await conn.execute(text("""
                INSERT INTO nexus.user_roles (user_id, role_id, assigned_at)
                SELECT :uid, id, NOW() FROM nexus.roles WHERE name = :role
            """), {"uid": user_id, "role": role_name})

    return {
        "id": str(user_id),
        "username": unique_username,
        "email": email,
        "password": password,
        "roles": roles,
    }


# ---------------------------------------------------------------------------
# FastAPI test client wired to real DB
# ---------------------------------------------------------------------------
def _external_service_patches():
    """Mock only external services (schema service, LLM, Trino, telemetry).
    Database and auth stay REAL."""
    return [
        # Orchestration — avoid real LLM/Trino/schema calls
        patch("app.services.orchestration_service.orchestration_service.initialize", new_callable=AsyncMock),
        patch("app.services.orchestration_service.orchestration_service.shutdown", new_callable=AsyncMock),
        # Telemetry — never phone home
        patch("app.services.telemetry_service.telemetry_service.start", new_callable=AsyncMock),
        patch("app.services.telemetry_service.telemetry_service.stop", new_callable=AsyncMock),
        # Refresh service background recovery
        patch("app.services.refresh_service.refresh_service.recover_stuck_jobs", new_callable=AsyncMock),
        # Scheduler
        patch("app.services.scheduler_service.start_scheduler", new_callable=MagicMock),
        patch("app.services.scheduler_service.stop_scheduler", new_callable=MagicMock),
        # Migrations — tables already created by db_engine fixture
        patch("app.migrations.run_migrations", new_callable=AsyncMock, return_value=True),
        # JWT secret — use our test secret
        patch("app.auth.utils.SECRET_KEY", TEST_JWT_SECRET),
        patch("app.auth.dependencies.SECRET_KEY", TEST_JWT_SECRET),
    ]


@pytest.fixture
async def client(db_engine):
    """AsyncClient talking to the real FastAPI app with real DB.

    Creates a SEPARATE engine for the app to avoid connection pool conflicts
    between the test framework and the ASGI transport.
    """
    # The app gets its own engine so connections don't conflict with test setup
    app_engine = create_async_engine(DB_URL, echo=False, pool_size=10, max_overflow=5)
    app_session_factory = async_sessionmaker(app_engine, class_=AsyncSession, expire_on_commit=False)

    patches = _external_service_patches()

    pg_patches = [
        patch("app.database.db_manager.initialize", new_callable=AsyncMock),
        patch("app.database.db_manager.create_tables", new_callable=AsyncMock),
        patch("app.database.db_manager.close", new_callable=AsyncMock),
        patch("app.database.db_manager.engine", new=app_engine),
        patch("app.database.db_manager.async_session", new=app_session_factory),
        patch("app.database.db_manager.get_session", new=lambda: app_session_factory()),
    ]

    all_patches = patches + pg_patches
    for p in all_patches:
        p.start()

    from main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    for p in all_patches:
        p.stop()
    await app_engine.dispose()


# ---------------------------------------------------------------------------
# Convenience: authenticated client helpers
# ---------------------------------------------------------------------------
async def login(client: AsyncClient, username: str, password: str) -> str:
    """Login via API and return the access token."""
    resp = await client.post(
        "/api/auth/login",
        data={"username": username, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert data["success"] is True
    return data["access_token"]


def auth_headers(token: str) -> dict:
    """Build Authorization header dict from token."""
    return {"Authorization": f"Bearer {token}"}
