# SPDX-License-Identifier: AGPL-3.0-only
"""XGBoost handler — reads from Trino, trains, writes predictions to Postgres."""

import uuid
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_absolute_error, mean_squared_error, mean_absolute_percentage_error,
    r2_score,
)
from sklearn.preprocessing import LabelEncoder


def _read_trino(trino_config: Dict, sql: str) -> pd.DataFrame:
    """Read data from Trino into a DataFrame, streaming in chunks."""
    from trino.dbapi import connect
    from trino.auth import BasicAuthentication

    auth = None
    if trino_config.get("password"):
        auth = BasicAuthentication(trino_config["user"], trino_config["password"])

    conn_args = {
        "host": trino_config["host"],
        "port": trino_config["port"],
        "user": trino_config["user"],
        "catalog": trino_config.get("catalog", "postgres"),
        "schema": trino_config.get("schema", "public"),
        "http_scheme": "https" if trino_config.get("ssl") else "http",
    }
    if auth:
        conn_args["auth"] = auth

    conn = connect(**conn_args)
    cur = conn.cursor()
    cur.execute(sql.strip().rstrip(";"))
    col_names = [desc[0] for desc in cur.description]

    # Stream in chunks to handle large datasets
    chunks = []
    while True:
        batch = cur.fetchmany(50000)
        if not batch:
            break
        chunks.append(pd.DataFrame(batch, columns=col_names))

    cur.close()
    conn.close()
    if not chunks:
        return pd.DataFrame(columns=col_names)
    return pd.concat(chunks, ignore_index=True)


def _write_postgres(pg_config: Dict, schema: str, table: str, df: pd.DataFrame):
    """Write a DataFrame to Postgres, replacing the existing table."""
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(
        host=pg_config["host"],
        port=pg_config["port"],
        dbname=pg_config["database"],
        user=pg_config["user"],
        password=pg_config["password"],
    )
    cur = conn.cursor()

    cur.execute(f'DROP TABLE IF EXISTS {schema}."{table}"')

    col_defs = []
    for col in df.columns:
        dtype = df[col].dtype
        if dtype in ("float64", "float32"):
            pg_type = "DOUBLE PRECISION"
        elif dtype in ("int64", "int32"):
            pg_type = "BIGINT"
        elif dtype == "bool":
            pg_type = "BOOLEAN"
        else:
            pg_type = "TEXT"
        col_defs.append(f'"{col}" {pg_type}')
    col_defs.append("predicted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")

    cur.execute(f'CREATE TABLE {schema}."{table}" ({", ".join(col_defs)})')
    cur.execute(f'CREATE INDEX ON {schema}."{table}" (predicted_at DESC)')

    if len(df) > 0:
        cols = [f'"{c}"' for c in df.columns]
        insert_sql = f'INSERT INTO {schema}."{table}" ({", ".join(cols)}) VALUES %s'
        values = [tuple(None if pd.isna(v) else v for v in row) for row in df.itertuples(index=False, name=None)]
        execute_values(cur, insert_sql, values, page_size=5000)

    conn.commit()
    cur.close()
    conn.close()


