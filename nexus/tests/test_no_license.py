"""Verify the license system is completely removed from Nexus."""

import pytest


async def test_license_check_endpoint_gone(test_client):
    """GET /api/v1/license-check/status should return 404 (removed)."""
    resp = await test_client.get("/api/v1/license-check/status")
    assert resp.status_code == 404


async def test_license_current_endpoint_gone(test_client):
    """GET /api/v1/license/current should return 404 (removed)."""
    resp = await test_client.get("/api/v1/license/current")
    assert resp.status_code == 404


async def test_license_activate_endpoint_gone(test_client):
    """POST /api/v1/license/activate should return 404 (removed)."""
    resp = await test_client.post("/api/v1/license/activate", json={})
    assert resp.status_code == 404


def test_no_license_imports():
    """Verify that 'license' does not appear in main.py imports."""
    import pathlib

    main_py = pathlib.Path(__file__).resolve().parent.parent / "main.py"
    content = main_py.read_text()

    # Check import lines only (lines starting with 'from' or 'import')
    import_lines = [
        line for line in content.splitlines()
        if line.strip().startswith(("from ", "import "))
    ]

    for line in import_lines:
        assert "license" not in line.lower(), (
            f"Found license-related import in main.py: {line!r}"
        )
