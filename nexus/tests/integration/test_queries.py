# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for query history CRUD."""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def user_token(client, db_session):
    user = await create_user(db_session, username="query_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


# ---------------------------------------------------------------------------
# Query history CRUD
# ---------------------------------------------------------------------------

async def test_save_query(client, user_token):
    """POST /api/query-history/save stores a query."""
    resp = await client.post(
        "/api/query-history/save",
        json={
            "generated_sql": "SELECT COUNT(*) FROM orders",
            "query_name": "Order count",
            "execution_status": "SUCCESS",
            "execution_time_ms": 42,
            "row_count": 1,
        },
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "query_id" in body or "id" in body


async def test_list_query_history(client, user_token):
    """GET /api/query-history returns saved queries."""
    # Save a query first
    await client.post(
        "/api/query-history/save",
        json={"generated_sql": "SELECT 1", "query_name": "Test Q", "execution_status": "SUCCESS"},
        headers=auth_headers(user_token),
    )

    resp = await client.get("/api/query-history", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["queries"]) >= 1


async def test_rename_query(client, user_token):
    """PATCH /api/query-history/{id}/name renames a query."""
    save_resp = await client.post(
        "/api/query-history/save",
        json={"generated_sql": "SELECT 1", "query_name": "Old Name", "execution_status": "SUCCESS"},
        headers=auth_headers(user_token),
    )
    save_body = save_resp.json()
    query_id = save_body.get("query_id") or save_body.get("id")

    resp = await client.patch(
        f"/api/query-history/{query_id}/name",
        json={"query_name": "New Name"},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_toggle_favorite(client, user_token):
    """POST /api/query-history/{id}/favorite toggles the favorite flag."""
    save_resp = await client.post(
        "/api/query-history/save",
        json={"generated_sql": "SELECT 1", "query_name": "Fav Test", "execution_status": "SUCCESS"},
        headers=auth_headers(user_token),
    )
    save_body = save_resp.json()
    query_id = save_body.get("query_id") or save_body.get("id")

    resp = await client.post(
        f"/api/query-history/{query_id}/favorite",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_delete_query(client, user_token):
    """DELETE /api/query-history/{id} removes a query."""
    save_resp = await client.post(
        "/api/query-history/save",
        json={"generated_sql": "SELECT 1", "query_name": "Delete Me", "execution_status": "SUCCESS"},
        headers=auth_headers(user_token),
    )
    save_body = save_resp.json()
    query_id = save_body.get("query_id") or save_body.get("id")

    resp = await client.delete(
        f"/api/query-history/{query_id}",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_query_history_requires_auth(client):
    """Query history rejects unauthenticated requests."""
    resp = await client.get("/api/query-history")
    assert resp.status_code in (401, 403)
