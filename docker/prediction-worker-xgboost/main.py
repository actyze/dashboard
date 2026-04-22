# SPDX-License-Identifier: AGPL-3.0-only
"""XGBoost Prediction Worker — handles classification, regression, and anomaly detection.
Reads data directly from Trino and writes predictions to Postgres.
Credentials are read from environment variables, not from HTTP requests."""

import logging

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from config import get_trino_config, get_postgres_config, WORKER_SECRET
from models.xgboost_handler import XGBoostHandler
from models.isolation_forest_handler import IsolationForestHandler

logger = logging.getLogger(__name__)

app = FastAPI(title="Prediction Worker - XGBoost", version="1.0.0")
xgb_handler = XGBoostHandler()
anomaly_handler = IsolationForestHandler()


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


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_type": "xgboost",
        "category": "tabular",
        "task_types": ["classification", "regression", "anomaly_detection"],
    }


@app.post("/train")
async def train(req: TrainRequest, x_worker_secret: str = Header(default="")):
    verify_secret(x_worker_secret)
    try:
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
        result = xgb_handler.predict(
            columns=req.data["columns"],
            rows=req.data["rows"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed. Check worker logs for details.")
