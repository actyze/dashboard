# SPDX-License-Identifier: AGPL-3.0-only
"""AutoGluon TimeSeries Worker — reads from Trino, writes to Postgres.
Credentials are read from environment variables, not from HTTP requests."""

import logging
import os

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from config import get_trino_config, get_postgres_config, WORKER_SECRET
from models.autogluon_handler import AutoGluonHandler

logger = logging.getLogger(__name__)

app = FastAPI(title="Prediction Worker - AutoGluon TimeSeries", version="1.0.0")
handler = AutoGluonHandler(preset=os.environ.get("AUTOGLUON_PRESET", "fast_training"))


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


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_type": "autogluon",
        "category": "timeseries",
        "task_types": ["forecasting"],
        "preset": handler.preset,
    }


@app.post("/train")
async def train(req: TrainRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    try:
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
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Training failed. Check worker logs for details.")


@app.post("/predict")
async def predict(req: PredictRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    try:
        result = handler.predict()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed. Check worker logs for details.")
