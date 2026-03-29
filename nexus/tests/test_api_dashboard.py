"""Tests for Dashboard API endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_dashboard(dashboard_id: str | None = None, title: str = "Test Dashboard"):
    """Return a dict that looks like a dashboard from the service layer."""
    return {
        "id": dashboard_id or str(uuid.uuid4()),
        "title": title,
        "description": "A test dashboard",
        "configuration": {},
        "layout_config": None,
        "tags": [],
        "is_public": False,
        "owner_user_id": str(uuid.uuid4()),
        "created_at": "2025-01-01T00:00:00",
        "updated_at": "2025-01-01T00:00:00",
    }


def _patch_get_current_user():
    """Patch get_current_user so it returns a fake user dict without hitting DB.

    This patches the dependency at the FastAPI level so both require_viewer
    and require_write_access (which both depend on get_current_user) are
    satisfied without a database round-trip.
    """
    fake_user = {
        "id": str(uuid.uuid4()),
        "username": "testuser",
        "email": "test@example.com",
        "roles": ["USER"],
    }
    return patch(
        "app.auth.dependencies.get_current_user",
        new_callable=AsyncMock,
        return_value=fake_user,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_list_dashboards(test_client, auth_headers):
    """GET /api/dashboards with auth returns 200."""
    mock_dashboards = [_mock_dashboard(), _mock_dashboard(title="Second")]

    with _patch_get_current_user(), patch(
        "app.api.dashboard_service.get_user_dashboards",
        new_callable=AsyncMock,
        return_value=mock_dashboards,
    ):
        resp = await test_client.get("/api/dashboards", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["dashboards"], list)
    assert len(body["dashboards"]) == 2


async def test_create_dashboard(test_client, auth_headers):
    """POST /api/dashboards with auth creates a dashboard (no paywall limit)."""
    new_dash = _mock_dashboard(title="My New Dashboard")

    with _patch_get_current_user(), patch(
        "app.api.dashboard_service.create_dashboard",
        new_callable=AsyncMock,
        return_value=new_dash,
    ):
        resp = await test_client.post(
            "/api/dashboards",
            headers=auth_headers,
            json={
                "title": "My New Dashboard",
                "description": "Created in test",
                "configuration": {},
                "is_public": False,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["dashboard"]["title"] == "My New Dashboard"
