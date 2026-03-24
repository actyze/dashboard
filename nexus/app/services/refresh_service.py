"""
Refresh Service — job queue orchestration for tile/dashboard/KPI refresh.

Uses PostgreSQL SKIP LOCKED so multiple Nexus pods can poll concurrently
without double-processing any job. Each pod claims a batch of pending jobs
by locking them, executes the Trino queries, and writes results to tile_cache.

Job lifecycle:
  pending → running → completed | failed | partial
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import text

from app.config import settings
from app.database import db_manager
from app.services.pg_cache_service import pg_cache_service, _cache_key
from app.services.trino_service import TrinoService

logger = logging.getLogger(__name__)

# Singleton Trino service reused across jobs
_trino = TrinoService()

# How many pending jobs a single pod claims per scheduler tick
_JOB_BATCH_SIZE = 5


class RefreshService:
    """Enqueue, claim, and execute tile/dashboard refresh jobs."""

    # ------------------------------------------------------------------
    # ENQUEUE
    # ------------------------------------------------------------------

    async def enqueue_dashboard_refresh(
        self,
        dashboard_id: str,
        triggered_by: str = "manual",
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enqueue a batch refresh for all tiles in a dashboard.
        Returns the created job dict.
        """
        async with db_manager.get_session() as session:
            # Fetch all tiles for this dashboard
            tiles_result = await session.execute(
                text("""
                    SELECT id, sql_query, refresh_interval_seconds
                    FROM nexus.dashboard_tiles
                    WHERE dashboard_id = :dashboard_id
                """),
                {"dashboard_id": dashboard_id},
            )
            tiles = tiles_result.fetchall()
            if not tiles:
                return {"success": False, "error": "Dashboard has no tiles"}

            tile_ids = [str(t.id) for t in tiles]
            total = len(tile_ids)

            # For dashboards with many tiles, create one umbrella tracking job
            # PLUS individual tile jobs so work spreads across pods via SKIP LOCKED.
            result = await session.execute(
                text("""
                    INSERT INTO nexus.refresh_jobs (
                        job_type, entity_id, entity_type,
                        status, total_items, triggered_by,
                        created_by, metadata
                    ) VALUES (
                        'dashboard', :entity_id, 'dashboard',
                        'pending', :total, :triggered_by,
                        :created_by, CAST(:metadata AS jsonb)
                    )
                    RETURNING id, created_at
                """),
                {
                    "entity_id": dashboard_id,
                    "total": total,
                    "triggered_by": triggered_by,
                    "created_by": created_by,
                    "metadata": json.dumps({"tile_ids": tile_ids, "fan_out": True}),
                },
            )
            row = result.fetchone()
            dashboard_job_id = str(row.id)

            # Fan-out: create individual tile jobs so pods work in parallel
            for tile_id in tile_ids:
                await session.execute(
                    text("""
                        INSERT INTO nexus.refresh_jobs (
                            job_type, entity_id, entity_type,
                            status, total_items, triggered_by,
                            created_by, metadata
                        ) VALUES (
                            'tile', :tile_id, 'tile',
                            'pending', 1, :triggered_by,
                            :created_by, CAST(:metadata AS jsonb)
                        )
                    """),
                    {
                        "tile_id": tile_id,
                        "triggered_by": triggered_by,
                        "created_by": created_by,
                        "metadata": json.dumps({
                            "tile_ids": [tile_id],
                            "dashboard_id": dashboard_id,
                            "parent_job_id": dashboard_job_id,
                        }),
                    },
                )

            await session.commit()

        logger.info(
            f"Enqueued dashboard refresh job={dashboard_job_id} "
            f"dashboard={dashboard_id} tiles={total} triggered_by={triggered_by} fan_out=true"
        )
        return {
            "success": True,
            "job_id": dashboard_job_id,
            "dashboard_id": dashboard_id,
            "total_tiles": total,
            "tile_ids": tile_ids,
            "status": "pending",
            "created_at": row.created_at.isoformat(),
        }

    async def enqueue_tile_refresh(
        self,
        tile_id: str,
        dashboard_id: str,
        triggered_by: str = "manual",
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Enqueue a single-tile refresh job."""
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    INSERT INTO nexus.refresh_jobs (
                        job_type, entity_id, entity_type,
                        status, total_items, triggered_by,
                        created_by, metadata
                    ) VALUES (
                        'tile', :tile_id, 'tile',
                        'pending', 1, :triggered_by,
                        :created_by, CAST(:metadata AS jsonb)
                    )
                    RETURNING id, created_at
                """),
                {
                    "tile_id": tile_id,
                    "triggered_by": triggered_by,
                    "created_by": created_by,
                    "metadata": json.dumps({"tile_ids": [tile_id], "dashboard_id": dashboard_id}),
                },
            )
            row = result.fetchone()
            await session.commit()

        logger.info(f"Enqueued tile refresh job={row.id} tile={tile_id}")
        return {
            "success": True,
            "job_id": str(row.id),
            "tile_id": tile_id,
            "status": "pending",
            "created_at": row.created_at.isoformat(),
        }

    # ------------------------------------------------------------------
    # CLAIM + PROCESS (called by scheduler on each pod)
    # ------------------------------------------------------------------

    async def process_pending_jobs(self) -> int:
        """
        Claim up to _JOB_BATCH_SIZE pending jobs using SKIP LOCKED,
        execute them, and return the count processed.
        """
        async with db_manager.get_session() as session:
            # Claim jobs — SKIP LOCKED ensures each pod gets distinct jobs
            result = await session.execute(
                text("""
                    SELECT id, job_type, entity_id, entity_type, metadata
                    FROM nexus.refresh_jobs
                    WHERE status = 'pending'
                      AND scheduled_for <= CURRENT_TIMESTAMP
                    ORDER BY created_at
                    LIMIT :batch_size
                    FOR UPDATE SKIP LOCKED
                """),
                {"batch_size": _JOB_BATCH_SIZE},
            )
            jobs = result.fetchall()
            if not jobs:
                return 0

            # Mark all claimed jobs as running
            job_ids = [str(j.id) for j in jobs]
            await session.execute(
                text("""
                    UPDATE nexus.refresh_jobs
                    SET status = 'running', started_at = CURRENT_TIMESTAMP
                    WHERE id = ANY(CAST(:ids AS uuid[]))
                """),
                {"ids": job_ids},
            )
            await session.commit()

        # Process each job outside the lock
        processed = 0
        for job in jobs:
            try:
                await self._execute_job(job)
                processed += 1
            except Exception as exc:
                logger.error(f"Job {job.id} failed with unhandled exception: {exc}")
                await self._mark_job_failed(str(job.id), str(exc))

        return processed

    async def _execute_job(self, job) -> None:
        """Execute a single refresh job end-to-end."""
        job_id = str(job.id)
        metadata = job.metadata or {}

        if job.job_type in ("dashboard", "tile"):
            tile_ids: List[str] = metadata.get("tile_ids", [])
            if not tile_ids and job.job_type == "tile":
                tile_ids = [str(job.entity_id)]

            completed = 0
            failed = 0

            for tile_id in tile_ids:
                success = await self._refresh_single_tile(tile_id, job_id)
                if success:
                    completed += 1
                else:
                    failed += 1

                # Update progress after each tile
                await self._update_job_progress(job_id, completed, failed)

            # Mark final status
            if failed == 0:
                final_status = "completed"
            elif completed == 0:
                final_status = "failed"
            else:
                final_status = "partial"

            await self._mark_job_done(job_id, final_status)

        elif job.job_type == "kpi_metric":
            # Phase 2 placeholder — KPI metric collection
            logger.info(f"KPI metric job {job_id} skipped (Phase 2 not implemented)")
            await self._mark_job_done(job_id, "completed")

    async def _refresh_single_tile(self, tile_id: str, job_id: str) -> bool:
        """Execute SQL for one tile and upsert cache. Returns True on success."""
        try:
            async with db_manager.get_session() as session:
                result = await session.execute(
                    text("""
                        SELECT dt.id, dt.dashboard_id, dt.sql_query,
                               dt.refresh_interval_seconds
                        FROM nexus.dashboard_tiles dt
                        WHERE dt.id = :tile_id
                    """),
                    {"tile_id": tile_id},
                )
                tile = result.fetchone()

            if not tile:
                logger.warning(f"Tile {tile_id} not found, skipping")
                return False

            ttl = tile.refresh_interval_seconds or settings.tile_cache_default_ttl
            sql = tile.sql_query

            # Mark tile cache as 'running' so recovery can identify in-flight work
            async with db_manager.get_session() as session:
                await session.execute(
                    text("""
                        INSERT INTO nexus.tile_cache (tile_id, dashboard_id, cache_key, refresh_status)
                        VALUES (:tile_id, :dashboard_id, :cache_key, 'running')
                        ON CONFLICT (tile_id) DO UPDATE
                            SET refresh_status = 'running', updated_at = CURRENT_TIMESTAMP
                    """),
                    {
                        "tile_id": tile_id,
                        "dashboard_id": str(tile.dashboard_id),
                        "cache_key": _cache_key(sql),
                    },
                )
                await session.commit()

            result = await _trino.execute_query(
                sql,
                max_results=settings.tile_cache_max_rows,
                timeout_seconds=settings.trino_execute_timeout_seconds,
            )

            if result["success"]:
                await pg_cache_service.upsert_tile_cache(
                    tile_id=tile_id,
                    dashboard_id=str(tile.dashboard_id),
                    sql_query=sql,
                    result_data=result,
                    refresh_interval_seconds=ttl,
                )
                logger.info(f"Tile {tile_id} refreshed successfully job={job_id}")
                return True
            else:
                error = result.get("error", "Unknown error")
                await pg_cache_service.mark_tile_cache_error(
                    tile_id=tile_id,
                    dashboard_id=str(tile.dashboard_id),
                    sql_query=sql,
                    error=error,
                )
                logger.warning(f"Tile {tile_id} refresh failed: {error}")
                return False

        except Exception as exc:
            logger.error(f"Unexpected error refreshing tile {tile_id}: {exc}")
            try:
                async with db_manager.get_session() as session:
                    result = await session.execute(
                        text("SELECT dashboard_id, sql_query FROM nexus.dashboard_tiles WHERE id = :id"),
                        {"id": tile_id},
                    )
                    row = result.fetchone()
                if row:
                    await pg_cache_service.mark_tile_cache_error(
                        tile_id=tile_id,
                        dashboard_id=str(row.dashboard_id),
                        sql_query=row.sql_query,
                        error=str(exc),
                    )
            except Exception:
                pass
            return False

    # ------------------------------------------------------------------
    # JOB STATUS HELPERS
    # ------------------------------------------------------------------

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, job_type, entity_id, entity_type,
                           status, total_items, completed_items, failed_items,
                           started_at, completed_at, triggered_by, metadata, created_at
                    FROM nexus.refresh_jobs
                    WHERE id = :job_id
                """),
                {"job_id": job_id},
            )
            row = result.fetchone()
        if not row:
            return None
        return self._job_to_dict(row)

    async def get_dashboard_latest_job(self, dashboard_id: str) -> Optional[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, job_type, entity_id, entity_type,
                           status, total_items, completed_items, failed_items,
                           started_at, completed_at, triggered_by, metadata, created_at
                    FROM nexus.refresh_jobs
                    WHERE entity_id = :dashboard_id
                      AND entity_type = 'dashboard'
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"dashboard_id": dashboard_id},
            )
            row = result.fetchone()
        return self._job_to_dict(row) if row else None

    async def list_recent_jobs(
        self, limit: int = 20, job_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        async with db_manager.get_session() as session:
            query = """
                SELECT id, job_type, entity_id, entity_type,
                       status, total_items, completed_items, failed_items,
                       started_at, completed_at, triggered_by, created_at
                FROM nexus.refresh_jobs
            """
            params: Dict[str, Any] = {"limit": limit}
            if job_type:
                query += " WHERE job_type = :job_type"
                params["job_type"] = job_type
            query += " ORDER BY created_at DESC LIMIT :limit"
            result = await session.execute(text(query), params)
            return [self._job_to_dict(r) for r in result.fetchall()]

    def _job_to_dict(self, row) -> Dict[str, Any]:
        progress_pct = (
            round((row.completed_items / row.total_items) * 100)
            if row.total_items and row.total_items > 0
            else 0
        )
        return {
            "job_id": str(row.id),
            "job_type": row.job_type,
            "entity_id": str(row.entity_id),
            "entity_type": row.entity_type,
            "status": row.status,
            "total_items": row.total_items,
            "completed_items": row.completed_items,
            "failed_items": row.failed_items,
            "progress_pct": progress_pct,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
            "triggered_by": row.triggered_by,
            "created_at": row.created_at.isoformat(),
        }

    async def _update_job_progress(
        self, job_id: str, completed: int, failed: int
    ) -> None:
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.refresh_jobs
                    SET completed_items = :completed, failed_items = :failed
                    WHERE id = :job_id
                """),
                {"job_id": job_id, "completed": completed, "failed": failed},
            )
            await session.commit()

    async def _mark_job_done(self, job_id: str, status: str) -> None:
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.refresh_jobs
                    SET status = :status, completed_at = CURRENT_TIMESTAMP
                    WHERE id = :job_id
                """),
                {"job_id": job_id, "status": status},
            )
            await session.commit()
        logger.info(f"Job {job_id} finished status={status}")

    async def _mark_job_failed(self, job_id: str, error: str) -> None:
        async with db_manager.get_session() as session:
            await session.execute(
                text("""
                    UPDATE nexus.refresh_jobs
                    SET status = 'failed',
                        completed_at = CURRENT_TIMESTAMP,
                        metadata = metadata || CAST(:patch AS jsonb)
                    WHERE id = :job_id
                """),
                {
                    "job_id": job_id,
                    "patch": json.dumps({"error": error[:500]}),
                },
            )
            await session.commit()

    # ------------------------------------------------------------------
    # STARTUP RECOVERY
    # ------------------------------------------------------------------

    async def recover_stuck_jobs(self) -> int:
        """
        Called once at startup. Resets any jobs still marked 'running' back to
        'pending' so they are re-picked-up by the next process sweep.

        This handles the case where a pod crashed mid-execution and left jobs
        in a running state that no other pod will ever touch (SKIP LOCKED only
        grabs 'pending'). The affected tile_cache rows are also rolled back to
        'stale' so dashboards don't show a forever-spinning "refreshing" state.
        """
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    UPDATE nexus.refresh_jobs
                    SET
                        status       = 'pending',
                        started_at   = NULL,
                        metadata     = metadata || CAST('{"recovered": true}' AS jsonb)
                    WHERE status = 'running'
                    RETURNING id, entity_id, entity_type, metadata
                """)
            )
            recovered_jobs = result.fetchall()
            count = len(recovered_jobs)

            if count:
                # Reset tile_cache status for any tiles belonging to recovered jobs
                tile_ids_to_reset = []
                for job in recovered_jobs:
                    meta = job.metadata or {}
                    tile_ids_to_reset.extend(meta.get("tile_ids", []))
                    if job.entity_type == "tile":
                        tile_ids_to_reset.append(str(job.entity_id))

                if tile_ids_to_reset:
                    await session.execute(
                        text("""
                            UPDATE nexus.tile_cache
                            SET refresh_status = 'stale',
                                updated_at     = CURRENT_TIMESTAMP
                            WHERE tile_id = ANY(CAST(:ids AS uuid[]))
                              AND refresh_status = 'running'
                        """),
                        {"ids": list(set(tile_ids_to_reset))},
                    )

            await session.commit()

        if count:
            logger.warning(
                f"Startup recovery: reset {count} stuck 'running' job(s) back to 'pending'"
            )
        else:
            logger.info("Startup recovery: no stuck jobs found")

        return count

    # ------------------------------------------------------------------
    # SCHEDULED AUTO-ENQUEUE (called by scheduler)
    # ------------------------------------------------------------------

    async def enqueue_stale_tiles(self) -> int:
        """
        Find tiles with expired/missing cache and auto-enqueue individual
        tile refresh jobs. This is the scheduled background sweep.
        """
        stale = await pg_cache_service.get_stale_tile_ids()
        if not stale:
            return 0

        count = 0
        for tile in stale:
            # Skip tiles that already have a pending/running job
            if await self._tile_has_active_job(tile["tile_id"]):
                continue
            await self.enqueue_tile_refresh(
                tile_id=tile["tile_id"],
                dashboard_id=tile["dashboard_id"],
                triggered_by="scheduled",
            )
            count += 1

        if count:
            logger.info(f"Auto-enqueued {count} stale tile refresh jobs")
        return count

    async def _tile_has_active_job(self, tile_id: str) -> bool:
        async with db_manager.get_session() as session:
            result = await session.execute(
                text("""
                    SELECT 1 FROM nexus.refresh_jobs
                    WHERE entity_id = :tile_id
                      AND entity_type = 'tile'
                      AND status IN ('pending', 'running')
                    LIMIT 1
                """),
                {"tile_id": tile_id},
            )
            return result.fetchone() is not None


refresh_service = RefreshService()