class XGBoostHandler:
    def __init__(self):
        self._model = None
        self._model_id = None
        self._feature_columns = None
        self._label_encoder = None
        self._task_type = None

    def train(
        self,
        trino_config: Dict,
        postgres_config: Dict,
        sql: str,
        target_column: str,
        feature_columns: List[str],
        output_columns: List[str],
        task_type: str,
        params: Dict[str, Any],
        output_table: str,
        output_schema: str,
    ) -> Dict[str, Any]:
        df = _read_trino(trino_config, sql)

        if len(df) < 10:
            raise ValueError(f"Only {len(df)} rows returned. Need at least 10.")

        if not feature_columns:
            feature_columns = [c for c in df.columns if c != target_column and c.lower() != "collected_at"]

        available_features = [c for c in feature_columns if c in df.columns]
        if not available_features:
            raise ValueError("No valid feature columns found in data")

        X = df[available_features].copy()
        y = df[target_column].copy()
        mask = y.notna()
        X, y = X[mask], y[mask]

        if len(X) < 10:
            raise ValueError(f"Only {len(X)} valid rows after removing nulls.")

        encoders = {}
        for col in X.columns:
            if X[col].dtype == "object":
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].fillna("__missing__"))
                encoders[col] = le
            else:
                X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

        self._label_encoder = None
        if task_type == "classification" and (y.dtype == "object" or y.dtype == "bool"):
            self._label_encoder = LabelEncoder()
            y = pd.Series(self._label_encoder.fit_transform(y.astype(str)), index=y.index)

        # 80/20 backtest split
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        xgb_params = {
            "n_estimators": params.get("n_estimators", 200),
            "max_depth": params.get("max_depth", 6),
            "learning_rate": params.get("learning_rate", 0.1),
            "n_jobs": -1, "random_state": 42,
        }

        if task_type == "classification":
            num_classes = len(y.unique())
            xgb_params["objective"] = "binary:logistic" if num_classes <= 2 else "multi:softmax"
            if num_classes > 2:
                xgb_params["num_class"] = num_classes
            model = xgb.XGBClassifier(**xgb_params)
        else:
            xgb_params["objective"] = params.get("objective", "reg:squarederror")
            model = xgb.XGBRegressor(**xgb_params)

        model.fit(X_train, y_train)
        y_pred_test = model.predict(X_test)

        # Metrics
        metrics, backtest = {}, {}
        if task_type == "classification":
            avg = "binary" if len(y.unique()) <= 2 else "weighted"
            metrics["accuracy"] = float(accuracy_score(y_test, y_pred_test))
            metrics["f1"] = float(f1_score(y_test, y_pred_test, average=avg, zero_division=0))
            metrics["precision"] = float(precision_score(y_test, y_pred_test, average=avg, zero_division=0))
            metrics["recall"] = float(recall_score(y_test, y_pred_test, average=avg, zero_division=0))
        else:
            metrics["mae"] = float(mean_absolute_error(y_test, y_pred_test))
            metrics["rmse"] = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
            metrics["r2"] = float(r2_score(y_test, y_pred_test))
            non_zero = y_test != 0
            if non_zero.sum() > 0:
                metrics["mape"] = float(mean_absolute_percentage_error(y_test[non_zero], y_pred_test[non_zero]))

        backtest["actual"] = y_test.tolist()[:500]
        backtest["predicted"] = y_pred_test.tolist()[:500]

        # Train on ALL data
        model.fit(X, y)
        y_pred_all = model.predict(X)

        # Build slim output DataFrame: output_columns + prediction columns only
        # output_columns = user-selected ID/label columns (e.g., customer_id, customer_name)
        # If none selected, fall back to all non-feature, non-target columns (IDs/labels)
        source_df = df[mask].copy()
        if output_columns:
            keep_cols = [c for c in output_columns if c in source_df.columns]
        else:
            # Auto-detect: include columns that are not features and not the target
            keep_cols = [c for c in source_df.columns
                         if c not in available_features and c != target_column and c.lower() != "collected_at"]

        out_df = source_df[keep_cols].copy() if keep_cols else pd.DataFrame(index=source_df.index)

        # Add prediction columns
        predicted = y_pred_all
        if self._label_encoder:
            predicted = self._label_encoder.inverse_transform(predicted.astype(int))

        out_df[f"{target_column}_predicted"] = predicted

        # Add probability for classification
        if task_type == "classification" and hasattr(model, "predict_proba"):
            probas = model.predict_proba(X)
            if probas.shape[1] == 2:
                out_df[f"{target_column}_probability"] = probas[:, 1]
            else:
                out_df[f"{target_column}_probability"] = probas.max(axis=1)

        # Write directly to Postgres
        _write_postgres(postgres_config, output_schema, output_table, out_df)

        # Column metadata for FAISS
        prediction_columns = []
        for col in out_df.columns:
            dtype = out_df[col].dtype
            pg_type = "DOUBLE PRECISION" if dtype in ("float64", "float32", "int64", "int32") else "TEXT"
            prediction_columns.append({"name": col, "pg_type": pg_type})

        self._model = model
        self._model_id = str(uuid.uuid4())
        self._feature_columns = available_features
        self._task_type = task_type

        return {
            "model_id": self._model_id,
            "metrics": metrics,
            "backtest": backtest,
            "prediction_columns": prediction_columns,
            "row_count": len(out_df),
        }

    def predict(self, columns: List[str], rows: List[List]) -> Dict[str, Any]:
        if self._model is None:
            raise ValueError("No model trained yet. Call /train first.")
        df = pd.DataFrame(rows, columns=columns)
        X = df[[c for c in self._feature_columns if c in df.columns]].copy()
        for col in X.columns:
            if X[col].dtype == "object":
                X[col] = X[col].fillna("__missing__").astype("category").cat.codes
            else:
                X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)
        predictions = self._model.predict(X)
        if self._label_encoder and self._task_type == "classification":
            predictions = self._label_encoder.inverse_transform(predictions.astype(int))
        return {"predictions": predictions.tolist(), "model_id": self._model_id, "row_count": len(predictions)}
