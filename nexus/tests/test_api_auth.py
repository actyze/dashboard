"""Tests for authentication endpoints."""

import pytest


async def test_login_missing_credentials(test_client):
    """POST /api/auth/login with no body returns 422 (validation error)."""
    resp = await test_client.post("/api/auth/login")
    assert resp.status_code == 422


async def test_login_invalid_credentials(test_client):
    """POST /api/auth/login with wrong credentials returns 401."""
    from unittest.mock import AsyncMock, patch

    with patch(
        "app.api.user_service.authenticate_user",
        new_callable=AsyncMock,
        return_value={"success": False},
    ):
        resp = await test_client.post(
            "/api/auth/login",
            data={"username": "wrong", "password": "wrong"},
        )
    assert resp.status_code == 401


async def test_protected_endpoint_no_auth(test_client):
    """GET /api/dashboards without auth returns 401."""
    resp = await test_client.get("/api/dashboards")
    assert resp.status_code == 401
