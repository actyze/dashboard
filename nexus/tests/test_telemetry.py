"""Tests for the TelemetryService."""

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.telemetry_service import TelemetryService


async def test_telemetry_disabled():
    """Telemetry does nothing when TELEMETRY_ENABLED=false."""
    svc = TelemetryService()

    with patch("app.services.telemetry_service.settings") as mock_settings:
        mock_settings.telemetry_enabled = False
        await svc.start()

    # No background task should have been created
    assert svc._task is None
    assert svc._running is False


async def test_telemetry_payload_format():
    """Verify the telemetry payload has the expected structure."""
    svc = TelemetryService()
    svc._instance_id = "test-instance-id-1234"

    mock_counts = {
        "dashboards": 5,
        "users": 3,
        "queries_30d": 42,
        "data_sources": 2,
    }

    captured_payload = {}

    async def fake_post(url, json=None):
        captured_payload.update(json)
        resp = MagicMock()
        resp.status_code = 200
        return resp

    with patch.object(svc, "_collect_counts", new_callable=AsyncMock, return_value=mock_counts), \
         patch("app.services.telemetry_service.httpx.AsyncClient") as mock_client_cls:

        mock_client = AsyncMock()
        mock_client.post = fake_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await svc._send_ping()

    # Verify top-level keys
    assert captured_payload["instance_id"] == "test-instance-id-1234"
    assert captured_payload["version"] == "1.0.0"
    assert captured_payload["deployment_method"] == "docker"
    assert "counts" in captured_payload
    assert "platform" in captured_payload
    assert "llm_provider" in captured_payload

    # Verify counts sub-structure
    counts = captured_payload["counts"]
    assert counts["dashboards"] == 5
    assert counts["users"] == 3

    # Verify platform sub-structure
    platform_info = captured_payload["platform"]
    assert "os" in platform_info
    assert "arch" in platform_info
