"""
APScheduler service with SQLAlchemyJobStore.

All Nexus pods share the same PostgreSQL job store so APScheduler's
internal deduplication prevents double-firing of the same scheduled job.
The refresh_service.process_pending_jobs() call then uses SKIP LOCKED so
work is distributed across pods without Redis.

Schedules:
  - enqueue_sweep   : every tile_cache_refresh_interval_seconds (default 7200)
                      Checks which tiles are stale and enqueues refresh jobs.
  - process_sweep   : every tile_cache_poll_interval_seconds (default 30)
                      Each pod claims and processes pending jobs from the queue.
"""

import asyncio
import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

from app.config import settings

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


def _get_job_store_url() -> str:
    """Build a sync psycopg2 URL for APScheduler from individual settings fields."""
    return (
        f"postgresql://{settings.postgres_user}:{settings.postgres_password}"
        f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_database}"
    )


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        store_url = _get_job_store_url()
        from apscheduler.jobstores.memory import MemoryJobStore
        jobstores = {
            # Shared Postgres store: used for the enqueue sweep so only one pod
            # fires it per interval (APScheduler deduplicates via next_run_time).
            "default": SQLAlchemyJobStore(
                url=store_url,
                tablename="apscheduler_jobs",
                tableschema="nexus",
            ),
            # Local memory store: used for the process sweep which must run on
            # EVERY pod independently to distribute work via SKIP LOCKED.
            "local": MemoryJobStore(),
        }
        job_defaults = {
            "coalesce": True,   # Missed fires collapse into one execution
            "max_instances": 1, # Never overlap same job
        }
        _scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            job_defaults=job_defaults,
            timezone="UTC",
        )
    return _scheduler


async def _run_enqueue_sweep() -> None:
    """Async wrapper called by APScheduler."""
    try:
        from app.services.refresh_service import refresh_service
        count = await refresh_service.enqueue_stale_tiles()
        if count:
            logger.info(f"Enqueue sweep: {count} stale tiles enqueued")
    except Exception as exc:
        logger.error(f"Enqueue sweep failed: {exc}")


async def _run_process_sweep() -> None:
    """Async wrapper called by APScheduler."""
    try:
        from app.services.refresh_service import refresh_service
        count = await refresh_service.process_pending_jobs()
        if count:
            logger.info(f"Process sweep: {count} jobs processed")
    except Exception as exc:
        logger.error(f"Process sweep failed: {exc}")


def start_scheduler() -> None:
    """
    Register scheduled jobs and start the APScheduler.
    Should be called once from the FastAPI lifespan.

    Multi-pod notes:
    - SQLAlchemyJobStore stores job metadata in Postgres, so all pods share the
      same next_run_time for the enqueue sweep (only one pod fires it per interval).
    - The process sweep runs on EVERY pod independently — that's intentional.
      Each pod claims a distinct batch of jobs via SKIP LOCKED.
    - coalesce=True: if a pod was down and missed N scheduled fires, it runs once
      on restart rather than N times in a row.
    - replace_existing=True: safe for rolling restarts — existing job schedule
      is preserved rather than reset on each pod startup.
    """
    if not settings.tile_cache_scheduler_enabled:
        logger.info("Tile cache scheduler is DISABLED (TILE_CACHE_SCHEDULER_ENABLED=false)")
        return

    scheduler = get_scheduler()

    # Job 1: sweep for stale tiles and enqueue refresh jobs.
    # Stored in shared Postgres jobstore — only ONE pod fires this at a time.
    enqueue_interval = settings.tile_cache_refresh_interval_seconds
    scheduler.add_job(
        _run_enqueue_sweep,
        trigger="interval",
        seconds=enqueue_interval,
        id="tile_cache_enqueue_sweep",
        replace_existing=True,
        name="Tile Cache: Enqueue Stale Tiles",
    )

    # Job 2: each pod polls and processes pending jobs.
    # NOT stored in the shared jobstore — runs locally on each pod independently.
    # This is what distributes work: each pod grabs its own batch via SKIP LOCKED.
    poll_interval = settings.tile_cache_poll_interval_seconds
    scheduler.add_job(
        _run_process_sweep,
        trigger="interval",
        seconds=poll_interval,
        id="tile_cache_process_sweep",
        jobstore="local",      # runs on every pod — not shared via Postgres
        replace_existing=True,
        name="Tile Cache: Process Pending Jobs",
    )

    scheduler.start()
    logger.info(
        f"Tile cache scheduler started — "
        f"enqueue every {enqueue_interval}s, process every {poll_interval}s"
    )


def stop_scheduler() -> None:
    """Gracefully stop the scheduler (called on app shutdown)."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Tile cache scheduler stopped")
    _scheduler = None
