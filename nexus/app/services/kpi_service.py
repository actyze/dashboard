# SPDX-License-Identifier: AGPL-3.0-only
"""
Scheduled KPI Service — CRUD, collection, and materialized gold tables.

Each KPI definition holds a SQL query executed periodically (1-24 hours).
On first collection the service infers column types from Trino, creates a
real typed Postgres table in kpi_data schema, registers it with the FAISS
schema service, and populates it.  Subsequent collections append new rows
with a collected_at timestamp so dashboards can query the table directly
via Trino (e.g. SELECT * FROM postgres.kpi_data.daily_revenue).
"""

import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
import structlog
from sqlalchemy import text

from app.config import settings
from app.database import db_manager

logger = structlog.get_logger(__name__)

# Trino type_code → Postgres column type mapping
_TRINO_TYPE_MAP = {
    "varchar": "TEXT",
    "char": "TEXT",
    "varbinary": "BYTEA",
    "boolean": "BOOLEAN",
    "tinyint": "SMALLINT",
    "smallint": "SMALLINT",
    "integer": "INTEGER",
    "bigint": "BIGINT",
    "real": "REAL",
    "double": "DOUBLE PRECISION",
    "decimal": "NUMERIC",
    "date": "DATE",
    "time": "TIME",
    "timestamp": "TIMESTAMP",
    "interval": "INTERVAL",
    "json": "JSONB",
    "uuid": "UUID",
    "array": "JSONB",
    "map": "JSONB",
    "row": "JSONB",
}


def _sanitize_table_name(name: str) -> str:
    """Convert a KPI name to a valid Postgres table identifier."""
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name[:55]  # leave room for kpi_ prefix


def _pg_type(trino_type_str: str) -> str:
    """Map a Trino type string to a Postgres type."""
    base = trino_type_str.lower().split("(")[0].strip()
    return _TRINO_TYPE_MAP.get(base, "TEXT")


def _sanitize_column_name(name: str, index: int = 0) -> str:
    """Sanitize a column name from Trino for use in DDL.
    Strips anything that isn't alphanumeric/underscore to prevent
    quoted-identifier breakout via malicious column names."""
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    return clean[:63] or f"col_{index}"


