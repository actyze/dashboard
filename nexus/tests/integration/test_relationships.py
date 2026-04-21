# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for the semantic relationship graph API."""

import pytest
from .conftest import create_user, login, auth_headers


@pytest.fixture
async def admin_token(client, db_session):
    user = await create_user(db_session, username="rel_admin", password="admin", roles=["ADMIN"])
    return await login(client, user["username"], "admin")


@pytest.fixture
async def viewer_token(client, db_session):
    user = await create_user(db_session, username="rel_viewer", password="view", roles=["USER"])
    return await login(client, user["username"], "view")


# ---------------------------------------------------------------------------
# CRUD Operations
# ---------------------------------------------------------------------------

async def test_list_relationships_empty(client, viewer_token):
    """GET /api/relationships returns empty list initially."""
    resp = await client.get("/api/relationships", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["count"] == 0
    assert body["relationships"] == []


async def test_create_relationship_requires_admin(client, viewer_token):
    """POST /api/relationships requires admin role."""
    resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "tpch", "source_schema": "tiny", "source_table": "lineitem",
            "target_catalog": "tpch", "target_schema": "tiny", "target_table": "orders",
            "join_condition": "lineitem.orderkey = orders.orderkey",
        },
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 403


async def test_create_relationship(client, admin_token):
    """POST /api/relationships creates a relationship."""
    resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "tpch", "source_schema": "tiny", "source_table": "lineitem",
            "target_catalog": "tpch", "target_schema": "tiny", "target_table": "orders",
            "join_condition": "lineitem.orderkey = orders.orderkey",
            "relationship_type": "1:N",
        },
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    rel = body["relationship"]
    assert rel["source_table"] == "lineitem"
    assert rel["target_table"] == "orders"
    assert rel["join_condition"] == "lineitem.orderkey = orders.orderkey"
    assert rel["source_method"] == "admin"
    assert rel["confidence"] == 1.0
    assert rel["is_verified"] is False
    assert rel["is_disabled"] is False
    return rel["id"]


