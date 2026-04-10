# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for admin user management.

Tests RBAC enforcement: admin-only endpoints reject regular users.
"""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def admin_token(client, db_session):
    user = await create_user(db_session, username="admin_user", password="admin", roles=["ADMIN"])
    return await login(client, user["username"], "admin")


@pytest.fixture
async def regular_token(client, db_session):
    user = await create_user(db_session, username="regular_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


# ---------------------------------------------------------------------------
# User listing
# ---------------------------------------------------------------------------

async def test_list_users_as_admin(client, admin_token):
    """GET /api/admin/users returns paginated user list for admins."""
    resp = await client.get("/api/admin/users", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "users" in body
    assert isinstance(body["users"], list)


async def test_list_users_forbidden_for_regular_user(client, regular_token):
    """Regular users cannot list all users."""
    resp = await client.get("/api/admin/users", headers=auth_headers(regular_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# User creation
# ---------------------------------------------------------------------------

async def test_create_user(client, admin_token):
    """POST /api/admin/users creates a new user."""
    import uuid as _uuid
    unique = _uuid.uuid4().hex[:6]
    resp = await client.post(
        "/api/admin/users",
        json={
            "username": f"new_created_{unique}",
            "email": f"new_{unique}@example.com",
            "password": "strongpass123",
            "full_name": "New User",
            "role": "USER",
        },
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200, f"Create user failed: {resp.text}"
    body = resp.json()
    assert body["success"] is True


async def test_create_duplicate_user(client, admin_token, db_session):
    """Creating a user with an existing username fails."""
    user = await create_user(db_session, username="dup_user", password="pass")

    resp = await client.post(
        "/api/admin/users",
        json={
            "username": user["username"],
            "email": "different_dup@test.local",
            "password": "pass",
            "role": "USER",
        },
        headers=auth_headers(admin_token),
    )
    # Should fail with conflict or error
    body = resp.json()
    assert body.get("success") is False or resp.status_code >= 400


async def test_create_user_forbidden_for_regular(client, regular_token):
    """Regular users cannot create users."""
    resp = await client.post(
        "/api/admin/users",
        json={"username": "hacker", "email": "h@test.local", "password": "x", "role": "ADMIN"},
        headers=auth_headers(regular_token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Role management
# ---------------------------------------------------------------------------

async def test_change_user_role(client, admin_token, db_session):
    """PUT /api/admin/users/{id}/role changes the role."""
    user = await create_user(db_session, username="role_target", password="pass", roles=["USER"])

    resp = await client.put(
        f"/api/admin/users/{user['id']}/role",
        json={"role": "READONLY"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# User deactivation
# ---------------------------------------------------------------------------

async def test_deactivate_user(client, admin_token, db_session):
    """DELETE /api/admin/users/{id} deactivates the user."""
    user = await create_user(db_session, username="deactivate_me", password="pass")

    resp = await client.delete(
        f"/api/admin/users/{user['id']}",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify the user can no longer login
    login_resp = await client.post(
        "/api/auth/login",
        data={"username": user["username"], "password": "pass"},
    )
    assert login_resp.status_code == 401


# ---------------------------------------------------------------------------
# Roles listing
# ---------------------------------------------------------------------------

async def test_list_roles(client, admin_token):
    """GET /api/admin/roles returns available roles."""
    resp = await client.get("/api/admin/roles", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    role_names = [r["name"] for r in body["roles"]]
    assert "ADMIN" in role_names
    assert "USER" in role_names
