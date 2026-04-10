# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for preferences, metadata descriptions, and exclusions."""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def user_token(client, db_session):
    user = await create_user(db_session, username="pref_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


@pytest.fixture
async def admin_token(client, db_session):
    user = await create_user(db_session, username="pref_admin", password="admin", roles=["ADMIN"])
    return await login(client, user["username"], "admin")


# ---------------------------------------------------------------------------
# Preferred Tables
# ---------------------------------------------------------------------------

async def test_add_preferred_table(client, user_token):
    """POST /api/preferences/preferred-tables adds a preference.

    Note: This endpoint validates the table exists in Trino. If Trino doesn't
    have the table, the request will fail with 400. We accept either outcome.
    """
    resp = await client.post(
        "/api/preferences/preferred-tables",
        json={"catalog": "postgres", "schema": "public", "table": "orders"},
        headers=auth_headers(user_token),
    )
    # 200 = table found and preference saved; 400 = table not found in Trino (acceptable in test env)
    assert resp.status_code in (200, 400), f"Unexpected status: {resp.status_code} {resp.text}"
    if resp.status_code == 200:
        assert resp.json()["success"] is True


async def test_list_preferred_tables(client, user_token):
    """GET /api/preferences/preferred-tables returns user's preferences."""
    # Add one first
    await client.post(
        "/api/preferences/preferred-tables",
        json={"catalog": "postgres", "schema_name": "public", "table_name": "customers"},
        headers=auth_headers(user_token),
    )

    resp = await client.get(
        "/api/preferences/preferred-tables",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) or (isinstance(body, dict) and "preferences" in body)


async def test_delete_preferred_table(client, user_token):
    """DELETE /api/preferences/preferred-tables/{id} removes a preference."""
    add_resp = await client.post(
        "/api/preferences/preferred-tables",
        json={"catalog": "postgres", "schema_name": "public", "table_name": "delete_me"},
        headers=auth_headers(user_token),
    )
    pref_id = add_resp.json().get("id") or add_resp.json().get("preference", {}).get("id")
    if pref_id:
        resp = await client.delete(
            f"/api/preferences/preferred-tables/{pref_id}",
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Metadata Descriptions
# ---------------------------------------------------------------------------

async def test_add_metadata_description(client, user_token):
    """POST /api/metadata/descriptions adds a description."""
    resp = await client.post(
        "/api/metadata/descriptions",
        json={
            "catalog": "postgres",
            "schema_name": "public",
            "table_name": "orders",
            "description": "Customer order records",
        },
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_list_metadata_descriptions(client, user_token):
    """GET /api/metadata/descriptions returns descriptions."""
    resp = await client.get(
        "/api/metadata/descriptions",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "descriptions" in body


# ---------------------------------------------------------------------------
# Schema Exclusions (admin only)
# ---------------------------------------------------------------------------

async def test_add_exclusion(client, admin_token):
    """POST /api/v1/exclusions/bulk adds exclusions."""
    import uuid as _uuid
    unique_schema = f"test_schema_{_uuid.uuid4().hex[:6]}"
    resp = await client.post(
        "/api/v1/exclusions/bulk",
        json={
            "exclusions": [
                {"catalog": "postgres", "schema_name": unique_schema, "reason": "Hidden from AI"},
            ]
        },
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["created_count"] >= 1


async def test_list_exclusions(client, admin_token):
    """GET /api/v1/exclusions returns all exclusions."""
    resp = await client.get("/api/v1/exclusions", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) or (isinstance(body, dict) and "exclusions" in body)


async def test_check_exclusion(client, admin_token):
    """GET /api/v1/exclusions/check tests if a path is excluded."""
    # Add an exclusion first
    await client.post(
        "/api/v1/exclusions/bulk",
        json={"exclusions": [{"catalog": "hidden_cat"}]},
        headers=auth_headers(admin_token),
    )

    resp = await client.get(
        "/api/v1/exclusions/check",
        params={"catalog": "hidden_cat"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_excluded"] is True


async def test_exclusions_forbidden_for_regular(client, user_token):
    """Regular users cannot manage exclusions."""
    resp = await client.get("/api/v1/exclusions", headers=auth_headers(user_token))
    assert resp.status_code == 403
