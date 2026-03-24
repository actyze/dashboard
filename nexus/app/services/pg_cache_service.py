"""
PostgreSQL-backed tile cache service.

Stores query results as JSONB with content-addressed cache keys (SHA-256 of SQL).
Identical SQL across different tiles shares the same cache_key, enabling
deduplication at the Trino level while keeping per-tile TTL/status tracking.
"""

import hashlib
import json
import logging
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from app.config import settings
from app.database import db_manager

logger = logging.getLogger(__name__)


def _cache_key(sql: str) -> str:
    """SHA-256 of the normalised SQL (stripped + lowercased whitespace)."""
    normalised = " ".join(sql.strip().split())
    return hashlib.sha256(normalised.encode()).hexdigest()


class PgCacheService:
    """Postgres-backed tile result cache."""

    # ------------------------------------------------------------------
    # READ
    # ------------------------------------------------------------------

    async def get_tile_cache(self, tile_id: str) -> Optional[Dict[str, Any]]:
        """
        Return cached data for a tile if it exists and has not expired.
        Returns None on cache miss or stale entry (caller falls back to live query).
        """
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        tc.id,
                        tc.tile_id,
                        tc.dashboard_id,
                        tc.cache_key,
                        tc.cached_data,
                        tc.row_count,
                        tc.execution_time_ms,
                        tc.cached_at,
                        tc.expires_at,
                        tc.refresh_status,
                        tc.error_message
                    FROM nexus.tile_cache tc
                    WHERE tc.tile_id = :tile_id
                """),
                {"tile_id": tile_id},
            )
            row = result.fetchone()
            if not row:
                return None

            return {
                "id": str(row.id),
                "tile_id": str(row.tile_id),
                "dashboard_id": str(row.dashboard_id),
                "cache_key": row.cache_key,
                "cached_data": row.cached_data,
                "row_count": row.row_count,
                "execution_time_ms": row.execution_time_ms,
                "cached_at": row.cached_at.isoformat() if row.cached_at else None,
                "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                "refresh_status": row.refresh_status,
                "error_message": row.error_message,
                "is_fresh": (
                    row.refresh_status == "success"
                    and row.expires_at is not None
                    and row.expires_at > datetime.utcnow()
                ),
                "is_stale": (
                    row.refresh_status == "success"
                    and row.expires_at is not None
                    and row.expires_at <= datetime.utcnow()
                ),
            }

    async def get_dashboard_cache_status(
        self, dashboard_id: str
    ) -> List[Dict[str, Any]]:
        """Return cache status for every tile in a dashboard."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        dt.id              AS tile_id,
                        dt.title,
                        dt.refresh_interval_seconds,
                        tc.refresh_status,
                        tc.cached_at,
                        tc.expires_at,
                        tc.row_count,
                        tc.execution_time_ms,
                        tc.error_message
                    FROM nexus.dashboard_tiles dt
                    LEFT JOIN nexus.tile_cache tc ON tc.tile_id = dt.id
                    WHERE dt.dashboard_id = :dashboard_id
                    ORDER BY dt.created_at
                """),
                {"dashboard_id": dashboard_id},
            )
            rows = result.fetchall()
            now = datetime.utcnow()
            return [
                {
                    "tile_id": str(r.tile_id),
                    "title": r.title,
                    "refresh_interval_seconds": r.refresh_interval_seconds,
                    "refresh_status": r.refresh_status or "uncached",
                    "cached_at": r.cached_at.isoformat() if r.cached_at else None,
                    "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                    "row_count": r.row_count,
                    "execution_time_ms": r.execution_time_ms,
                    "error_message": r.error_message,
                    "is_fresh": bool(
                        r.refresh_status == "success"
                        and r.expires_at
                        and r.expires_at > now
                    ),
                }
                for r in rows
            ]

    # ------------------------------------------------------------------
    # WRITE
    # ------------------------------------------------------------------

    async def upsert_tile_cache(
        self,
        tile_id: str,
        dashboard_id: str,
        sql_query: str,
        result_data: Dict[str, Any],
        refresh_interval_seconds: int,
        refreshed_by: Optional[str] = None,
    ) -> None:
        """
        Insert or replace cached result for a tile.
        Called after a successful Trino execution.
        """
        key = _cache_key(sql_query)
        now = datetime.utcnow()
        # Add ±15% jitter so tiles cached in the same batch don't all expire
        # simultaneously on the next sweep (avoids thundering herd on Trino).
        jitter_range = int(refresh_interval_seconds * 0.15)
        jitter = random.randint(-jitter_range, jitter_range)
        expires = now + timedelta(seconds=refresh_interval_seconds + jitter)
        row_count = result_data.get("query_results", {}).get("row_count", 0)
        exec_ms = int(result_data.get("execution_time", 0))

        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    INSERT INTO nexus.tile_cache (
                        tile_id, dashboard_id, cache_key,
                        cached_data, row_count, execution_time_ms,
                        cached_at, expires_at, refresh_status,
                        error_message, refreshed_by
                    ) VALUES (
                        :tile_id, :dashboard_id, :cache_key,
                        CAST(:cached_data AS jsonb), :row_count, :exec_ms,
                        :cached_at, :expires_at, 'success',
                        NULL, :refreshed_by
                    )
                    ON CONFLICT (tile_id) DO UPDATE SET
                        cache_key           = EXCLUDED.cache_key,
                        cached_data         = EXCLUDED.cached_data,
                        row_count           = EXCLUDED.row_count,
                        execution_time_ms   = EXCLUDED.execution_time_ms,
                        cached_at           = EXCLUDED.cached_at,
                        expires_at          = EXCLUDED.expires_at,
                        refresh_status      = 'success',
                        error_message       = NULL,
                        refreshed_by        = EXCLUDED.refreshed_by,
                        updated_at          = CURRENT_TIMESTAMP
                """),
                {
                    "tile_id": tile_id,
                    "dashboard_id": dashboard_id,
                    "cache_key": key,
                    "cached_data": json.dumps(result_data.get("query_results", {})),
                    "row_count": row_count,
                    "exec_ms": exec_ms,
                    "cached_at": now,
                    "expires_at": expires,
                    "refreshed_by": refreshed_by,
                },
            )
            # Also bump last_refreshed_at on the tile itself
            await session.execute(
                text("""
                    UPDATE nexus.dashboard_tiles
                    SET last_refreshed_at = :now
                    WHERE id = :tile_id
                """),
                {"now": now, "tile_id": tile_id},
            )
            await session.commit()
        logger.info(
            f"Tile cache upserted tile_id={tile_id} rows={row_count} "
            f"expires={expires.isoformat()}"
        )

    async def mark_tile_cache_error(
        self, tile_id: str, dashboard_id: str, sql_query: str, error: str
    ) -> None:
        """Record a failed refresh attempt without overwriting previous good data."""
        key = _cache_key(sql_query)
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    INSERT INTO nexus.tile_cache (
                        tile_id, dashboard_id, cache_key,
                        refresh_status, error_message
                    ) VALUES (
                        :tile_id, :dashboard_id, :cache_key,
                        'failed', :error
                    )
                    ON CONFLICT (tile_id) DO UPDATE SET
                        refresh_status  = 'failed',
                        error_message   = EXCLUDED.error_message,
                        updated_at      = CURRENT_TIMESTAMP
                """),
                {
                    "tile_id": tile_id,
                    "dashboard_id": dashboard_id,
                    "cache_key": key,
                    "error": error[:2000],
                },
            )
            await session.commit()

    async def mark_tile_cache_stale(self, tile_id: str) -> None:
        """Mark a tile's cache as stale (e.g. when the SQL query is edited)."""
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.tile_cache
                    SET refresh_status = 'stale', updated_at = CURRENT_TIMESTAMP
                    WHERE tile_id = :tile_id
                """),
                {"tile_id": tile_id},
            )
            await session.commit()

    async def invalidate_tile_cache(self, tile_id: str) -> None:
        """Hard-delete the cache entry for a tile."""
        async with db_manager.get_session() as session:
            await session.execute(
                text("DELETE FROM nexus.tile_cache WHERE tile_id = :tile_id"),
                {"tile_id": tile_id},
            )
            await session.commit()

    async def get_stale_tile_ids(self) -> List[Dict[str, Any]]:
        """
        Return tiles whose cache has expired or never been populated.
        Used by the scheduler to auto-enqueue stale tiles.
        """
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        dt.id            AS tile_id,
                        dt.dashboard_id,
                        dt.sql_query,
                        dt.refresh_interval_seconds,
                        tc.refresh_status,
                        tc.expires_at
                    FROM nexus.dashboard_tiles dt
                    LEFT JOIN nexus.tile_cache tc ON tc.tile_id = dt.id
                    WHERE
                        -- Never cached
                        tc.tile_id IS NULL
                        -- Or cache expired
                        OR tc.expires_at <= CURRENT_TIMESTAMP
                        -- Or previously failed (retry on next poll)
                        OR tc.refresh_status IN ('failed', 'stale')
                    ORDER BY tc.expires_at NULLS FIRST
                """)
            )
            return [
                {
                    "tile_id": str(r.tile_id),
                    "dashboard_id": str(r.dashboard_id),
                    "sql_query": r.sql_query,
                    "refresh_interval_seconds": r.refresh_interval_seconds or settings.tile_cache_default_ttl,
                    "refresh_status": r.refresh_status,
                }
                for r in result.fetchall()
            ]


pg_cache_service = PgCacheService()
