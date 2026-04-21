# SPDX-License-Identifier: AGPL-3.0-only
"""XGBoost Prediction Worker — handles classification and regression.
Reads data directly from Trino and writes predictions to Postgres."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from models.xgboost_handler import XGBoostHandler

app = FastAPI(title="Prediction Worker - XGBoost", version="1.0.0")
handler = XGBoostHandler()


class TrainRequest(BaseModel):
    trino_config: Dict[str, Any]       # Worker reads data from Trino directly
    postgres_config: Dict[str, Any]    # Worker writes predictions to Postgres directly
    sql: str                           # The Trino SQL query to fetch training data
    target_column: str
    feature_columns: List[str]
    output_columns: List[str] = []     # ID/label columns to include in output
    task_type: str                     # "classification" or "regression"
    params: Optional[Dict[str, Any]] = None
    output_table: str                  # prediction_data.{name}
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
        "task_types": ["classification", "regression"],
    }


@app.post("/train")
async def train(req: TrainRequest):
    try:
        result = handler.train(
            trino_config=req.trino_config,
            postgres_config=req.postgres_config,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        result = handler.predict(
            columns=req.data["columns"],
            rows=req.data["rows"],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
