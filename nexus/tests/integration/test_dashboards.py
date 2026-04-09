# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for dashboard CRUD and tile management."""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def user_token(client, db_session):
    """Create a standard user and return their auth token."""
    user = await create_user(db_session, username="dash_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


# ---------------------------------------------------------------------------
# Dashboard CRUD
# ---------------------------------------------------------------------------

async def test_create_dashboard(client, user_token):
    """POST /api/dashboards creates a dashboard."""
    resp = await client.post(
        "/api/dashboards",
        json={"title": "Test Dashboard", "description": "Integration test"},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["dashboard"]["title"] == "Test Dashboard"
    assert "id" in body["dashboard"]


async def test_list_dashboards(client, db_session, user_token):
    """GET /api/dashboards returns user's dashboards."""
    # Create two dashboards
    await client.post(
        "/api/dashboards",
        json={"title": "Dash A"},
        headers=auth_headers(user_token),
    )
    await client.post(
        "/api/dashboards",
        json={"title": "Dash B"},
        headers=auth_headers(user_token),
    )

    resp = await client.get("/api/dashboards", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["dashboards"]) >= 2
    titles = [d["title"] for d in body["dashboards"]]
    assert "Dash A" in titles
    assert "Dash B" in titles


async def test_get_dashboard_by_id(client, user_token):
    """GET /api/dashboards/{id} returns the dashboard."""
    create_resp = await client.post(
        "/api/dashboards",
        json={"title": "Fetch Me"},
        headers=auth_headers(user_token),
    )
    dash_id = create_resp.json()["dashboard"]["id"]

    resp = await client.get(
        f"/api/dashboards/{dash_id}",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["dashboard"]["title"] == "Fetch Me"


async def test_update_dashboard(client, user_token):
    """PUT /api/dashboards/{id} updates fields."""
    create_resp = await client.post(
        "/api/dashboards",
        json={"title": "Before Update"},
        headers=auth_headers(user_token),
    )
    dash_id = create_resp.json()["dashboard"]["id"]

    resp = await client.put(
        f"/api/dashboards/{dash_id}",
        json={"title": "After Update", "description": "Updated desc"},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["dashboard"]["title"] == "After Update"


async def test_delete_dashboard(client, user_token):
    """DELETE /api/dashboards/{id} removes the dashboard."""
    create_resp = await client.post(
        "/api/dashboards",
        json={"title": "Delete Me"},
        headers=auth_headers(user_token),
    )
    dash_id = create_resp.json()["dashboard"]["id"]

    resp = await client.delete(
        f"/api/dashboards/{dash_id}",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200

    # Verify it's gone
    get_resp = await client.get(
        f"/api/dashboards/{dash_id}",
        headers=auth_headers(user_token),
    )
    assert get_resp.status_code in (404, 200)
    if get_resp.status_code == 200:
        assert get_resp.json().get("success") is False


# ---------------------------------------------------------------------------
# Dashboard Tiles
# ---------------------------------------------------------------------------

async def test_create_and_list_tiles(client, user_token):
    """POST then GET tiles for a dashboard."""
    # Create dashboard
    create_resp = await client.post(
        "/api/dashboards",
        json={"title": "Tile Test"},
        headers=auth_headers(user_token),
    )
    dash_id = create_resp.json()["dashboard"]["id"]

    # Add a tile
    tile_resp = await client.post(
        f"/api/dashboards/{dash_id}/tiles",
        json={
            "title": "Revenue Chart",
            "sql_query": "SELECT 1 AS revenue",
            "chart_type": "bar",
        },
        headers=auth_headers(user_token),
    )
    assert tile_resp.status_code == 200
    tile_body = tile_resp.json()
    assert tile_body["success"] is True
    tile_id = tile_body["tile"]["id"]

    # List tiles
    list_resp = await client.get(
        f"/api/dashboards/{dash_id}/tiles",
        headers=auth_headers(user_token),
    )
    assert list_resp.status_code == 200
    tiles = list_resp.json()["tiles"]
    assert any(t["id"] == tile_id for t in tiles)


async def test_delete_tile(client, user_token):
    """DELETE a tile from a dashboard."""
    create_resp = await client.post(
        "/api/dashboards",
        json={"title": "Tile Delete Test"},
        headers=auth_headers(user_token),
    )
    dash_id = create_resp.json()["dashboard"]["id"]

    tile_resp = await client.post(
        f"/api/dashboards/{dash_id}/tiles",
        json={"title": "Temp Tile", "sql_query": "SELECT 1", "chart_type": "bar"},
        headers=auth_headers(user_token),
    )
    tile_body = tile_resp.json()
    tile_id = tile_body.get("tile", tile_body).get("id") or tile_body.get("tile_id")
    assert tile_id is not None, f"Could not find tile ID in: {tile_body}"

    del_resp = await client.delete(
        f"/api/dashboards/{dash_id}/tiles/{tile_id}",
        headers=auth_headers(user_token),
    )
    assert del_resp.status_code == 200


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------

async def test_dashboard_requires_auth(client):
    """Dashboard endpoints reject unauthenticated requests."""
    resp = await client.get("/api/dashboards")
    assert resp.status_code in (401, 403)

    resp = await client.post("/api/dashboards", json={"title": "Nope"})
    assert resp.status_code in (401, 403)