class KpiService:
    """CRUD + collection + materialized tables for scheduled KPIs."""

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_kpi(
        self,
        name: str,
        sql_query: str,
        owner_user_id: str,
        description: Optional[str] = None,
        interval_hours: int = 1,
        is_active: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        refresh_interval_seconds = interval_hours * 3600
        now = datetime.utcnow()
        next_refresh = now + timedelta(seconds=refresh_interval_seconds)
        materialized_table = f"kpi_{_sanitize_table_name(name)}"

        async with db_manager.get_session() as session:
            # Ensure unique table name
            for attempt in range(10):
                candidate = materialized_table if attempt == 0 else f"{materialized_table}_{attempt}"
                exists = await session.execute(
                    text("SELECT 1 FROM nexus.kpi_definitions WHERE materialized_table = :t"),
                    {"t": candidate},
                )
                if not exists.fetchone():
                    materialized_table = candidate
                    break
            else:
                raise ValueError(f"Could not generate unique table name for KPI '{name}' after 10 attempts")

            result = await session.execute(
                text("""
                    INSERT INTO nexus.kpi_definitions (
                        name, description, sql_query,
                        refresh_interval_seconds, interval_hours,
                        is_active, owner_user_id,
                        next_refresh_at, materialized_table, metadata
                    ) VALUES (
                        :name, :description, :sql_query,
                        :refresh_interval_seconds, :interval_hours,
                        :is_active, :owner_user_id,
                        :next_refresh_at, :materialized_table, CAST(:metadata AS jsonb)
                    )
                    RETURNING id, created_at
                """),
                {
                    "name": name,
                    "description": description,
                    "sql_query": sql_query,
                    "refresh_interval_seconds": refresh_interval_seconds,
                    "interval_hours": interval_hours,
                    "is_active": is_active,
                    "owner_user_id": owner_user_id,
                    "next_refresh_at": next_refresh,
                    "materialized_table": materialized_table,
                    "metadata": json.dumps(metadata or {}),
                },
            )
            row = result.fetchone()
            await session.commit()

        return {
            "id": str(row.id),
            "name": name,
            "description": description,
            "sql_query": sql_query,
            "interval_hours": interval_hours,
            "is_active": is_active,
            "materialized_table": materialized_table,
            "created_at": row.created_at.isoformat(),
        }

    # SECURITY: Explicit column-to-SQL mapping prevents SQL injection.
    # Each value is a hardcoded SQL clause — never interpolate user input here.
    # To add a new updatable field, add a static entry below.
    _UPDATE_COLUMN_MAP = {
        "name": "name = :name",
        "description": "description = :description",
        "sql_query": "sql_query = :sql_query",
        "interval_hours": "interval_hours = :interval_hours",
        "is_active": "is_active = :is_active",
        "metadata": "metadata = CAST(:metadata AS jsonb)",
        "refresh_interval_seconds": "refresh_interval_seconds = :refresh_interval_seconds",
        "next_refresh_at": "next_refresh_at = :next_refresh_at",
    }

    async def update_kpi(
        self,
        kpi_id: str,
        owner_user_id: str,
        updates: Dict[str, Any],
        is_admin: bool = False,
    ) -> Optional[Dict[str, Any]]:
        allowed = {"name", "description", "sql_query", "interval_hours", "is_active", "metadata"}
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if not filtered:
            return await self.get_kpi(kpi_id)

        sql_changed = "sql_query" in filtered

        if "interval_hours" in filtered:
            filtered["refresh_interval_seconds"] = filtered["interval_hours"] * 3600
            filtered["next_refresh_at"] = datetime.utcnow() + timedelta(
                seconds=filtered["refresh_interval_seconds"]
            )

        set_clauses = []
        params: Dict[str, Any] = {"kpi_id": kpi_id, "owner_user_id": owner_user_id}
        for key, value in filtered.items():
            clause = self._UPDATE_COLUMN_MAP.get(key)
            if not clause:
                continue
            if key == "metadata":
                params["metadata"] = json.dumps(value)
            else:
                params[key] = value
            set_clauses.append(clause)

        if not set_clauses:
            return await self.get_kpi(kpi_id)

        old_table_to_drop = None
        if sql_changed:
            old_kpi = await self.get_kpi(kpi_id)
            if old_kpi and old_kpi.get("materialized_table"):
                old_table_to_drop = old_kpi["materialized_table"]

        # Two explicit queries — no dynamic WHERE construction
        update_sql = f"UPDATE nexus.kpi_definitions SET {', '.join(set_clauses)}"
        async with db_manager.get_session() as session:
            if is_admin:
                result = await session.execute(
                    text(f"{update_sql} WHERE id = :kpi_id RETURNING id"),
                    params,
                )
            else:
                result = await session.execute(
                    text(f"{update_sql} WHERE id = :kpi_id AND owner_user_id = :owner_user_id RETURNING id"),
                    params,
                )
            row = result.fetchone()
            await session.commit()

        if not row:
            return None

        if old_table_to_drop:
            await self._drop_materialized_table(old_table_to_drop)

        return await self.get_kpi(kpi_id)

    async def delete_kpi(self, kpi_id: str, owner_user_id: str, is_admin: bool = False) -> bool:
        # Get table name before deleting
        kpi = await self.get_kpi(kpi_id)

        async with db_manager.get_session() as session:
            if is_admin:
                result = await session.execute(
                    text("DELETE FROM nexus.kpi_definitions WHERE id = :kpi_id RETURNING id"),
                    {"kpi_id": kpi_id},
                )
            else:
                result = await session.execute(
                    text("""
                        DELETE FROM nexus.kpi_definitions
                        WHERE id = :kpi_id AND owner_user_id = :owner_user_id
                        RETURNING id
                    """),
                    {"kpi_id": kpi_id, "owner_user_id": owner_user_id},
                )
            deleted = result.fetchone() is not None
            await session.commit()

        if deleted and kpi and kpi.get("materialized_table"):
            await self._drop_materialized_table(kpi["materialized_table"])

        return deleted

    async def get_kpi(self, kpi_id: str) -> Optional[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        kd.id, kd.name, kd.description, kd.sql_query,
                        kd.refresh_interval_seconds, kd.interval_hours,
                        kd.is_active, kd.owner_user_id,
                        kd.next_refresh_at, kd.last_collected_at,
                        kd.last_error, kd.materialized_table, kd.metadata,
                        kd.created_at, kd.updated_at,
                        u.username AS owner_username
                    FROM nexus.kpi_definitions kd
                    LEFT JOIN nexus.users u ON u.id = kd.owner_user_id
                    WHERE kd.id = :kpi_id
                """),
                {"kpi_id": kpi_id},
            )
            row = result.fetchone()
        if not row:
            return None
        return self._kpi_to_dict(row)

    async def list_kpis(
        self,
        owner_user_id: Optional[str] = None,
        active_only: bool = False,
    ) -> List[Dict[str, Any]]:
        # Fixed query with filter flags — no dynamic WHERE construction
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        kd.id, kd.name, kd.description, kd.sql_query,
                        kd.refresh_interval_seconds, kd.interval_hours,
                        kd.is_active, kd.owner_user_id,
                        kd.next_refresh_at, kd.last_collected_at,
                        kd.last_error, kd.materialized_table, kd.metadata,
                        kd.created_at, kd.updated_at,
                        u.username AS owner_username
                    FROM nexus.kpi_definitions kd
                    LEFT JOIN nexus.users u ON u.id = kd.owner_user_id
                    WHERE (:filter_owner = FALSE OR kd.owner_user_id = CAST(:owner_user_id AS UUID))
                      AND (:filter_active = FALSE OR kd.is_active = TRUE)
                    ORDER BY kd.created_at DESC
                """),
                {
                    "filter_owner": owner_user_id is not None,
                    "owner_user_id": owner_user_id or "00000000-0000-0000-0000-000000000000",
                    "filter_active": active_only,
                },
            )
            return [self._kpi_to_dict(r) for r in result.fetchall()]

    # ------------------------------------------------------------------
    # COLLECTION (execute SQL, materialize into real table)
    # ------------------------------------------------------------------

    async def collect_kpi(self, kpi_id: str) -> Dict[str, Any]:
        """Execute KPI SQL, materialize results into a typed table, store JSONB log."""
        kpi = await self.get_kpi(kpi_id)
        if not kpi:
            return {"success": False, "error": "KPI not found"}

        table_name = kpi.get("materialized_table")
        if not table_name:
            return {"success": False, "error": "No materialized table defined"}

        try:
            # Execute via Trino with full column type info
            result = await self._execute_with_types(kpi["sql_query"])

            if not result.get("success"):
                error = result.get("error", "Query execution failed")
                await self._update_collection_status(kpi_id, error=error)
                return {"success": False, "error": error}

            columns = result["columns"]       # [{"name": "x", "type": "varchar"}, ...]
            rows = result["rows"]
            query_results = result["query_results"]

            # Create or validate the materialized table
            table_exists = await self._table_exists(table_name)
            if not table_exists:
                await self._create_materialized_table(table_name, columns)
                await self._notify_faiss_add(table_name, columns)

            # Insert rows with collected_at timestamp
            if rows:
                await self._insert_rows(table_name, columns, rows)

            # Also store in kpi_metric_values for historical JSONB log
            async with db_manager.get_session() as session:
                await session.execute(
                    text("""
                        INSERT INTO kpi_data.kpi_metric_values (
                            metric_id, value, metadata
                        ) VALUES (
                            :metric_id,
                            CAST(:value AS jsonb),
                            CAST(:metadata AS jsonb)
                        )
                    """),
                    {
                        "metric_id": kpi_id,
                        "value": json.dumps(query_results),
                        "metadata": json.dumps({
                            "execution_time_ms": result.get("execution_time", 0),
                            "row_count": query_results.get("row_count", 0),
                        }),
                    },
                )
                await session.commit()

            await self._update_collection_status(kpi_id)

            logger.info(f"KPI {kpi_id} ({kpi['name']}) collected: {len(rows)} rows → kpi_data.{table_name}")
            return {"success": True, "kpi_id": kpi_id, "name": kpi["name"], "rows_inserted": len(rows)}

        except Exception as exc:
            error_msg = str(exc)[:500]
            logger.error(f"KPI {kpi_id} collection failed: {error_msg}")
            await self._update_collection_status(kpi_id, error=error_msg)
            return {"success": False, "error": error_msg}

    async def _execute_with_types(self, sql: str) -> Dict[str, Any]:
        """Execute SQL via Trino and return column names + types from cursor.description."""
        import asyncio

        def _run():
            import trino
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
            rows = cur.fetchmany(settings.tile_cache_max_rows)

            columns = []
            if cur.description:
                for desc in cur.description:
                    col_name = desc[0]
                    # desc[1] is type_code (string in trino-python-client)
                    col_type = str(desc[1]) if desc[1] else "varchar"
                    columns.append({"name": col_name, "type": col_type})

            return columns, rows

        start = asyncio.get_running_loop().time()
        try:
            columns, rows = await asyncio.get_running_loop().run_in_executor(None, _run)
            exec_time = (asyncio.get_running_loop().time() - start) * 1000
            col_names = [c["name"] for c in columns]
            return {
                "success": True,
                "columns": columns,
                "rows": rows,
                "execution_time": exec_time,
                "query_results": {
                    "columns": col_names,
                    "rows": rows,
                    "row_count": len(rows),
                },
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # MATERIALIZED TABLE MANAGEMENT
    # ------------------------------------------------------------------

    async def _table_exists(self, table_name: str) -> bool:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'kpi_data' AND table_name = :t
                """),
                {"t": table_name},
            )
            return result.fetchone() is not None

    async def _create_materialized_table(
        self, table_name: str, columns: List[Dict[str, str]]
    ) -> None:
        """Create a real typed Postgres table in kpi_data schema."""
        col_defs = [f'"{_sanitize_column_name(c["name"], i)}" {_pg_type(c["type"])}' for i, c in enumerate(columns)]
        col_defs.append("collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
        ddl = f'CREATE TABLE IF NOT EXISTS kpi_data."{table_name}" ({", ".join(col_defs)})'

        async with db_manager.get_session() as session:
            await session.execute(text(ddl))
            # Add index on collected_at for time-range queries
            await session.execute(text(
                f'CREATE INDEX IF NOT EXISTS "idx_{table_name}_collected_at" '
                f'ON kpi_data."{table_name}" (collected_at DESC)'
            ))
            await session.commit()
        logger.info(f"Created materialized table kpi_data.{table_name}")

    async def _insert_rows(
        self, table_name: str, columns: List[Dict[str, str]], rows: list
    ) -> None:
        """Insert rows into the materialized table."""
        if not rows:
            return

        col_names = [f'"{_sanitize_column_name(c["name"], i)}"' for i, c in enumerate(columns)]
        col_names.append("collected_at")
        placeholders = [f":c{i}" for i in range(len(columns))]
        placeholders.append("CURRENT_TIMESTAMP")

        insert_sql = (
            f'INSERT INTO kpi_data."{table_name}" ({", ".join(col_names)}) '
            f'VALUES ({", ".join(placeholders)})'
        )

        async with db_manager.get_session() as session:
            for row in rows:
                params = {f"c{i}": self._coerce_value(v) for i, v in enumerate(row)}
                await session.execute(text(insert_sql), params)
            await session.commit()

    def _coerce_value(self, v: Any) -> Any:
        """Coerce complex Trino types to JSON-safe values for Postgres."""
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        return v

    async def _drop_materialized_table(self, table_name: str) -> None:
        """Drop the materialized table and deregister from FAISS."""
        try:
            async with db_manager.get_session() as session:
                await session.execute(text(f'DROP TABLE IF EXISTS kpi_data."{table_name}"'))
                await session.commit()
            logger.info(f"Dropped materialized table kpi_data.{table_name}")
            await self._notify_faiss_remove(table_name)
        except Exception as exc:
            logger.error(f"Failed to drop materialized table {table_name}: {exc}")

    # ------------------------------------------------------------------
    # FAISS SCHEMA SERVICE INTEGRATION
    # ------------------------------------------------------------------

    async def _notify_faiss_add(
        self, table_name: str, columns: List[Dict[str, str]]
    ) -> None:
        """Register the materialized table with the FAISS schema service."""
        schema_service_url = settings.schema_service_url
        service_key = settings.schema_service_key

        columns_for_schema = [f"{_sanitize_column_name(c['name'], i)}|{_pg_type(c['type']).lower()}" for i, c in enumerate(columns)]
        columns_for_schema.append("collected_at|timestamp")

        table_metadata = {
            "catalog": "postgres",
            "schema": "kpi_data",
            "table": table_name,
            "full_name": f"postgres.kpi_data.{table_name}",
            "columns": columns_for_schema,
            "type": "TABLE",
        }

        headers = {}
        if service_key:
            headers["X-Service-Key"] = service_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{schema_service_url}/table/add",
                    json=table_metadata,
                    headers=headers,
                    timeout=30.0,
                )
                if response.status_code == 200:
                    logger.info(f"FAISS: registered kpi_data.{table_name}")
                else:
                    logger.warning(f"FAISS add failed: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"FAISS add error for {table_name}: {e}")

    async def _notify_faiss_remove(self, table_name: str) -> None:
        """Deregister the materialized table from the FAISS schema service."""
        schema_service_url = settings.schema_service_url
        service_key = settings.schema_service_key

        headers = {}
        if service_key:
            headers["X-Service-Key"] = service_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{schema_service_url}/table/postgres/kpi_data/{table_name}",
                    headers=headers,
                    timeout=30.0,
                )
                if response.status_code == 200:
                    logger.info(f"FAISS: deregistered kpi_data.{table_name}")
                else:
                    logger.warning(f"FAISS remove failed: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"FAISS remove error for {table_name}: {e}")

    # ------------------------------------------------------------------
    # COLLECTION STATUS + SCHEDULED SWEEP
    # ------------------------------------------------------------------

    async def _update_collection_status(
        self, kpi_id: str, error: Optional[str] = None
    ) -> None:
        async with db_manager.get_session() as session:
            if error:
                await session.execute(
                    text("""
                        UPDATE nexus.kpi_definitions
                        SET last_error = :error
                        WHERE id = :kpi_id
                    """),
                    {"kpi_id": kpi_id, "error": error[:2000]},
                )
            else:
                await session.execute(
                    text("""
                        UPDATE nexus.kpi_definitions
                        SET last_collected_at = CURRENT_TIMESTAMP,
                            last_error = NULL,
                            next_refresh_at = CURRENT_TIMESTAMP + (refresh_interval_seconds || ' seconds')::interval
                        WHERE id = :kpi_id
                    """),
                    {"kpi_id": kpi_id},
                )
            await session.commit()

    async def collect_due_kpis(self) -> int:
        """Find KPIs whose next_refresh_at has passed and collect them."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id FROM nexus.kpi_definitions
                    WHERE is_active = TRUE
                      AND next_refresh_at <= CURRENT_TIMESTAMP
                    ORDER BY next_refresh_at
                    LIMIT 10
                """)
            )
            due_ids = [str(r.id) for r in result.fetchall()]

        collected = 0
        for kpi_id in due_ids:
            res = await self.collect_kpi(kpi_id)
            if res.get("success"):
                collected += 1
        return collected

    # ------------------------------------------------------------------
    # AGGREGATION (time-series queries)
    # ------------------------------------------------------------------

    async def get_metric_values(
        self,
        kpi_id: str,
        hours: int = 24,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        since = datetime.utcnow() - timedelta(hours=hours)
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, metric_id, collected_at, value, metadata
                    FROM kpi_data.kpi_metric_values
                    WHERE metric_id = :kpi_id
                      AND collected_at >= :since
                    ORDER BY collected_at DESC
                    LIMIT :limit
                """),
                {"kpi_id": kpi_id, "since": since, "limit": limit},
            )
            return [
                {
                    "id": str(r.id),
                    "kpi_id": str(r.metric_id),
                    "collected_at": r.collected_at.isoformat(),
                    "value": r.value,
                    "metadata": r.metadata,
                }
                for r in result.fetchall()
            ]

    async def get_metric_summary(
        self,
        kpi_id: str,
        hours: int = 24,
    ) -> Dict[str, Any]:
        since = datetime.utcnow() - timedelta(hours=hours)
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        COUNT(*) AS total_collections,
                        MIN(collected_at) AS first_collection,
                        MAX(collected_at) AS last_collection
                    FROM kpi_data.kpi_metric_values
                    WHERE metric_id = :kpi_id
                      AND collected_at >= :since
                """),
                {"kpi_id": kpi_id, "since": since},
            )
            row = result.fetchone()

        return {
            "kpi_id": kpi_id,
            "hours": hours,
            "total_collections": row.total_collections,
            "first_collection": row.first_collection.isoformat() if row.first_collection else None,
            "last_collection": row.last_collection.isoformat() if row.last_collection else None,
        }

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------

    def _kpi_to_dict(self, row) -> Dict[str, Any]:
        return {
            "id": str(row.id),
            "name": row.name,
            "description": row.description,
            "sql_query": row.sql_query,
            "refresh_interval_seconds": row.refresh_interval_seconds,
            "interval_hours": row.interval_hours,
            "is_active": row.is_active,
            "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
            "owner_username": row.owner_username if hasattr(row, "owner_username") else None,
            "materialized_table": row.materialized_table if hasattr(row, "materialized_table") else None,
            "next_refresh_at": row.next_refresh_at.isoformat() if row.next_refresh_at else None,
            "last_collected_at": row.last_collected_at.isoformat() if row.last_collected_at else None,
            "last_error": row.last_error,
            "metadata": row.metadata or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


kpi_service = KpiService()
