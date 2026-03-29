"""Tests for health, root, metrics, and docs endpoints."""

import pytest
from unittest.mock import AsyncMock, patch


async def test_health_endpoint(test_client):
    """GET /health returns 200 with status 'healthy'."""
    resp = await test_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["service"] == "nexus"


async def test_root_endpoint(test_client):
    """GET / returns 200 with service information."""
    resp = await test_client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "Nexus"
    assert body["version"] == "1.0.0"
    assert body["status"] == "running"
    assert "api_docs" in body


async def test_metrics_endpoint(test_client):
    """GET /metrics returns 200."""
    with patch(
        "app.services.orchestration_service.orchestration_service.cache_service.get_stats",
        new_callable=AsyncMock,
        return_value={"hits": 0, "misses": 0},
    ), patch(
        "app.services.orchestration_service.orchestration_service.get_health_status",
        new_callable=AsyncMock,
        return_value={"status": "healthy", "services": []},
    ):
        resp = await test_client.get("/metrics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "nexus"
    assert "cache" in body


async def test_docs_endpoint(test_client):
    """GET /docs returns 200 (Swagger UI)."""
    resp = await test_client.get("/docs")
    assert resp.status_code == 200
