# SPDX-License-Identifier: AGPL-3.0-only
"""AutoGluon TimeSeries handler — reads from Trino, writes predictions to Postgres."""

import shutil
import tempfile
import uuid
from typing import Any, Dict, List

import numpy as np
import pandas as pd


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


_ALLOWED_SCHEMAS = {"prediction_data"}


def _write_postgres(pg_config: Dict, schema: str, table: str, df: pd.DataFrame):
    import re
    import psycopg2
    from psycopg2.extras import execute_values

    if schema not in _ALLOWED_SCHEMAS:
        raise ValueError(f"Schema '{schema}' not allowed. Must be one of: {_ALLOWED_SCHEMAS}")
    table = re.sub(r"[^a-zA-Z0-9_]", "_", table)[:63]

    conn = psycopg2.connect(
        host=pg_config["host"], port=pg_config["port"],
        dbname=pg_config["database"], user=pg_config["user"], password=pg_config["password"],
    )
    cur = conn.cursor()
    cur.execute(f'DROP TABLE IF EXISTS {schema}."{table}"')

    col_defs = []
    for col in df.columns:
        dtype = df[col].dtype
        pg_type = "DOUBLE PRECISION" if dtype in ("float64", "float32") else "DATE" if dtype == "datetime64[ns]" else "TEXT"
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


