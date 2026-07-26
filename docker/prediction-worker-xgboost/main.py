# SPDX-License-Identifier: AGPL-3.0-only
"""XGBoost Prediction Worker — handles classification, regression, and anomaly detection.
Reads data directly from Trino and writes predictions to Postgres.
Credentials are read from environment variables, not from HTTP requests."""

import time
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from config import get_trino_config, get_postgres_config, WORKER_SECRET
from models.xgboost_handler import XGBoostHandler
from models.isolation_forest_handler import IsolationForestHandler

# Import observability
from observability_init import (
    configure_logging,
    get_logger,
    setup_health_endpoints,
)
from observability.metrics import (
    MetricsContext,
    record_prediction,
    record_prediction_duration,
)

# Configure logging
configure_logging(service_name="prediction-worker-xgboost", log_level="INFO", log_format="json")
logger = get_logger(__name__)

app = FastAPI(title="Prediction Worker - XGBoost", version="1.0.0")
xgb_handler = XGBoostHandler()
anomaly_handler = IsolationForestHandler()

# Set up health endpoints and metrics
setup_health_endpoints(app, "prediction-worker-xgboost")


def verify_secret(x_worker_secret: str = Header(default="")):
    """Verify shared secret if configured."""
    if WORKER_SECRET and x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")


class TrainRequest(BaseModel):
    sql: str
    target_column: Optional[str] = None
    feature_columns: List[str] = []
    output_columns: List[str] = []
    task_type: str
    params: Optional[Dict[str, Any]] = None
    output_table: str
    output_schema: str = "prediction_data"
    forecast_horizon: Optional[int] = None


class PredictRequest(BaseModel):
    data: Dict[str, Any]
    model_id: Optional[str] = None


@app.post("/train")
async def train(req: TrainRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    start_time = time.time()
    try:
        with MetricsContext("POST", "/train") as ctx:
            trino_config = get_trino_config()
            postgres_config = get_postgres_config()

            if req.task_type == "anomaly_detection":
                result = anomaly_handler.train(
                    trino_config=trino_config,
                    postgres_config=postgres_config,
                    sql=req.sql,
                    output_columns=req.output_columns,
                    params=req.params or {},
                    output_table=req.output_table,
                    output_schema=req.output_schema,
                )
            else:
                result = xgb_handler.train(
                    trino_config=trino_config,
                    postgres_config=postgres_config,
                    sql=req.sql,
                    target_column=req.target_column,
                    feature_columns=req.feature_columns,
                    output_columns=req.output_columns,
                    task_type=req.task_type,
                    params=req.params or {},
                    output_table=req.output_table,
                    output_schema=req.output_schema,
                )

            # Record metrics
            duration = time.time() - start_time
            record_prediction("xgboost", status="success")
            record_prediction_duration("xgboost", duration)
            row_count = result.get("row_count", 0)
            logger.info(
                "training_completed",
                task_type=req.task_type,
                duration_s=duration,
                row_count=row_count,
                status="success",
            )
            ctx.set_status(200)
            return result
    except ValueError as e:
        duration = time.time() - start_time
        record_prediction("xgboost", status="error")
        record_prediction_duration("xgboost", duration)
        logger.error("training_validation_error", error=str(e), duration_s=duration)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        duration = time.time() - start_time
        record_prediction("xgboost", status="error")
        record_prediction_duration("xgboost", duration)
        logger.error("training_failed", error=str(e), duration_s=duration, exc_info=True)
        raise HTTPException(status_code=500, detail="Training failed. Check worker logs for details.")


@app.post("/predict")
async def predict(req: PredictRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    start_time = time.time()
    try:
        with MetricsContext("POST", "/predict") as ctx:
            result = xgb_handler.predict(
                columns=req.data["columns"],
                rows=req.data["rows"],
            )

            # Record metrics
            duration = time.time() - start_time
            record_prediction("xgboost", status="success")
            record_prediction_duration("xgboost", duration)
            logger.info(
                "prediction_completed",
                duration_s=duration,
                row_count=len(req.data["rows"]),
                status="success",
            )
            ctx.set_status(200)
            return result
    except ValueError as e:
        duration = time.time() - start_time
        record_prediction("xgboost", status="error")
        record_prediction_duration("xgboost", duration)
        logger.error("prediction_validation_error", error=str(e), duration_s=duration)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        duration = time.time() - start_time
        record_prediction("xgboost", status="error")
        record_prediction_duration("xgboost", duration)
        logger.error("prediction_failed", error=str(e), duration_s=duration, exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed. Check worker logs for details.")
