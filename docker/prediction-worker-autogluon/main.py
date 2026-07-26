# SPDX-License-Identifier: AGPL-3.0-only
"""AutoGluon TimeSeries Worker — reads from Trino, writes to Postgres.
Credentials are read from environment variables, not from HTTP requests."""

import time
import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from config import get_trino_config, get_postgres_config, WORKER_SECRET
from models.autogluon_handler import AutoGluonHandler

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
configure_logging(service_name="prediction-worker-autogluon", log_level="INFO", log_format="json")
logger = get_logger(__name__)

app = FastAPI(title="Prediction Worker - AutoGluon TimeSeries", version="1.0.0")
handler = AutoGluonHandler(preset=os.environ.get("AUTOGLUON_PRESET", "fast_training"))

# Set up health endpoints and metrics
setup_health_endpoints(app, "prediction-worker-autogluon")


class TrainRequest(BaseModel):
    sql: str
    target_column: Optional[str] = None
    feature_columns: List[str] = []
    output_columns: List[str] = []
    task_type: str
    params: Optional[Dict[str, Any]] = None
    output_table: str
    output_schema: str = "prediction_data"
    forecast_horizon: Optional[int] = 30


class PredictRequest(BaseModel):
    data: Dict[str, Any]
    model_id: Optional[str] = None


def verify_secret(x_worker_secret: str = Header(default="")):
    if WORKER_SECRET and x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")


@app.post("/train")
async def train(req: TrainRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    start_time = time.time()
    try:
        with MetricsContext("POST", "/train") as ctx:
            result = handler.train(
                trino_config=get_trino_config(),
                postgres_config=get_postgres_config(),
                sql=req.sql,
                target_column=req.target_column,
                forecast_horizon=req.forecast_horizon or 30,
                params=req.params or {},
                output_table=req.output_table,
                output_schema=req.output_schema,
            )

            # Record metrics
            duration = time.time() - start_time
            record_prediction("autogluon", status="success")
            record_prediction_duration("autogluon", duration)
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
        record_prediction("autogluon", status="error")
        record_prediction_duration("autogluon", duration)
        logger.error("training_validation_error", error=str(e), duration_s=duration)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        duration = time.time() - start_time
        record_prediction("autogluon", status="error")
        record_prediction_duration("autogluon", duration)
        logger.error("training_failed", error=str(e), duration_s=duration, exc_info=True)
        raise HTTPException(status_code=500, detail="Training failed. Check worker logs for details.")


@app.post("/predict")
async def predict(req: PredictRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    start_time = time.time()
    try:
        with MetricsContext("POST", "/predict") as ctx:
            result = handler.predict()

            # Record metrics
            duration = time.time() - start_time
            record_prediction("autogluon", status="success")
            record_prediction_duration("autogluon", duration)
            logger.info(
                "prediction_completed",
                duration_s=duration,
                status="success",
            )
            ctx.set_status(200)
            return result
    except ValueError as e:
        duration = time.time() - start_time
        record_prediction("autogluon", status="error")
        record_prediction_duration("autogluon", duration)
        logger.error("prediction_validation_error", error=str(e), duration_s=duration)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        duration = time.time() - start_time
        record_prediction("autogluon", status="error")
        record_prediction_duration("autogluon", duration)
        logger.error("prediction_failed", error=str(e), duration_s=duration, exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed. Check worker logs for details.")
