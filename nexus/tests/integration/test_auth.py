# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for authentication endpoints.

These hit the real database — no mocked user_service.
Would have caught: user_state ORM column mismatch, bcrypt version issues,
JWT secret misconfiguration, role lookup failures.
"""

import pytest
from .conftest import create_user, login, auth_headers


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

async def test_login_success(client, db_session):
    """Valid credentials return access_token and user info."""
    user = await create_user(db_session, username="auth_user", password="secret123")

    resp = await client.post(
        "/api/auth/login",
        data={"username": user["username"], "password": "secret123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == user["username"]
    assert body["user"]["email"] == user["email"]


async def test_login_wrong_password(client, db_session):
    """Wrong password returns 401."""
    user = await create_user(db_session, username="auth_wrong_pw", password="correct")

    resp = await client.post(
        "/api/auth/login",
        data={"username": user["username"], "password": "incorrect"},
    )
    assert resp.status_code == 401


async def test_login_nonexistent_user(client):
    """Unknown username returns 401."""
    resp = await client.post(
        "/api/auth/login",
        data={"username": "does_not_exist", "password": "anything"},
    )
    assert resp.status_code == 401


async def test_login_missing_fields(client):
    """Missing username/password returns 422."""
    resp = await client.post("/api/auth/login")
    assert resp.status_code == 422


async def test_login_inactive_user(client, db_session):
    """Inactive user cannot login."""
    from sqlalchemy import text
    user = await create_user(db_session, username="auth_inactive", password="pass")
    async with db_session.begin() as conn:
        await conn.execute(
            text("UPDATE nexus.users SET is_active = false WHERE username = :username"),
            {"username": user["username"]},
        )

    resp = await client.post(
        "/api/auth/login",
        data={"username": user["username"], "password": "pass"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/auth/users/me
# ---------------------------------------------------------------------------

async def test_get_current_user(client, db_session):
    """Authenticated user can fetch their own profile."""
    user = await create_user(db_session, username="auth_me", password="pass")
    token = await login(client, user["username"], "pass")

    resp = await client.get("/api/auth/users/me", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == user["username"]
    assert body["email"] == user["email"]


async def test_get_current_user_no_token(client):
    """No token returns 401."""
    resp = await client.get("/api/auth/users/me")
    assert resp.status_code in (401, 403)


async def test_get_current_user_invalid_token(client):
    """Garbage token returns 401."""
    resp = await client.get(
        "/api/auth/users/me",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Role-based access
# ---------------------------------------------------------------------------

async def test_admin_role_in_token(client, db_session):
    """Admin user gets ADMIN in their token claims."""
    user = await create_user(db_session, username="auth_admin", password="admin", roles=["ADMIN"])
    token = await login(client, user["username"], "admin")

    resp = await client.get("/api/auth/users/me", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "ADMIN" in body["roles"]


async def test_protected_endpoint_requires_auth(client):
    """Dashboard list requires authentication."""
    resp = await client.get("/api/dashboards")
    assert resp.status_code in (401, 403)
