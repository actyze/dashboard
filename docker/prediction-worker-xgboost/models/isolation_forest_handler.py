# SPDX-License-Identifier: AGPL-3.0-only
"""Isolation Forest handler — unsupervised anomaly detection.
Runs inside the XGBoost worker (scikit-learn is already installed)."""

import uuid
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder


def _read_trino(trino_config: Dict, sql: str) -> pd.DataFrame:
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
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(
        host=pg_config["host"], port=pg_config["port"],
        dbname=pg_config["database"], user=pg_config["user"], password=pg_config["password"],
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
        values = [tuple(None if pd.isna(v) else v for v in row) for row in df.itertuples(index=False, name=None)]
        execute_values(cur, f'INSERT INTO {schema}."{table}" ({", ".join(cols)}) VALUES %s', values, page_size=5000)

    conn.commit()
    cur.close()
    conn.close()


class IsolationForestHandler:
    def __init__(self):
        self._model = None
        self._model_id = None

    def train(
        self,
        trino_config: Dict,
        postgres_config: Dict,
        sql: str,
        output_columns: List[str],
        params: Dict[str, Any],
        output_table: str,
        output_schema: str,
    ) -> Dict[str, Any]:
        df = _read_trino(trino_config, sql)

        if len(df) < 10:
            raise ValueError(f"Only {len(df)} rows returned. Need at least 10.")

        # Use all numeric columns as features (anomaly detection is unsupervised)
        numeric_cols = [c for c in df.columns
                        if df[c].dtype in ("float64", "int64", "float32", "int32")
                        and c.lower() != "collected_at"]

        if not numeric_cols:
            # Try encoding categoricals
            for col in df.columns:
                if df[col].dtype == "object" and col.lower() != "collected_at":
                    le = LabelEncoder()
                    df[f"{col}_encoded"] = le.fit_transform(df[col].fillna("__missing__"))
                    numeric_cols.append(f"{col}_encoded")

        if not numeric_cols:
            raise ValueError("No numeric columns found for anomaly detection.")

        X = df[numeric_cols].copy()
        X = X.fillna(0)

        # Train Isolation Forest
        contamination = params.get("contamination", 0.1)
        n_estimators = params.get("n_estimators", 200)

        model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=params.get("random_state", 42),
            n_jobs=-1,
        )
        model.fit(X)

        # Predict: -1 = anomaly, 1 = normal
        labels = model.predict(X)
        scores = model.decision_function(X)

        # Normalize scores to 0-1 range (higher = more anomalous)
        score_min, score_max = scores.min(), scores.max()
        if score_max > score_min:
            anomaly_scores = 1 - (scores - score_min) / (score_max - score_min)
        else:
            anomaly_scores = np.zeros(len(scores))

        anomaly_count = int((labels == -1).sum())

        # Build output DataFrame
        if output_columns:
            keep_cols = [c for c in output_columns if c in df.columns]
        else:
            keep_cols = [c for c in df.columns
                         if c.lower() != "collected_at" and not c.endswith("_encoded")]

        out_df = df[keep_cols].copy() if keep_cols else pd.DataFrame(index=df.index)
        out_df["is_anomaly"] = (labels == -1).astype(int)
        out_df["anomaly_score"] = np.round(anomaly_scores, 4)

        # Write to Postgres
        _write_postgres(postgres_config, output_schema, output_table, out_df)

        # Metrics
        metrics = {
            "anomaly_count": anomaly_count,
            "total_rows": len(df),
            "contamination": contamination,
            "anomaly_rate": round(anomaly_count / len(df), 4) if len(df) > 0 else 0,
        }

        # Column metadata for FAISS
        prediction_columns = []
        for col in out_df.columns:
            dtype = out_df[col].dtype
            pg_type = "DOUBLE PRECISION" if dtype in ("float64", "float32") else "BIGINT" if dtype in ("int64", "int32") else "TEXT"
            prediction_columns.append({"name": col, "pg_type": pg_type})

        self._model = model
        self._model_id = str(uuid.uuid4())

        return {
            "model_id": self._model_id,
            "metrics": metrics,
            "backtest": {},
            "prediction_columns": prediction_columns,
            "row_count": len(out_df),
        }
