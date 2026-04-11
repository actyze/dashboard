"""
Scheduled KPI Service — CRUD, collection, and aggregation.

KPI definitions hold a SQL query that is executed periodically (every 1-24 hours)
by the scheduler. Each execution appends a row to kpi_metric_values with the
result as JSONB, building a time-series that can be aggregated over arbitrary
time ranges for dashboard consumption.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import text

from app.config import settings
from app.database import db_manager
from app.services.trino_service import TrinoService

logger = logging.getLogger(__name__)

_trino = TrinoService()


class KpiService:
    """CRUD + collection + aggregation for scheduled KPIs."""

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

        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    INSERT INTO nexus.kpi_definitions (
                        name, description, sql_query,
                        refresh_interval_seconds, interval_hours,
                        is_active, owner_user_id,
                        next_refresh_at, metadata
                    ) VALUES (
                        :name, :description, :sql_query,
                        :refresh_interval_seconds, :interval_hours,
                        :is_active, :owner_user_id,
                        :next_refresh_at, CAST(:metadata AS jsonb)
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
            "created_at": row.created_at.isoformat(),
        }

    async def update_kpi(
        self,
        kpi_id: str,
        owner_user_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        allowed = {"name", "description", "sql_query", "interval_hours", "is_active", "metadata"}
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if not filtered:
            return await self.get_kpi(kpi_id)

        # If interval_hours changed, sync refresh_interval_seconds and next_refresh_at
        if "interval_hours" in filtered:
            filtered["refresh_interval_seconds"] = filtered["interval_hours"] * 3600
            filtered["next_refresh_at"] = datetime.utcnow() + timedelta(
                seconds=filtered["refresh_interval_seconds"]
            )

        set_clauses = []
        params: Dict[str, Any] = {"kpi_id": kpi_id, "owner_user_id": owner_user_id}
        for key, value in filtered.items():
            if key == "metadata":
                set_clauses.append(f"metadata = CAST(:metadata AS jsonb)")
                params["metadata"] = json.dumps(value)
            else:
                set_clauses.append(f"{key} = :{key}")
                params[key] = value

        async with db_manager.get_session() as session:
            result = await session.execute(
                text(f"""
                    UPDATE nexus.kpi_definitions
                    SET {', '.join(set_clauses)}
                    WHERE id = :kpi_id AND owner_user_id = :owner_user_id
                    RETURNING id
                """),
                params,
            )
            row = result.fetchone()
            await session.commit()

        if not row:
            return None
        return await self.get_kpi(kpi_id)

    async def delete_kpi(self, kpi_id: str, owner_user_id: str) -> bool:
        async with db_manager.get_session() as session:
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
                        kd.last_error, kd.metadata,
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
        conditions = []
        params: Dict[str, Any] = {}
        if owner_user_id:
            conditions.append("kd.owner_user_id = :owner_user_id")
            params["owner_user_id"] = owner_user_id
        if active_only:
            conditions.append("kd.is_active = TRUE")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text(f"""
                    SELECT
                        kd.id, kd.name, kd.description, kd.sql_query,
                        kd.refresh_interval_seconds, kd.interval_hours,
                        kd.is_active, kd.owner_user_id,
                        kd.next_refresh_at, kd.last_collected_at,
                        kd.last_error, kd.metadata,
                        kd.created_at, kd.updated_at,
                        u.username AS owner_username
                    FROM nexus.kpi_definitions kd
                    LEFT JOIN nexus.users u ON u.id = kd.owner_user_id
                    {where}
                    ORDER BY kd.created_at DESC
                """),
                params,
            )
            return [self._kpi_to_dict(r) for r in result.fetchall()]

    # ------------------------------------------------------------------
    # COLLECTION (execute SQL, store result)
    # ------------------------------------------------------------------

    async def collect_kpi(self, kpi_id: str) -> Dict[str, Any]:
        """Execute the KPI's SQL query and store the result as a metric value."""
        kpi = await self.get_kpi(kpi_id)
        if not kpi:
            return {"success": False, "error": "KPI not found"}

        try:
            result = await _trino.execute_query(
                kpi["sql_query"],
                max_results=settings.tile_cache_max_rows,
                timeout_seconds=settings.trino_execute_timeout_seconds,
            )

            if not result.get("success"):
                error = result.get("error", "Query execution failed")
                await self._update_collection_status(kpi_id, error=error)
                return {"success": False, "error": error}

            # Store the metric value
            query_results = result.get("query_results", {})
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

            # Update next_refresh_at and last_collected_at
            await self._update_collection_status(kpi_id)

            logger.info(f"KPI {kpi_id} ({kpi['name']}) collected successfully")
            return {"success": True, "kpi_id": kpi_id, "name": kpi["name"]}

        except Exception as exc:
            error_msg = str(exc)[:500]
            logger.error(f"KPI {kpi_id} collection failed: {error_msg}")
            await self._update_collection_status(kpi_id, error=error_msg)
            return {"success": False, "error": error_msg}

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

    # ------------------------------------------------------------------
    # SCHEDULED COLLECTION (called by scheduler)
    # ------------------------------------------------------------------

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
        """Return recent metric values for a KPI within the given time range."""
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
        """Return aggregation summary for a KPI over the given time range."""
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
            "next_refresh_at": row.next_refresh_at.isoformat() if row.next_refresh_at else None,
            "last_collected_at": row.last_collected_at.isoformat() if row.last_collected_at else None,
            "last_error": row.last_error,
            "metadata": row.metadata or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


kpi_service = KpiService()