async def test_get_relationship_by_id(client, admin_token, viewer_token):
    """GET /api/relationships/{id} returns a single relationship."""
    # Create first
    create_resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "pg", "source_schema": "pub", "source_table": "orders",
            "target_catalog": "pg", "target_schema": "pub", "target_table": "customers",
            "join_condition": "orders.cust_id = customers.id",
        },
        headers=auth_headers(admin_token),
    )
    rel_id = create_resp.json()["relationship"]["id"]

    # Get as viewer
    resp = await client.get(f"/api/relationships/{rel_id}", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    assert resp.json()["relationship"]["source_table"] == "orders"


async def test_list_relationships_with_filters(client, admin_token, viewer_token):
    """GET /api/relationships supports catalog and method filters."""
    # Create two relationships in different catalogs
    await client.post(
        "/api/relationships",
        json={
            "source_catalog": "cat_a", "source_schema": "s", "source_table": "t1",
            "target_catalog": "cat_a", "target_schema": "s", "target_table": "t2",
            "join_condition": "t1.id = t2.t1_id",
        },
        headers=auth_headers(admin_token),
    )
    await client.post(
        "/api/relationships",
        json={
            "source_catalog": "cat_b", "source_schema": "s", "source_table": "t3",
            "target_catalog": "cat_b", "target_schema": "s", "target_table": "t4",
            "join_condition": "t3.id = t4.t3_id",
        },
        headers=auth_headers(admin_token),
    )

    # Filter by catalog
    resp = await client.get(
        "/api/relationships?catalog=cat_a",
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 200
    rels = resp.json()["relationships"]
    assert all(r["source_catalog"] == "cat_a" or r["target_catalog"] == "cat_a" for r in rels)

    # Filter by method
    resp = await client.get(
        "/api/relationships?method=admin",
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 200
    assert all(r["source_method"] == "admin" for r in resp.json()["relationships"])


# ---------------------------------------------------------------------------
# Verify / Disable / Delete
# ---------------------------------------------------------------------------

async def test_verify_relationship(client, admin_token):
    """POST /api/relationships/{id}/verify sets confidence=1.0 and is_verified=True."""
    create_resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "c", "source_schema": "s", "source_table": "verify_src",
            "target_catalog": "c", "target_schema": "s", "target_table": "verify_tgt",
            "join_condition": "verify_src.id = verify_tgt.src_id",
            "confidence": 0.5,
        },
        headers=auth_headers(admin_token),
    )
    rel_id = create_resp.json()["relationship"]["id"]

    resp = await client.post(
        f"/api/relationships/{rel_id}/verify",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    rel = resp.json()["relationship"]
    assert rel["confidence"] == 1.0
    assert rel["is_verified"] is True


async def test_disable_relationship(client, admin_token, viewer_token):
    """POST /api/relationships/{id}/disable hides the relationship from default listing."""
    create_resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "c", "source_schema": "s", "source_table": "disable_src",
            "target_catalog": "c", "target_schema": "s", "target_table": "disable_tgt",
            "join_condition": "disable_src.id = disable_tgt.src_id",
        },
        headers=auth_headers(admin_token),
    )
    rel_id = create_resp.json()["relationship"]["id"]

    # Disable
    resp = await client.post(
        f"/api/relationships/{rel_id}/disable",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["relationship"]["is_disabled"] is True

    # Default listing should not include it
    list_resp = await client.get("/api/relationships", headers=auth_headers(viewer_token))
    assert all(r["id"] != rel_id for r in list_resp.json()["relationships"])

    # With include_disabled=true it should appear
    list_resp = await client.get(
        "/api/relationships?include_disabled=true",
        headers=auth_headers(viewer_token),
    )
    assert any(r["id"] == rel_id for r in list_resp.json()["relationships"])


async def test_delete_relationship(client, admin_token, viewer_token):
    """DELETE /api/relationships/{id} permanently removes the relationship."""
    create_resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "c", "source_schema": "s", "source_table": "del_src",
            "target_catalog": "c", "target_schema": "s", "target_table": "del_tgt",
            "join_condition": "del_src.id = del_tgt.src_id",
        },
        headers=auth_headers(admin_token),
    )
    rel_id = create_resp.json()["relationship"]["id"]

    resp = await client.delete(
        f"/api/relationships/{rel_id}",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200

    # Should be gone
    get_resp = await client.get(
        f"/api/relationships/{rel_id}",
        headers=auth_headers(viewer_token),
    )
    assert get_resp.status_code == 404


async def test_delete_requires_admin(client, viewer_token, admin_token):
    """DELETE /api/relationships/{id} requires admin."""
    create_resp = await client.post(
        "/api/relationships",
        json={
            "source_catalog": "c", "source_schema": "s", "source_table": "perm_src",
            "target_catalog": "c", "target_schema": "s", "target_table": "perm_tgt",
            "join_condition": "perm_src.id = perm_tgt.src_id",
        },
        headers=auth_headers(admin_token),
    )
    rel_id = create_resp.json()["relationship"]["id"]

    resp = await client.delete(
        f"/api/relationships/{rel_id}",
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Graph Traversal
# ---------------------------------------------------------------------------

async def test_join_path(client, admin_token, viewer_token):
    """GET /api/relationships/graph/path finds multi-hop join paths."""
    # Create chain: lineitem -> orders -> customer
    await client.post(
        "/api/relationships",
        json={
            "source_catalog": "t", "source_schema": "s", "source_table": "lineitem",
            "target_catalog": "t", "target_schema": "s", "target_table": "orders",
            "join_condition": "lineitem.orderkey = orders.orderkey",
            "relationship_type": "1:N",
        },
        headers=auth_headers(admin_token),
    )
    await client.post(
        "/api/relationships",
        json={
            "source_catalog": "t", "source_schema": "s", "source_table": "orders",
            "target_catalog": "t", "target_schema": "s", "target_table": "customer",
            "join_condition": "orders.custkey = customer.custkey",
            "relationship_type": "N:1",
        },
        headers=auth_headers(admin_token),
    )

    # Find path from lineitem to customer (2-hop)
    resp = await client.get(
        "/api/relationships/graph/path?tables=t.s.lineitem,t.s.customer",
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["join_paths"]) == 2
    # BFS traversal order depends on set iteration order — check all tables appear across paths
    all_paths = " ".join(body["join_paths"])
    assert "lineitem" in all_paths
    assert "orders" in all_paths
    assert "customer" in all_paths


async def test_join_path_requires_two_tables(client, viewer_token):
    """GET /api/relationships/graph/path requires at least 2 tables."""
    resp = await client.get(
        "/api/relationships/graph/path?tables=t.s.orders",
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Background Jobs (Infer / Mine)
# ---------------------------------------------------------------------------

async def test_trigger_inference(client, admin_token):
    """POST /api/relationships/infer returns 200 (runs in background)."""
    resp = await client.post(
        "/api/relationships/infer",
        json={"catalog": "tpch"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_trigger_mining(client, admin_token):
    """POST /api/relationships/mine returns 200 (runs in background)."""
    resp = await client.post(
        "/api/relationships/mine",
        json={"limit": 100},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_inference_requires_admin(client, viewer_token):
    """POST /api/relationships/infer requires admin role."""
    resp = await client.post(
        "/api/relationships/infer",
        json={"catalog": "tpch"},
        headers=auth_headers(viewer_token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Bulk Description Import (new endpoint)
# ---------------------------------------------------------------------------

async def test_bulk_description_import(client, admin_token):
    """POST /api/metadata/descriptions/bulk upserts multiple descriptions."""
    resp = await client.post(
        "/api/metadata/descriptions/bulk",
        json={
            "descriptions": [
                {"catalog": "tpch", "schema_name": "tiny", "table_name": "orders", "description": "Customer orders"},
                {"catalog": "tpch", "schema_name": "tiny", "table_name": "customer", "description": "Customer master data"},
                {"catalog": "tpch", "schema_name": "tiny", "table_name": "lineitem", "column_name": "quantity", "description": "Quantity ordered"},
            ]
        },
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["total"] == 3
    assert body["created"] + body["updated"] == 3
