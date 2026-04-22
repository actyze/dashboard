# SPDX-License-Identifier: AGPL-3.0-only
"""Integration tests for Predictive Intelligence API — CRUD, capabilities, data quality."""

from unittest.mock import AsyncMock, patch

import pytest
from .conftest import create_user, login, auth_headers


# Mock prediction workers globally — no real workers in CI
MOCK_HEALTHY_WORKERS = {
    "xgboost": {"status": "healthy", "model_type": "xgboost", "category": "tabular", "task_types": ["classification", "regression", "anomaly_detection"]},
    "lightgbm": {"status": "healthy", "model_type": "lightgbm", "category": "tabular", "task_types": ["classification", "regression"]},
}


@pytest.fixture(autouse=True)
def mock_prediction_workers():
    """Mock worker health checks — no real workers running in CI."""
    with patch(
        "app.services.prediction_service.prediction_service.get_healthy_workers",
        new_callable=AsyncMock,
        return_value=MOCK_HEALTHY_WORKERS,
    ):
        yield


@pytest.fixture
async def user_token(client, db_session):
    """Create a standard USER and return their auth token."""
    user = await create_user(db_session, username="pred_user", password="pass", roles=["USER"])
    return await login(client, user["username"], "pass")


@pytest.fixture
async def admin_token(client, db_session):
    """Create an ADMIN user and return their auth token."""
    user = await create_user(db_session, username="pred_admin", password="pass", roles=["ADMIN"])
    return await login(client, user["username"], "pass")


@pytest.fixture
async def readonly_token(client, db_session):
    """Create a READONLY user and return their auth token."""
    user = await create_user(db_session, username="pred_readonly", password="pass", roles=["READONLY"])
    return await login(client, user["username"], "pass")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def create_pipeline(client, token, **overrides):
    """Create a prediction pipeline and return the response body."""
    payload = {
        "name": "Test Pipeline",
        "prediction_type": "classify",
        "source_type": "sql",
        "source_sql": "SELECT 1 AS id, 'A' AS category, 100 AS value, 0 AS target",
        "target_column": "target",
        "trigger_mode": "manual",
        "train_now": False,
        **overrides,
    }
    resp = await client.post("/api/predictions/pipelines", json=payload, headers=auth_headers(token))
    assert resp.status_code == 200, f"Create pipeline failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Capabilities
# ---------------------------------------------------------------------------

