# SPDX-License-Identifier: AGPL-3.0-only
"""
Predictive Intelligence Service — outcome-driven ML predictions.

Users pick what they want to predict (forecast/classify/estimate), choose
a data source (KPI or SQL), and the system handles model selection, data
quality checks, training, and output table creation automatically.

Predictions are stored in prediction_data schema and registered with FAISS
so they are queryable via the NL→SQL chat interface.
"""

import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog
from sqlalchemy import text

from app.config import settings
from app.database import db_manager

logger = structlog.get_logger(__name__)

# Trino type → Postgres type mapping (reused from kpi_service pattern)
_TRINO_TYPE_MAP = {
    "varchar": "TEXT", "char": "TEXT", "varbinary": "BYTEA",
    "boolean": "BOOLEAN", "tinyint": "SMALLINT", "smallint": "SMALLINT",
    "integer": "INTEGER", "bigint": "BIGINT", "real": "REAL",
    "double": "DOUBLE PRECISION", "decimal": "NUMERIC",
    "date": "DATE", "time": "TIME", "timestamp": "TIMESTAMP",
    "interval": "INTERVAL", "json": "JSONB", "uuid": "UUID",
    "array": "JSONB", "map": "JSONB", "row": "JSONB",
}


def _sanitize_name(name: str) -> str:
    """Convert a name to a valid Postgres identifier."""
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name[:55]


def _pg_type(trino_type_str: str) -> str:
    base = trino_type_str.lower().split("(")[0].strip()
    return _TRINO_TYPE_MAP.get(base, "TEXT")


def _sanitize_column_name(name: str, index: int = 0) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    return clean[:63] or f"col_{index}"


# -------------------------------------------------------------------------
# WORKER REGISTRY — maps model_type to config URL
# -------------------------------------------------------------------------

def _get_worker_urls() -> Dict[str, str]:
    return {
        "xgboost": settings.prediction_worker_xgboost_url,
        "lightgbm": settings.prediction_worker_lightgbm_url,
        "autogluon": settings.prediction_worker_autogluon_url,
    }


