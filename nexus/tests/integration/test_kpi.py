# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for Scheduled KPI CRUD, collection, and aggregation."""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def user_token(client, db_session):
    """Create a standard USER and return their auth token."""
    user = await create_user(db_session, username="kpi_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


@pytest.fixture
async def admin_token(client, db_session):
    """Create an ADMIN user and return their auth token."""
    user = await create_user(db_session, username="kpi_admin", password="pass", roles=["ADMIN"])
    return await login(client, user["username"], "pass")


@pytest.fixture
async def readonly_token(client, db_session):
    """Create a READONLY user and return their auth token."""
    user = await create_user(db_session, username="kpi_readonly", password="pass", roles=["READONLY"])
    return await login(client, user["username"], "pass")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def create_kpi(client, token, **overrides):
    """Create a KPI and return the response body."""
    payload = {
        "name": "Test KPI",
        "sql_query": "SELECT 1 AS value",
        "interval_hours": 1,
        **overrides,
    }
    resp = await client.post("/api/kpi", json=payload, headers=auth_headers(token))
    assert resp.status_code == 200, f"Create KPI failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def test_create_kpi(client, user_token):
    """POST /api/kpi creates a KPI definition."""
    body = await create_kpi(client, user_token, name="My KPI", interval_hours=4)
    assert body["name"] == "My KPI"
    assert body["interval_hours"] == 4
    assert body["is_active"] is True
    assert "id" in body


async def test_list_kpis(client, user_token):
    """GET /api/kpi returns created KPIs."""
    await create_kpi(client, user_token, name="KPI A")
    await create_kpi(client, user_token, name="KPI B")

    resp = await client.get("/api/kpi", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    names = [k["name"] for k in body["kpis"]]
    assert "KPI A" in names
    assert "KPI B" in names


async def test_get_kpi_by_id(client, user_token):
    """GET /api/kpi/{id} returns the KPI."""
    created = await create_kpi(client, user_token, name="Fetch Me")
    kpi_id = created["id"]

    resp = await client.get(f"/api/kpi/{kpi_id}", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Fetch Me"
    assert body["owner_username"] is not None


async def test_get_kpi_not_found(client, user_token):
    """GET /api/kpi/{bad-id} returns 404."""
    resp = await client.get(
        "/api/kpi/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 404


async def test_update_kpi(client, user_token):
    """PUT /api/kpi/{id} updates fields."""
    created = await create_kpi(client, user_token, name="Before")
    kpi_id = created["id"]

    resp = await client.put(
        f"/api/kpi/{kpi_id}",
        json={"name": "After", "interval_hours": 12},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "After"
    assert body["interval_hours"] == 12


async def test_delete_kpi(client, user_token):
    """DELETE /api/kpi/{id} removes the KPI."""
    created = await create_kpi(client, user_token, name="Delete Me")
    kpi_id = created["id"]

    resp = await client.delete(f"/api/kpi/{kpi_id}", headers=auth_headers(user_token))
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify it's gone
    get_resp = await client.get(f"/api/kpi/{kpi_id}", headers=auth_headers(user_token))
    assert get_resp.status_code == 404


async def test_delete_kpi_not_owned(client, db_session, user_token):
    """DELETE by a different user returns 404 (ownership check)."""
    created = await create_kpi(client, user_token, name="Not Yours")
    kpi_id = created["id"]

    other = await create_user(db_session, username="other_user", password="pass", roles=["USER"])
    other_token = await login(client, other["username"], "pass")

    resp = await client.delete(f"/api/kpi/{kpi_id}", headers=auth_headers(other_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Interval validation
# ---------------------------------------------------------------------------

async def test_interval_validation_min(client, user_token):
    """interval_hours < 1 is rejected."""
    resp = await client.post(
        "/api/kpi",
        json={"name": "Bad", "sql_query": "SELECT 1", "interval_hours": 0},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 422


async def test_interval_validation_max(client, user_token):
    """interval_hours > 24 is rejected."""
    resp = await client.post(
        "/api/kpi",
        json={"name": "Bad", "sql_query": "SELECT 1", "interval_hours": 25},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

async def test_readonly_can_list_kpis(client, readonly_token, user_token):
    """READONLY users can view KPIs."""
    await create_kpi(client, user_token, name="Visible KPI")

    resp = await client.get("/api/kpi", headers=auth_headers(readonly_token))
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1


async def test_readonly_cannot_create_kpi(client, readonly_token):
    """READONLY users cannot create KPIs."""
    resp = await client.post(
        "/api/kpi",
        json={"name": "Nope", "sql_query": "SELECT 1"},
        headers=auth_headers(readonly_token),
    )
    assert resp.status_code == 403


async def test_readonly_cannot_delete_kpi(client, readonly_token, user_token):
    """READONLY users cannot delete KPIs."""
    created = await create_kpi(client, user_token, name="Protected")
    resp = await client.delete(
        f"/api/kpi/{created['id']}",
        headers=auth_headers(readonly_token),
    )
    assert resp.status_code == 403


async def test_unauthenticated_access(client):
    """KPI endpoints reject unauthenticated requests."""
    resp = await client.get("/api/kpi")
    assert resp.status_code in (401, 403)

    resp = await client.post("/api/kpi", json={"name": "Nope", "sql_query": "SELECT 1"})
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Values & Summary (no Trino in integration tests, so collection is skipped)
# ---------------------------------------------------------------------------

async def test_values_empty_when_inactive(client, user_token):
    """GET /api/kpi/{id}/values returns empty when KPI created inactive (no background collection)."""
    created = await create_kpi(client, user_token, name="No Data", is_active=False)
    kpi_id = created["id"]

    resp = await client.get(
        f"/api/kpi/{kpi_id}/values?hours=24",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["values"] == []


async def test_summary_empty_when_inactive(client, user_token):
    """GET /api/kpi/{id}/summary returns zero when KPI created inactive."""
    created = await create_kpi(client, user_token, name="No Data Summary", is_active=False)
    kpi_id = created["id"]

    resp = await client.get(
        f"/api/kpi/{kpi_id}/summary?hours=24",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_collections"] == 0


async def test_collect_endpoint_returns_success(client, user_token):
    """POST /api/kpi/{id}/collect accepts the request (actual collection may fail without Trino)."""
    created = await create_kpi(client, user_token, name="Collect Test", is_active=False)
    kpi_id = created["id"]

    resp = await client.post(
        f"/api/kpi/{kpi_id}/collect",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["kpi_id"] == kpi_id


async def test_values_not_found(client, user_token):
    """GET /api/kpi/{bad-id}/values returns 404."""
    resp = await client.get(
        "/api/kpi/00000000-0000-0000-0000-000000000000/values",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Toggle active
# ---------------------------------------------------------------------------

async def test_toggle_active(client, user_token):
    """PUT with is_active=false pauses the KPI."""
    created = await create_kpi(client, user_token, name="Pausable")
    kpi_id = created["id"]
    assert created["is_active"] is True

    resp = await client.put(
        f"/api/kpi/{kpi_id}",
        json={"is_active": False},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Re-enable
    resp = await client.put(
        f"/api/kpi/{kpi_id}",
        json={"is_active": True},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True