async def test_capabilities_returns_prediction_types(client, user_token):
    """GET /api/predictions/capabilities returns available prediction types."""
    resp = await client.get("/api/predictions/capabilities", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    assert "prediction_types" in body
    assert "healthy_workers" in body


async def test_capabilities_unauthenticated(client):
    """GET /api/predictions/capabilities rejects unauthenticated requests."""
    resp = await client.get("/api/predictions/capabilities")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Pipeline CRUD
# ---------------------------------------------------------------------------

async def test_create_pipeline(client, user_token):
    """POST /api/predictions/pipelines creates a pipeline."""
    body = await create_pipeline(client, user_token, name="Revenue Forecast")
    assert body["name"] == "Revenue Forecast"
    assert "id" in body


async def test_create_pipeline_classify(client, user_token):
    """POST /api/predictions/pipelines creates a classification pipeline."""
    body = await create_pipeline(client, user_token, name="Churn Classifier", prediction_type="classify")
    assert body["name"] == "Churn Classifier"


async def test_create_pipeline_detect_no_target(client, user_token):
    """POST /api/predictions/pipelines creates a detect pipeline without target_column."""
    body = await create_pipeline(
        client, user_token,
        name="Anomaly Detector",
        prediction_type="detect",
        target_column=None,
    )
    assert body["name"] == "Anomaly Detector"


async def test_list_pipelines(client, user_token):
    """GET /api/predictions/pipelines returns created pipelines."""
    await create_pipeline(client, user_token, name="Pipeline A")
    await create_pipeline(client, user_token, name="Pipeline B")

    resp = await client.get("/api/predictions/pipelines", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    names = [p["name"] for p in body["pipelines"]]
    assert "Pipeline A" in names
    assert "Pipeline B" in names


async def test_get_pipeline_by_id(client, user_token):
    """GET /api/predictions/pipelines/{id} returns the pipeline."""
    created = await create_pipeline(client, user_token, name="Fetch Me")
    pipeline_id = created["id"]

    resp = await client.get(f"/api/predictions/pipelines/{pipeline_id}", headers=auth_headers(user_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Fetch Me"


async def test_get_pipeline_not_found(client, user_token):
    """GET /api/predictions/pipelines/{bad-id} returns 404."""
    resp = await client.get(
        "/api/predictions/pipelines/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 404


async def test_update_pipeline(client, user_token):
    """PUT /api/predictions/pipelines/{id} updates fields."""
    created = await create_pipeline(client, user_token, name="Before")
    pipeline_id = created["id"]

    resp = await client.put(
        f"/api/predictions/pipelines/{pipeline_id}",
        json={"name": "After", "trigger_mode": "scheduled", "schedule_hours": 12},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "After"
    assert body["trigger_mode"] == "scheduled"


async def test_delete_pipeline(client, user_token):
    """DELETE /api/predictions/pipelines/{id} removes the pipeline."""
    created = await create_pipeline(client, user_token, name="Delete Me")
    pipeline_id = created["id"]

    resp = await client.delete(f"/api/predictions/pipelines/{pipeline_id}", headers=auth_headers(user_token))
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    get_resp = await client.get(f"/api/predictions/pipelines/{pipeline_id}", headers=auth_headers(user_token))
    assert get_resp.status_code == 404


async def test_delete_pipeline_not_owned(client, db_session, user_token):
    """DELETE by a different user returns 404 (ownership check)."""
    created = await create_pipeline(client, user_token, name="Not Yours")
    pipeline_id = created["id"]

    other = await create_user(db_session, username="pred_other", password="pass", roles=["USER"])
    other_token = await login(client, other["username"], "pass")

    resp = await client.delete(f"/api/predictions/pipelines/{pipeline_id}", headers=auth_headers(other_token))
    assert resp.status_code == 404


async def test_admin_can_delete_any_pipeline(client, db_session, user_token, admin_token):
    """ADMIN can delete any user's pipeline."""
    created = await create_pipeline(client, user_token, name="Admin Delete")
    pipeline_id = created["id"]

    resp = await client.delete(f"/api/predictions/pipelines/{pipeline_id}", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

async def test_invalid_prediction_type(client, user_token):
    """Invalid prediction_type is rejected."""
    resp = await client.post(
        "/api/predictions/pipelines",
        json={
            "name": "Bad",
            "prediction_type": "invalid",
            "source_type": "sql",
            "source_sql": "SELECT 1",
            "target_column": "x",
        },
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 422


async def test_kpi_source_requires_kpi_id(client, user_token):
    """source_type=kpi without source_kpi_id is rejected."""
    resp = await client.post(
        "/api/predictions/pipelines",
        json={
            "name": "Bad",
            "prediction_type": "classify",
            "source_type": "kpi",
            "target_column": "x",
        },
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 400


async def test_sql_source_requires_sql(client, user_token):
    """source_type=sql without source_sql is rejected."""
    resp = await client.post(
        "/api/predictions/pipelines",
        json={
            "name": "Bad",
            "prediction_type": "classify",
            "source_type": "sql",
            "target_column": "x",
        },
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

async def test_readonly_can_list_pipelines(client, readonly_token, user_token):
    """READONLY users can view pipelines."""
    await create_pipeline(client, user_token, name="Visible")

    resp = await client.get("/api/predictions/pipelines", headers=auth_headers(readonly_token))
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1


async def test_readonly_cannot_create_pipeline(client, readonly_token):
    """READONLY users cannot create pipelines."""
    resp = await client.post(
        "/api/predictions/pipelines",
        json={
            "name": "Nope",
            "prediction_type": "classify",
            "source_type": "sql",
            "source_sql": "SELECT 1",
            "target_column": "x",
        },
        headers=auth_headers(readonly_token),
    )
    assert resp.status_code == 403


async def test_readonly_cannot_delete_pipeline(client, readonly_token, user_token):
    """READONLY users cannot delete pipelines."""
    created = await create_pipeline(client, user_token, name="Protected")
    resp = await client.delete(
        f"/api/predictions/pipelines/{created['id']}",
        headers=auth_headers(readonly_token),
    )
    assert resp.status_code == 403


async def test_readonly_cannot_train(client, readonly_token, user_token):
    """READONLY users cannot trigger training."""
    created = await create_pipeline(client, user_token, name="No Train")
    resp = await client.post(
        f"/api/predictions/pipelines/{created['id']}/train",
        headers=auth_headers(readonly_token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Run History
# ---------------------------------------------------------------------------

async def test_runs_empty(client, user_token):
    """GET /api/predictions/pipelines/{id}/runs returns empty list for new pipeline."""
    created = await create_pipeline(client, user_token, name="No Runs")
    resp = await client.get(
        f"/api/predictions/pipelines/{created['id']}/runs",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["runs"] == []


async def test_runs_not_found(client, user_token):
    """GET /api/predictions/pipelines/{bad-id}/runs returns 404."""
    resp = await client.get(
        "/api/predictions/pipelines/00000000-0000-0000-0000-000000000000/runs",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 404