class PredictionService:
    """Outcome-driven prediction pipelines with auto model selection."""

    # ------------------------------------------------------------------
    # WORKER HEALTH & CAPABILITIES
    # ------------------------------------------------------------------

    async def get_healthy_workers(self) -> Dict[str, Dict[str, Any]]:
        """Health-check all worker endpoints, return only healthy ones."""
        worker_urls = _get_worker_urls()
        healthy = {}

        async def check(model_type: str, base_url: str):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        f"{base_url}/health",
                        timeout=settings.prediction_worker_health_timeout,
                    )
                    if resp.status_code == 200:
                        healthy[model_type] = resp.json()
            except Exception:
                pass  # Worker not available

        await asyncio.gather(*[check(mt, url) for mt, url in worker_urls.items()])
        return healthy

    async def get_capabilities(self) -> Dict[str, Any]:
        """Return available prediction types based on healthy workers."""
        healthy = await self.get_healthy_workers()
        available_types = set()
        for info in healthy.values():
            for tt in info.get("task_types", []):
                available_types.add(tt)

        # Map task_types to user-facing prediction types
        type_map = {
            "forecast": "forecasting" in available_types or "regression" in available_types,
            "classify": "classification" in available_types,
            "estimate": "regression" in available_types,
            "detect": "classification" in available_types or "regression" in available_types,
        }
        return {
            "prediction_types": {k: v for k, v in type_map.items() if v},
            "healthy_workers": {k: v for k, v in healthy.items()},
        }

    # ------------------------------------------------------------------
    # AUTO MODEL SELECTION
    # ------------------------------------------------------------------

    async def select_model(
        self, prediction_type: str, row_count: int
    ) -> Optional[Dict[str, Any]]:
        """Auto-select the best model based on prediction type and data size."""
        healthy = await self.get_healthy_workers()

        if prediction_type == "forecast":
            model_type = "autogluon" if "autogluon" in healthy else "xgboost"
            task_type = "forecasting" if model_type == "autogluon" else "regression"
        elif prediction_type == "classify":
            model_type = "lightgbm" if row_count > 100_000 and "lightgbm" in healthy else "xgboost"
            task_type = "classification"
        elif prediction_type == "estimate":
            model_type = "lightgbm" if row_count > 100_000 and "lightgbm" in healthy else "xgboost"
            task_type = "regression"
        elif prediction_type == "detect":
            model_type = "xgboost"
            task_type = "anomaly_detection"
        else:
            return None

        if model_type not in healthy:
            # Fallback: try any available worker
            for mt in healthy:
                model_type = mt
                break
            else:
                return None

        # Fetch the system model record
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, name, model_type, category, task_type, default_params, worker_endpoint
                    FROM nexus.prediction_models
                    WHERE model_type = :model_type AND task_type = :task_type AND is_system = true
                    LIMIT 1
                """),
                {"model_type": model_type, "task_type": task_type},
            )
            row = result.fetchone()

        if not row:
            return None

        return {
            "id": str(row.id),
            "name": row.name,
            "model_type": row.model_type,
            "category": row.category,
            "task_type": row.task_type,
            "default_params": row.default_params or {},
            "worker_endpoint": row.worker_endpoint,
        }

    # ------------------------------------------------------------------
    # DATA QUALITY GATE
    # ------------------------------------------------------------------

    async def analyze_data(
        self,
        prediction_type: str,
        source_type: str,
        source_kpi_id: Optional[str] = None,
        source_sql: Optional[str] = None,
        target_column: Optional[str] = None,
        forecast_horizon: int = 30,
    ) -> Dict[str, Any]:
        """Analyze data quality and return recommendations."""
        # Fetch data sample
        if source_type == "kpi":
            data_result = await self._fetch_kpi_data(source_kpi_id)
        else:
            data_result = await self._execute_trino_query(source_sql)

        if not data_result.get("success"):
            return {"success": False, "error": data_result.get("error", "Failed to fetch data")}

        columns = data_result["columns"]
        rows = data_result["rows"]
        row_count = len(rows)
        col_names = [c["name"] for c in columns]

        blocking = []
        warnings = []

        # --- Blocking checks ---
        if prediction_type == "forecast":
            min_rows = forecast_horizon * 2
            if row_count < min_rows:
                blocking.append(
                    f"Need at least {min_rows} data points to forecast {forecast_horizon} days ahead. "
                    f"Your data has {row_count}."
                )
        elif prediction_type in ("classify", "estimate"):
            if row_count < 1000:
                blocking.append(
                    f"Need at least 1,000 rows for {prediction_type}. Your data has {row_count}."
                )

        # Check target column exists
        if target_column and target_column not in col_names:
            blocking.append(f"Target column '{target_column}' not found in data. Available: {', '.join(col_names)}")

        # Check target column missing values
        if target_column and target_column in col_names:
            col_idx = col_names.index(target_column)
            missing = sum(1 for r in rows if r[col_idx] is None)
            missing_pct = (missing / row_count * 100) if row_count > 0 else 0
            if missing_pct > 50:
                blocking.append(
                    f"The column '{target_column}' is missing in {missing_pct:.0f}% of rows."
                )

            # Class imbalance check for classification
            if prediction_type == "classify" and row_count > 0:
                values = [r[col_idx] for r in rows if r[col_idx] is not None]
                unique_vals = set(values)
                if len(unique_vals) <= 2:
                    min_class_count = min(values.count(v) for v in unique_vals) if unique_vals else 0
                    if min_class_count < 50:
                        blocking.append(
                            f"Only {min_class_count} rows match the minority class. "
                            f"Need at least 50 examples of each outcome."
                        )
                    elif min_class_count / len(values) < 0.10:
                        warnings.append(
                            f"Only {min_class_count / len(values) * 100:.0f}% of rows are in the minority class. "
                            f"Predictions may over-predict the majority class."
                        )

        # --- Warning checks ---
        for i, col in enumerate(columns):
            if col["name"] == target_column:
                continue
            missing = sum(1 for r in rows if r[i] is None)
            missing_pct = (missing / row_count * 100) if row_count > 0 else 0
            if missing_pct > 30:
                warnings.append(
                    f"Column '{col['name']}' is missing in {missing_pct:.0f}% of rows. This may reduce accuracy."
                )

        if prediction_type in ("classify", "estimate") and 1000 <= row_count < 5000:
            warnings.append("Limited data. Predictions may not be very accurate.")

        # Detect time-aggregated data used for classify/estimate
        if prediction_type in ("classify", "estimate"):
            time_cols = [c for c in columns if any(t in c["type"].lower() for t in ("timestamp", "date", "time"))]
            non_time_non_numeric = [c for c in columns if c["type"].lower() in ("varchar", "text", "char") and c["name"].lower() not in ("collected_at",)]
            if time_cols and not non_time_non_numeric:
                warnings.append(
                    "This data appears to be time-aggregated (no entity identifiers like customer_id or product_name). "
                    "Classification and estimation work best with entity-level data — one row per customer, product, or transaction. "
                    "Consider using a custom SQL query to build a feature table with entity-level rows."
                )

        # Auto-detect target column if not specified (before feature detection)
        recommended_target = None
        if not target_column:
            recommended_target = self._recommend_target(columns, rows, prediction_type)

        # Auto-detect features (exclude target or recommended target)
        effective_target = target_column or recommended_target
        recommended_features = self._detect_features(columns, rows, effective_target)

        status = "error" if blocking else ("warning" if warnings else "good")

        return {
            "success": True,
            "status": status,
            "row_count": row_count,
            "columns": [{"name": c["name"], "type": c["type"]} for c in columns],
            "blocking": blocking,
            "warnings": warnings,
            "recommended_target": recommended_target,
            "recommended_features": recommended_features,
            "preview_rows": rows[:10],
        }

    def _detect_features(
        self, columns: List[Dict], rows: List, target_column: Optional[str]
    ) -> List[Dict[str, str]]:
        """Auto-detect useful feature columns."""
        features = []
        col_names = [c["name"] for c in columns]

        for i, col in enumerate(columns):
            name = col["name"]
            ctype = col["type"].lower()

            # Skip target, timestamps, and likely ID columns
            if name == target_column:
                continue
            if any(t in ctype for t in ("timestamp", "date", "time")):
                continue

            # Check for ID-like columns (high cardinality + unique-ish)
            values = [r[i] for r in rows if r[i] is not None]
            if not values:
                continue
            unique_count = len(set(values))
            if unique_count > 0.95 * len(values) and len(values) > 100:
                continue  # Likely an ID column

            # Categoricals with too many values are noisy
            if ctype in ("varchar", "text") and unique_count > 50:
                continue

            reason = "numeric column" if ctype in ("integer", "bigint", "real", "double", "decimal", "numeric", "smallint") else "categorical column"
            features.append({"name": name, "reason": reason, "selected": True})

        return features

    def _recommend_target(
        self, columns: List[Dict], rows: List, prediction_type: str
    ) -> Optional[str]:
        """Recommend a target column based on prediction type."""
        col_names = [c["name"] for c in columns]

        for i, col in enumerate(columns):
            ctype = col["type"].lower()
            name = col["name"]

            if prediction_type == "forecast":
                # Look for a numeric non-timestamp column
                if ctype in ("integer", "bigint", "real", "double", "decimal", "numeric") and "id" not in name.lower():
                    return name

            elif prediction_type == "classify":
                # Look for binary/boolean columns
                if ctype == "boolean":
                    return name
                values = [r[i] for r in rows if r[i] is not None]
                if values and len(set(values)) <= 2:
                    return name

            elif prediction_type == "estimate":
                if ctype in ("integer", "bigint", "real", "double", "decimal", "numeric") and "id" not in name.lower():
                    return name

        return None

    # ------------------------------------------------------------------
    # PIPELINE CRUD
    # ------------------------------------------------------------------

    async def create_pipeline(
        self,
        name: str,
        prediction_type: str,
        source_type: str,
        target_column: Optional[str],
        owner_user_id: str,
        source_kpi_id: Optional[str] = None,
        source_sql: Optional[str] = None,
        feature_columns: Optional[List[str]] = None,
        output_columns: Optional[List[str]] = None,
        forecast_horizon: Optional[int] = None,
        trigger_mode: str = "after_kpi_collection",
        schedule_hours: int = 24,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a prediction pipeline with auto model selection."""
        # Fetch row count for model selection
        if source_type == "kpi":
            data_result = await self._fetch_kpi_data(source_kpi_id)
        else:
            data_result = await self._execute_trino_query(source_sql)

        row_count = len(data_result.get("rows", [])) if data_result.get("success") else 0

        # Auto-select model
        model = await self.select_model(prediction_type, row_count)
        if not model:
            raise ValueError("No prediction worker available for this prediction type. Check that workers are deployed.")

        output_table = f"pred_{_sanitize_name(name)}"
        now = datetime.utcnow()
        next_run = None
        if trigger_mode == "scheduled":
            next_run = now + timedelta(hours=schedule_hours)

        async with db_manager.get_session() as session:
            # Ensure unique output table
            for attempt in range(10):
                candidate = output_table if attempt == 0 else f"{output_table}_{attempt}"
                exists = await session.execute(
                    text("SELECT 1 FROM nexus.prediction_pipelines WHERE output_table = :t"),
                    {"t": candidate},
                )
                if not exists.fetchone():
                    output_table = candidate
                    break
            else:
                raise ValueError(f"Could not generate unique table name after 10 attempts")

            result = await session.execute(
                text("""
                    INSERT INTO nexus.prediction_pipelines (
                        name, description, prediction_type, model_id,
                        source_type, source_kpi_id, source_sql,
                        target_column, feature_columns, output_columns,
                        forecast_horizon, output_table, trigger_mode, schedule_hours,
                        is_active, owner_user_id, next_run_at
                    ) VALUES (
                        :name, :description, :prediction_type, CAST(:model_id AS UUID),
                        :source_type, CAST(:source_kpi_id AS UUID), :source_sql,
                        :target_column, :feature_columns, :output_columns,
                        :forecast_horizon, :output_table, :trigger_mode, :schedule_hours,
                        true, CAST(:owner_user_id AS UUID), :next_run_at
                    )
                    RETURNING id, created_at
                """),
                {
                    "name": name,
                    "description": description,
                    "prediction_type": prediction_type,
                    "model_id": model["id"],
                    "source_type": source_type,
                    "source_kpi_id": source_kpi_id,
                    "source_sql": source_sql,
                    "target_column": target_column,
                    "feature_columns": feature_columns,
                    "output_columns": output_columns,
                    "forecast_horizon": forecast_horizon,
                    "output_table": output_table,
                    "trigger_mode": trigger_mode,
                    "schedule_hours": schedule_hours,
                    "owner_user_id": owner_user_id,
                    "next_run_at": next_run,
                },
            )
            row = result.fetchone()
            await session.commit()

        return {
            "id": str(row.id),
            "name": name,
            "prediction_type": prediction_type,
            "model": model["name"],
            "output_table": output_table,
            "created_at": row.created_at.isoformat(),
        }

    async def list_pipelines(self, owner_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        pp.*, pm.name AS model_name, pm.model_type, pm.category,
                        u.username AS owner_username,
                        kd.name AS kpi_name
                    FROM nexus.prediction_pipelines pp
                    LEFT JOIN nexus.prediction_models pm ON pm.id = pp.model_id
                    LEFT JOIN nexus.users u ON u.id = pp.owner_user_id
                    LEFT JOIN nexus.kpi_definitions kd ON kd.id = pp.source_kpi_id
                    WHERE (:filter_owner = FALSE OR pp.owner_user_id = CAST(:owner_user_id AS UUID))
                    ORDER BY pp.created_at DESC
                """),
                {
                    "filter_owner": owner_user_id is not None,
                    "owner_user_id": owner_user_id or "00000000-0000-0000-0000-000000000000",
                },
            )
            return [self._pipeline_to_dict(r) for r in result.fetchall()]

    async def get_pipeline(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        pp.*, pm.name AS model_name, pm.model_type, pm.category,
                        u.username AS owner_username,
                        kd.name AS kpi_name
                    FROM nexus.prediction_pipelines pp
                    LEFT JOIN nexus.prediction_models pm ON pm.id = pp.model_id
                    LEFT JOIN nexus.users u ON u.id = pp.owner_user_id
                    LEFT JOIN nexus.kpi_definitions kd ON kd.id = pp.source_kpi_id
                    WHERE pp.id = :pipeline_id
                """),
                {"pipeline_id": pipeline_id},
            )
            row = result.fetchone()
        if not row:
            return None
        return self._pipeline_to_dict(row)

    _UPDATE_COLUMN_MAP = {
        "name": "name = :name",
        "description": "description = :description",
        "trigger_mode": "trigger_mode = :trigger_mode",
        "schedule_hours": "schedule_hours = :schedule_hours",
        "is_active": "is_active = :is_active",
        "feature_columns": "feature_columns = :feature_columns",
        "output_columns": "output_columns = :output_columns",
        "forecast_horizon": "forecast_horizon = :forecast_horizon",
    }

    async def update_pipeline(
        self, pipeline_id: str, owner_user_id: str, updates: Dict[str, Any], is_admin: bool = False
    ) -> Optional[Dict[str, Any]]:
        allowed = set(self._UPDATE_COLUMN_MAP.keys())
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if not filtered:
            return await self.get_pipeline(pipeline_id)

        if "schedule_hours" in filtered and filtered.get("trigger_mode", "") == "scheduled":
            filtered["next_run_at"] = datetime.utcnow() + timedelta(hours=filtered["schedule_hours"])

        set_clauses = ["updated_at = NOW()"]
        params: Dict[str, Any] = {"pipeline_id": pipeline_id, "owner_user_id": owner_user_id}
        for key, value in filtered.items():
            clause = self._UPDATE_COLUMN_MAP.get(key)
            if not clause:
                continue
            params[key] = value
            set_clauses.append(clause)

        update_sql = f"UPDATE nexus.prediction_pipelines SET {', '.join(set_clauses)}"
        async with db_manager.get_session() as session:
            if is_admin:
                result = await session.execute(
                    text(f"{update_sql} WHERE id = :pipeline_id RETURNING id"), params,
                )
            else:
                result = await session.execute(
                    text(f"{update_sql} WHERE id = :pipeline_id AND owner_user_id = CAST(:owner_user_id AS UUID) RETURNING id"),
                    params,
                )
            row = result.fetchone()
            await session.commit()

        if not row:
            return None
        return await self.get_pipeline(pipeline_id)

    async def delete_pipeline(self, pipeline_id: str, owner_user_id: str, is_admin: bool = False) -> bool:
        pipeline = await self.get_pipeline(pipeline_id)

        async with db_manager.get_session() as session:
            if is_admin:
                result = await session.execute(
                    text("DELETE FROM nexus.prediction_pipelines WHERE id = :pid RETURNING id"),
                    {"pid": pipeline_id},
                )
            else:
                result = await session.execute(
                    text("""
                        DELETE FROM nexus.prediction_pipelines
                        WHERE id = :pid AND owner_user_id = CAST(:uid AS UUID)
                        RETURNING id
                    """),
                    {"pid": pipeline_id, "uid": owner_user_id},
                )
            deleted = result.fetchone() is not None
            await session.commit()

        if deleted and pipeline and pipeline.get("output_table"):
            await self._drop_output_table(pipeline["output_table"])

        return deleted

    # ------------------------------------------------------------------
    # TRAINING & PREDICTION
    # ------------------------------------------------------------------

    async def train_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """Train a pipeline: fetch data → send to worker → store results."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return {"success": False, "error": "Pipeline not found"}

        # Update status to training
        await self._update_status(pipeline_id, "training")

        # Create run record
        run_id = await self._create_run(pipeline_id)

        try:
            # Build training SQL
            training_sql = await self._get_training_sql(pipeline)
            if not training_sql:
                error = "Could not build training query — KPI not found or no materialized table"
                await self._complete_run(run_id, "failed", error=error)
                await self._update_status(pipeline_id, "failed", error=error)
                return {"success": False, "error": error}

            # Get worker endpoint from model
            async with db_manager.get_session() as session:
                result = await session.execute(
                    text("SELECT worker_endpoint, task_type FROM nexus.prediction_models WHERE id = :mid"),
                    {"mid": pipeline["model_id"]},
                )
                model_row = result.fetchone()

            if not model_row:
                error = "Model configuration not found"
                await self._complete_run(run_id, "failed", error=error)
                await self._update_status(pipeline_id, "failed", error=error)
                return {"success": False, "error": error}

            # Determine task type
            task_type = model_row.task_type
            if pipeline["prediction_type"] == "forecast":
                task_type = "forecasting"
            elif pipeline["prediction_type"] == "classify":
                task_type = "classification"
            elif pipeline["prediction_type"] == "detect":
                task_type = "anomaly_detection"

            # Build payload — workers read credentials from their own env vars
            payload = {
                "sql": training_sql,
                "target_column": pipeline["target_column"],
                "feature_columns": pipeline.get("feature_columns") or [],
                "output_columns": pipeline.get("output_columns") or [],
                "task_type": task_type,
                "params": pipeline.get("training_params") or {},
                "output_table": pipeline["output_table"],
                "output_schema": "prediction_data",
            }

            if pipeline["prediction_type"] == "forecast":
                payload["forecast_horizon"] = pipeline.get("forecast_horizon", 30)

            # Send to worker — worker handles data loading, training, and writing predictions
            worker_headers = {}
            if settings.prediction_worker_secret:
                worker_headers["X-Worker-Secret"] = settings.prediction_worker_secret
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{model_row.worker_endpoint}/train",
                    json=payload,
                    headers=worker_headers,
                    timeout=settings.prediction_worker_timeout,
                )
                if resp.status_code != 200:
                    error = f"Worker returned {resp.status_code}: {resp.text[:500]}"
                    await self._complete_run(run_id, "failed", error=error)
                    await self._update_status(pipeline_id, "failed", error=error)
                    return {"success": False, "error": error}

                train_result = resp.json()

            # Worker wrote predictions directly to prediction_data.{output_table}
            # We just need to register with FAISS and update pipeline status
            pred_columns = train_result.get("prediction_columns", [])
            metrics = train_result.get("metrics", {})
            backtest = train_result.get("backtest", {})
            rows_predicted = train_result.get("row_count", 0)

            if pred_columns:
                await self._notify_faiss_add(pipeline["output_table"], pred_columns)

            # Generate business-friendly accuracy display
            accuracy_display = self._format_accuracy(
                pipeline["prediction_type"], metrics
            )

            # Update pipeline with results
            async with db_manager.get_session() as session:
                await session.execute(
                    text("""
                        UPDATE nexus.prediction_pipelines
                        SET status = 'ready',
                            last_trained_at = NOW(),
                            last_error = NULL,
                            accuracy_metrics = CAST(:metrics AS jsonb),
                            accuracy_display = :accuracy_display,
                            updated_at = NOW()
                        WHERE id = :pid
                    """),
                    {
                        "pid": pipeline_id,
                        "metrics": json.dumps(metrics),
                        "accuracy_display": accuracy_display,
                    },
                )
                # Update next_run_at for scheduled pipelines
                if pipeline["trigger_mode"] == "scheduled":
                    await session.execute(
                        text("""
                            UPDATE nexus.prediction_pipelines
                            SET next_run_at = NOW() + (:hours || ' hours')::interval
                            WHERE id = :pid
                        """),
                        {"pid": pipeline_id, "hours": pipeline.get("schedule_hours", 24)},
                    )
                await session.commit()

            await self._complete_run(run_id, "completed", rows_predicted=rows_predicted, metrics=metrics)

            logger.info(f"Pipeline {pipeline_id} trained: {rows_predicted} predictions, metrics={metrics}")
            return {
                "success": True,
                "pipeline_id": pipeline_id,
                "rows_predicted": rows_predicted,
                "metrics": metrics,
                "accuracy_display": accuracy_display,
                "backtest": backtest,
            }

        except Exception as exc:
            error_msg = str(exc)[:500]
            logger.error(f"Pipeline {pipeline_id} training failed: {error_msg}")
            await self._complete_run(run_id, "failed", error=error_msg)
            await self._update_status(pipeline_id, "failed", error=error_msg)
            return {"success": False, "error": error_msg}

    # ------------------------------------------------------------------
    # SCHEDULED SWEEP
    # ------------------------------------------------------------------

    async def process_due_pipelines(self) -> int:
        """Find pipelines with trigger_mode='scheduled' whose next_run_at has passed."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id FROM nexus.prediction_pipelines
                    WHERE is_active = TRUE
                      AND trigger_mode = 'scheduled'
                      AND next_run_at <= CURRENT_TIMESTAMP
                    ORDER BY next_run_at
                    LIMIT 5
                """)
            )
            due_ids = [str(r.id) for r in result.fetchall()]

        processed = 0
        for pid in due_ids:
            res = await self.train_pipeline(pid)
            if res.get("success"):
                processed += 1
        return processed

    async def trigger_kpi_linked_pipelines(self, kpi_id: str) -> int:
        """Trigger training for pipelines linked to a KPI (after_kpi_collection mode)."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id FROM nexus.prediction_pipelines
                    WHERE is_active = TRUE
                      AND source_type = 'kpi'
                      AND source_kpi_id = CAST(:kpi_id AS UUID)
                      AND trigger_mode = 'after_kpi_collection'
                """),
                {"kpi_id": kpi_id},
            )
            pipeline_ids = [str(r.id) for r in result.fetchall()]

        triggered = 0
        for pid in pipeline_ids:
            res = await self.train_pipeline(pid)
            if res.get("success"):
                triggered += 1
        return triggered

    # ------------------------------------------------------------------
    # RUN HISTORY
    # ------------------------------------------------------------------

    async def get_runs(self, pipeline_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, pipeline_id, status, started_at, completed_at,
                           rows_predicted, error, metrics
                    FROM nexus.prediction_runs
                    WHERE pipeline_id = :pid
                    ORDER BY started_at DESC
                    LIMIT :limit
                """),
                {"pid": pipeline_id, "limit": limit},
            )
            return [
                {
                    "id": str(r.id),
                    "pipeline_id": str(r.pipeline_id),
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "rows_predicted": r.rows_predicted,
                    "error": r.error,
                    "metrics": r.metrics,
                }
                for r in result.fetchall()
            ]

    # ------------------------------------------------------------------
    # PREDICTION RESULTS (query the output table)
    # ------------------------------------------------------------------

    async def get_prediction_results(self, pipeline_id: str, limit: int = 100) -> Dict[str, Any]:
        """Query the prediction output table and return results."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline or not pipeline.get("output_table"):
            return {"success": False, "error": "Pipeline not found or no output table"}

        table_name = pipeline["output_table"]

        # Query directly from Postgres (prediction_data schema)
        try:
            async with db_manager.get_session() as session:
                # First check table exists
                exists = await session.execute(
                    text("""
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'prediction_data' AND table_name = :t
                    """),
                    {"t": table_name},
                )
                if not exists.fetchone():
                    return {"success": False, "error": "Prediction output table not yet created. Train the pipeline first."}

                # Get column names
                col_result = await session.execute(
                    text("""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema = 'prediction_data' AND table_name = :t
                        ORDER BY ordinal_position
                    """),
                    {"t": table_name},
                )
                columns = [{"name": r.column_name, "type": r.data_type} for r in col_result.fetchall()]
                col_names = [c["name"] for c in columns]

                # Fetch rows
                result = await session.execute(
                    text(f'SELECT * FROM prediction_data."{table_name}" ORDER BY predicted_at DESC LIMIT :limit'),
                    {"limit": limit},
                )
                rows = []
                for r in result.fetchall():
                    row = {}
                    for i, col in enumerate(col_names):
                        val = r[i]
                        if val is not None and hasattr(val, 'isoformat'):
                            val = val.isoformat()
                        row[col] = val
                    rows.append(row)

            return {
                "success": True,
                "pipeline_id": pipeline_id,
                "output_table": table_name,
                "columns": columns,
                "rows": rows,
                "count": len(rows),
            }
        except Exception as e:
            return {"success": False, "error": str(e)[:500]}

    # ------------------------------------------------------------------
    # DATA FETCHING
    # ------------------------------------------------------------------

    async def _fetch_kpi_data(self, kpi_id: str) -> Dict[str, Any]:
        """Fetch all data from a KPI's materialized table via Trino."""
        from app.services.kpi_service import kpi_service

        kpi = await kpi_service.get_kpi(kpi_id)
        if not kpi or not kpi.get("materialized_table"):
            return {"success": False, "error": "KPI not found or no materialized table"}

        table_name = kpi["materialized_table"]
        sql = f'SELECT * FROM postgres.kpi_data."{table_name}" ORDER BY collected_at DESC'
        return await self._execute_trino_query(sql)

    async def _execute_trino_query(self, sql: str, max_rows: int = 10000) -> Dict[str, Any]:
        """Execute SQL via Trino and return columns + rows.
        Used for analyze/preview — samples up to max_rows.
        Training uses _get_trino_config() so workers read directly."""
        def _run():
            from trino.dbapi import connect
            from trino.auth import BasicAuthentication

            auth = None
            if settings.trino_password:
                auth = BasicAuthentication(settings.trino_user, settings.trino_password)

            conn_args = {
                "host": settings.trino_host,
                "port": settings.trino_port,
                "user": settings.trino_user,
                "catalog": settings.trino_catalog,
                "schema": settings.trino_schema,
                "http_scheme": "https" if settings.trino_ssl else "http",
                "request_timeout": settings.trino_execute_timeout_seconds,
            }
            if auth:
                conn_args["auth"] = auth
            if settings.trino_ssl:
                conn_args["verify"] = settings.trino_ssl_verify

            sql_clean = sql.strip().rstrip(";")
            conn = connect(**conn_args)
            cur = conn.cursor()
            cur.execute(sql_clean)
            rows = cur.fetchmany(max_rows)

            columns = []
            if cur.description:
                for desc in cur.description:
                    col_name = desc[0]
                    col_type = str(desc[1]) if desc[1] else "varchar"
                    columns.append({"name": col_name, "type": col_type})

            return columns, rows

        try:
            columns, rows = await asyncio.get_running_loop().run_in_executor(None, _run)
            return {"success": True, "columns": columns, "rows": rows}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Workers read Trino/Postgres credentials from their own environment
    # variables — no credentials are passed via HTTP.

    async def _get_training_sql(self, pipeline: Dict[str, Any]) -> Optional[str]:
        """Build the SQL query that the worker should run against Trino."""
        if pipeline["source_type"] == "sql":
            return pipeline["source_sql"]
        # KPI source — build SELECT from materialized table
        from app.services.kpi_service import kpi_service
        kpi = await kpi_service.get_kpi(pipeline["source_kpi_id"])
        if not kpi or not kpi.get("materialized_table"):
            return None
        table_name = kpi["materialized_table"]
        return f'SELECT * FROM postgres.kpi_data."{table_name}" ORDER BY collected_at DESC'

    # ------------------------------------------------------------------
    # OUTPUT TABLE MANAGEMENT
    # ------------------------------------------------------------------

    async def _create_output_table(self, table_name: str, columns: List[Dict[str, str]]) -> None:
        """Create prediction output table in prediction_data schema."""
        # Drop existing table first (predictions are replaced on retrain)
        async with db_manager.get_session() as session:
            await session.execute(text(f'DROP TABLE IF EXISTS prediction_data."{table_name}"'))
            await session.commit()

        col_defs = [f'"{_sanitize_column_name(c["name"], i)}" {c.get("pg_type", "TEXT")}' for i, c in enumerate(columns)]
        col_defs.append("predicted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
        ddl = f'CREATE TABLE IF NOT EXISTS prediction_data."{table_name}" ({", ".join(col_defs)})'

        async with db_manager.get_session() as session:
            await session.execute(text(ddl))
            await session.execute(text(
                f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_predicted_at" '
                f'ON prediction_data."{table_name}" (predicted_at DESC)'
            ))
            await session.commit()
        logger.info(f"Created prediction output table prediction_data.{table_name}")

    async def _insert_predictions(
        self, table_name: str, columns: List[Dict[str, str]], rows: list
    ) -> None:
        if not rows:
            return

        col_names = [f'"{_sanitize_column_name(c["name"], i)}"' for i, c in enumerate(columns)]
        col_names.append("predicted_at")
        placeholders = [f":c{i}" for i in range(len(columns))]
        placeholders.append("CURRENT_TIMESTAMP")

        insert_sql = (
            f'INSERT INTO prediction_data."{table_name}" ({", ".join(col_names)}) '
            f'VALUES ({", ".join(placeholders)})'
        )

        async with db_manager.get_session() as session:
            for row in rows:
                params = {}
                for i, v in enumerate(row):
                    if isinstance(v, (dict, list)):
                        params[f"c{i}"] = json.dumps(v)
                    else:
                        params[f"c{i}"] = v
                await session.execute(text(insert_sql), params)
            await session.commit()

    async def _drop_output_table(self, table_name: str) -> None:
        try:
            async with db_manager.get_session() as session:
                await session.execute(text(f'DROP TABLE IF EXISTS prediction_data."{table_name}"'))
                await session.commit()
            logger.info(f"Dropped prediction table prediction_data.{table_name}")
            await self._notify_faiss_remove(table_name)
        except Exception as exc:
            logger.error(f"Failed to drop prediction table {table_name}: {exc}")

    # ------------------------------------------------------------------
    # FAISS REGISTRATION
    # ------------------------------------------------------------------

    async def _notify_faiss_add(self, table_name: str, columns: List[Dict[str, str]]) -> None:
        columns_for_schema = [
            f"{_sanitize_column_name(c['name'], i)}|{c.get('pg_type', 'text').lower()}"
            for i, c in enumerate(columns)
        ]
        columns_for_schema.append("predicted_at|timestamp")

        table_metadata = {
            "catalog": "postgres",
            "schema": "prediction_data",
            "table": table_name,
            "full_name": f"postgres.prediction_data.{table_name}",
            "columns": columns_for_schema,
            "type": "TABLE",
        }

        headers = {}
        if settings.schema_service_key:
            headers["X-Service-Key"] = settings.schema_service_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.schema_service_url}/table/add",
                    json=table_metadata,
                    headers=headers,
                    timeout=30.0,
                )
                if response.status_code == 200:
                    logger.info(f"FAISS: registered prediction_data.{table_name}")
                else:
                    logger.warning(f"FAISS add failed: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"FAISS add error for prediction_data.{table_name}: {e}")

    async def _notify_faiss_remove(self, table_name: str) -> None:
        headers = {}
        if settings.schema_service_key:
            headers["X-Service-Key"] = settings.schema_service_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{settings.schema_service_url}/table/postgres/prediction_data/{table_name}",
                    headers=headers,
                    timeout=30.0,
                )
                if response.status_code == 200:
                    logger.info(f"FAISS: deregistered prediction_data.{table_name}")
                else:
                    logger.warning(f"FAISS remove failed: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"FAISS remove error for prediction_data.{table_name}: {e}")

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------

    async def _update_status(self, pipeline_id: str, status: str, error: Optional[str] = None) -> None:
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.prediction_pipelines
                    SET status = :status, last_error = :error, updated_at = NOW()
                    WHERE id = :pid
                """),
                {"pid": pipeline_id, "status": status, "error": error},
            )
            await session.commit()

    async def _create_run(self, pipeline_id: str) -> str:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    INSERT INTO nexus.prediction_runs (pipeline_id, status)
                    VALUES (:pid, 'running')
                    RETURNING id
                """),
                {"pid": pipeline_id},
            )
            run_id = str(result.fetchone().id)
            await session.commit()
        return run_id

    async def _complete_run(
        self,
        run_id: str,
        status: str,
        rows_predicted: int = 0,
        error: Optional[str] = None,
        metrics: Optional[Dict] = None,
    ) -> None:
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.prediction_runs
                    SET status = :status,
                        completed_at = NOW(),
                        rows_predicted = :rows_predicted,
                        error = :error,
                        metrics = CAST(:metrics AS jsonb)
                    WHERE id = :rid
                """),
                {
                    "rid": run_id,
                    "status": status,
                    "rows_predicted": rows_predicted,
                    "error": error,
                    "metrics": json.dumps(metrics) if metrics else None,
                },
            )
            await session.commit()

    def _format_accuracy(self, prediction_type: str, metrics: Dict[str, Any]) -> str:
        """Convert raw ML metrics to business-friendly text."""
        if not metrics:
            return "Accuracy not yet available"

        if prediction_type == "forecast":
            mape = metrics.get("mape")
            if mape is not None:
                pct = round(mape * 100, 1) if mape < 1 else round(mape, 1)
                return f"Predictions are typically within ±{pct}% of actual values"
            mae = metrics.get("mae")
            if mae is not None:
                return f"Predictions are typically within ±{mae:,.0f} of actual values"

        elif prediction_type == "classify":
            recall = metrics.get("recall")
            precision = metrics.get("precision")
            if recall is not None and precision is not None:
                recall_pct = round(recall * 100) if recall <= 1 else round(recall)
                precision_pct = round(precision * 100) if precision <= 1 else round(precision)
                return (
                    f"Correctly identifies {recall_pct}% of positive cases. "
                    f"For every 10 alerts, {round(precision_pct / 10)} are correct."
                )
            f1 = metrics.get("f1")
            if f1 is not None:
                return f"Overall accuracy score: {round(f1 * 100)}%"

        elif prediction_type == "estimate":
            mape = metrics.get("mape")
            if mape is not None:
                pct = round(mape * 100, 1) if mape < 1 else round(mape, 1)
                return f"Estimates are typically within ±{pct}% of actual values"
            mae = metrics.get("mae")
            if mae is not None:
                return f"Estimates are typically within ±{mae:,.0f} of actual values"

        elif prediction_type == "detect":
            anomaly_count = metrics.get("anomaly_count", 0)
            total = metrics.get("total_rows", 0)
            if total > 0:
                pct = round(anomaly_count / total * 100, 1)
                return f"Found {anomaly_count} anomalies ({pct}%) in {total:,} rows"
            return f"Found {anomaly_count} anomalies"

        return "Model trained successfully"

    def _pipeline_to_dict(self, row) -> Dict[str, Any]:
        return {
            "id": str(row.id),
            "name": row.name,
            "description": row.description,
            "prediction_type": row.prediction_type,
            "model_id": str(row.model_id) if row.model_id else None,
            "model_name": row.model_name if hasattr(row, "model_name") else None,
            "model_type": row.model_type if hasattr(row, "model_type") else None,
            "category": row.category if hasattr(row, "category") else None,
            "source_type": row.source_type,
            "source_kpi_id": str(row.source_kpi_id) if row.source_kpi_id else None,
            "kpi_name": row.kpi_name if hasattr(row, "kpi_name") else None,
            "source_sql": row.source_sql,
            "target_column": row.target_column,
            "feature_columns": row.feature_columns,
            "output_columns": row.output_columns if hasattr(row, "output_columns") else None,
            "forecast_horizon": row.forecast_horizon,
            "training_params": row.training_params or {},
            "output_table": row.output_table,
            "trigger_mode": row.trigger_mode,
            "schedule_hours": row.schedule_hours,
            "is_active": row.is_active,
            "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
            "owner_username": row.owner_username if hasattr(row, "owner_username") else None,
            "status": row.status,
            "last_trained_at": row.last_trained_at.isoformat() if row.last_trained_at else None,
            "last_error": row.last_error,
            "accuracy_metrics": row.accuracy_metrics,
            "accuracy_display": row.accuracy_display,
            "data_quality": row.data_quality,
            "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


prediction_service = PredictionService()