class AutoGluonHandler:
    def __init__(self, preset: str = "fast_training"):
        self.preset = preset
        self._predictor = None
        self._model_id = None
        self._last_predictions = None

    def train(
        self,
        trino_config: Dict,
        postgres_config: Dict,
        sql: str,
        target_column: str,
        forecast_horizon: int = 30,
        params: Dict[str, Any] = None,
        output_table: str = "",
        output_schema: str = "prediction_data",
    ) -> Dict[str, Any]:
        from autogluon.timeseries import TimeSeriesDataFrame, TimeSeriesPredictor

        params = params or {}
        df = _read_trino(trino_config, sql)

        # Detect timestamp column — prefer user data columns over system columns
        ts_col = None
        # Pass 1: columns with date/time in the name (excluding collected_at which is a system column)
        for col in df.columns:
            if col.lower() == "collected_at":
                continue
            if any(kw in col.lower() for kw in ("date", "timestamp", "time", "ds", "datetime", "period", "month", "year")):
                try:
                    pd.to_datetime(df[col])
                    ts_col = col
                    break
                except (ValueError, TypeError):
                    continue
        # Pass 2: any column that parses as datetime (excluding collected_at and target)
        if ts_col is None:
            for col in df.columns:
                if col.lower() == "collected_at" or col == target_column:
                    continue
                try:
                    pd.to_datetime(df[col])
                    ts_col = col
                    break
                except (ValueError, TypeError):
                    continue
        # Pass 3: fall back to collected_at if nothing else found
        if ts_col is None and "collected_at" in df.columns:
            ts_col = "collected_at"

        if ts_col is None:
            raise ValueError(
                "No timestamp column found. Time-series forecasting requires a date/timestamp column. "
                "Found columns: " + ", ".join(df.columns.tolist())
            )

        df[ts_col] = pd.to_datetime(df[ts_col])
        df = df.sort_values(ts_col)
        df[target_column] = pd.to_numeric(df[target_column], errors="coerce")
        df = df.dropna(subset=[target_column])

        # Deduplicate timestamps (KPI collections may produce duplicates)
        # Keep the last collected value for each timestamp
        non_ts_cols = [c for c in df.columns if c != ts_col and c != "item_id"]
        df = df.drop_duplicates(subset=[ts_col], keep="last")

        # Infer frequency, default to daily
        freq = pd.infer_freq(df[ts_col])
        if freq is None:
            # Try to guess from median gap
            diffs = df[ts_col].diff().dropna()
            if len(diffs) > 0:
                median_gap = diffs.median()
                if median_gap <= pd.Timedelta(hours=2):
                    freq = "h"
                elif median_gap <= pd.Timedelta(days=1, hours=12):
                    freq = "D"
                elif median_gap <= pd.Timedelta(days=8):
                    freq = "W"
                else:
                    freq = "MS"
            else:
                freq = "D"

        # Resample to fill gaps (AutoGluon requires regular frequency)
        df = df.set_index(ts_col).resample(freq).agg({
            target_column: "mean",
            **{c: "first" for c in non_ts_cols if c in df.columns and c != target_column and c != "collected_at"}
        }).dropna(subset=[target_column]).reset_index()

        if len(df) < forecast_horizon * 2:
            raise ValueError(f"Need at least {forecast_horizon * 2} data points after dedup/resample. Have {len(df)}.")

        df["item_id"] = "main"

        # Backtest
        backtest_size = min(forecast_horizon, len(df) // 5)
        train_df = df.iloc[:-backtest_size].copy()
        test_df = df.iloc[-backtest_size:].copy()

        # Detect numeric covariates for multivariate forecasting
        covariate_cols = [c for c in df.columns
                         if c not in [ts_col, "item_id", target_column, "collected_at"]
                         and df[c].dtype in ("float64", "int64", "float32", "int32")]

        ts_columns = [ts_col, "item_id", target_column] + covariate_cols
        train_tsdf = TimeSeriesDataFrame.from_data_frame(
            train_df[ts_columns], id_column="item_id", timestamp_column=ts_col
        )

        time_limit = params.get("time_limit", 300)
        preset = params.get("preset", self.preset)

        model_path = tempfile.mkdtemp(prefix="ag_ts_")
        full_model_path = None
        try:
            predictor = TimeSeriesPredictor(
                target=target_column, prediction_length=forecast_horizon,
                freq=freq, path=model_path, eval_metric="MAPE",
                known_covariates_names=covariate_cols if covariate_cols else None,
            )
            predictor.fit(train_tsdf, presets=preset, time_limit=time_limit)

            backtest_preds = predictor.predict(train_tsdf)
            backtest_values = backtest_preds["mean"].values[:backtest_size]
            actual_values = test_df[target_column].values[:backtest_size]

            metrics = {}
            non_zero = actual_values != 0
            if non_zero.sum() > 0:
                metrics["mape"] = float(np.mean(np.abs(
                    (actual_values[non_zero] - backtest_values[:len(actual_values)][non_zero]) / actual_values[non_zero]
                )))
            metrics["mae"] = float(np.mean(np.abs(actual_values - backtest_values[:len(actual_values)])))
            metrics["rmse"] = float(np.sqrt(np.mean((actual_values - backtest_values[:len(actual_values)]) ** 2)))

            backtest = {
                "actual": actual_values.tolist(),
                "predicted": backtest_values[:len(actual_values)].tolist(),
                "dates": test_df[ts_col].dt.strftime("%Y-%m-%d").tolist()[:len(actual_values)],
            }

            # Train on ALL data with a fresh predictor
            full_tsdf = TimeSeriesDataFrame.from_data_frame(
                df[ts_columns], id_column="item_id", timestamp_column=ts_col
            )
            full_model_path = tempfile.mkdtemp(prefix="ag_ts_full_")
            full_predictor = TimeSeriesPredictor(
                target=target_column, prediction_length=forecast_horizon,
                freq=freq, path=full_model_path, eval_metric="MAPE",
            )
            full_predictor.fit(full_tsdf, presets=preset, time_limit=time_limit)

            future_preds = full_predictor.predict(full_tsdf)
            mean_vals = future_preds["mean"].values
            lower_vals = future_preds.get("0.1", future_preds["mean"]).values if "0.1" in future_preds.columns else mean_vals * 0.9
            upper_vals = future_preds.get("0.9", future_preds["mean"]).values if "0.9" in future_preds.columns else mean_vals * 1.1

            last_date = df[ts_col].max()
            future_dates = pd.date_range(start=last_date + pd.tseries.frequencies.to_offset(freq), periods=forecast_horizon, freq=freq)

            # Build output DataFrame
            out_rows = []
            for i in range(min(forecast_horizon, len(mean_vals))):
                out_rows.append({
                    "forecast_date": future_dates[i].strftime("%Y-%m-%d") if i < len(future_dates) else f"T+{i+1}",
                    f"{target_column}_predicted": float(mean_vals[i]),
                    f"{target_column}_lower": float(lower_vals[i]) if i < len(lower_vals) else float(mean_vals[i] * 0.9),
                    f"{target_column}_upper": float(upper_vals[i]) if i < len(upper_vals) else float(mean_vals[i] * 1.1),
                })
            out_df = pd.DataFrame(out_rows)

            # Write directly to Postgres
            _write_postgres(postgres_config, output_schema, output_table, out_df)

            prediction_columns = [
                {"name": "forecast_date", "pg_type": "TEXT"},
                {"name": f"{target_column}_predicted", "pg_type": "DOUBLE PRECISION"},
                {"name": f"{target_column}_lower", "pg_type": "DOUBLE PRECISION"},
                {"name": f"{target_column}_upper", "pg_type": "DOUBLE PRECISION"},
            ]

            self._predictor = full_predictor
            self._model_id = str(uuid.uuid4())
            self._last_predictions = out_rows

        finally:
            for path in [model_path, full_model_path]:
                if path:
                    try:
                        shutil.rmtree(path, ignore_errors=True)
                    except Exception:
                        pass

        return {
            "model_id": self._model_id,
            "metrics": metrics,
            "backtest": backtest,
            "prediction_columns": prediction_columns,
            "row_count": len(out_rows),
        }

    def predict(self) -> Dict[str, Any]:
        if self._last_predictions is None:
            raise ValueError("No model trained yet. Call /train first.")
        return {
            "predictions": self._last_predictions,
            "model_id": self._model_id,
            "row_count": len(self._last_predictions),
        }
