# SPDX-License-Identifier: AGPL-3.0-only
"""AutoGluon TimeSeries Worker — reads from Trino, writes to Postgres."""

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from models.autogluon_handler import AutoGluonHandler

app = FastAPI(title="Prediction Worker - AutoGluon TimeSeries", version="1.0.0")
handler = AutoGluonHandler(preset=os.environ.get("AUTOGLUON_PRESET", "fast_training"))


class TrainRequest(BaseModel):
    trino_config: Dict[str, Any]
    postgres_config: Dict[str, Any]
    sql: str
    target_column: str
    feature_columns: List[str]
    task_type: str
    params: Optional[Dict[str, Any]] = None
    output_table: str
    output_schema: str = "prediction_data"
    forecast_horizon: Optional[int] = 30


class PredictRequest(BaseModel):
    data: Dict[str, Any]
    model_id: Optional[str] = None


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
async def train(req: TrainRequest):
    try:
        result = handler.train(
            trino_config=req.trino_config,
            postgres_config=req.postgres_config,
            sql=req.sql,
            target_column=req.target_column,
            forecast_horizon=req.forecast_horizon or 30,
            params=req.params or {},
            output_table=req.output_table,
            output_schema=req.output_schema,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        result = handler.predict()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
