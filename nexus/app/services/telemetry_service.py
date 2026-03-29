"""Anonymous telemetry service for Actyze usage statistics.

Opt-out: set TELEMETRY_ENABLED=false to disable.
All errors are silently swallowed — telemetry must never crash the app.
"""

import asyncio
import platform
import uuid
from datetime import datetime, timezone

import httpx
import structlog
from sqlalchemy import text

from app.config import settings
from app.database import db_manager

logger = structlog.get_logger()

_VERSION = "1.0.0"
_DEPLOYMENT_METHOD = "docker"
_PING_INTERVAL_SECONDS = 86400  # 24 hours


class TelemetryService:
    """Sends anonymous usage pings every 24 hours."""

    def __init__(self):
        self._task: asyncio.Task | None = None
        self._instance_id: str | None = None
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self):
        """Start the background telemetry loop (no-op if disabled)."""
        if not settings.telemetry_enabled:
            logger.debug("telemetry.disabled")
            return
        try:
            self._instance_id = await self._get_or_create_instance_id()
            self._running = True
            self._task = asyncio.create_task(self._loop())
            logger.debug("telemetry.started", instance_id=self._instance_id)
        except Exception:
            logger.debug("telemetry.start_failed", exc_info=True)

    async def stop(self):
        """Cancel the background task."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        logger.debug("telemetry.stopped")

    # ------------------------------------------------------------------
    # Background loop
    # ------------------------------------------------------------------

    async def _loop(self):
        """Send a ping immediately, then every 24 hours."""
        while self._running:
            try:
                await self._send_ping()
            except Exception:
                logger.debug("telemetry.ping_failed", exc_info=True)
            try:
                await asyncio.sleep(_PING_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break

    # ------------------------------------------------------------------
    # Instance ID persistence
    # ------------------------------------------------------------------

    async def _get_or_create_instance_id(self) -> str:
        """Return a persistent instance UUID from nexus.system_config."""
        async with db_manager.engine.begin() as conn:
            await conn.execute(text(
                "CREATE TABLE IF NOT EXISTS nexus.system_config ("
                "  key   TEXT PRIMARY KEY,"
                "  value TEXT NOT NULL"
                ")"
            ))
            row = await conn.execute(text(
                "SELECT value FROM nexus.system_config WHERE key = 'instance_id'"
            ))
            result = row.scalar_one_or_none()
            if result:
                return result

            new_id = str(uuid.uuid4())
            await conn.execute(text(
                "INSERT INTO nexus.system_config (key, value) VALUES ('instance_id', :id)"
            ), {"id": new_id})
            return new_id

    # ------------------------------------------------------------------
    # Collect counts & send
    # ------------------------------------------------------------------

    async def _collect_counts(self) -> dict:
        """Gather anonymous aggregate counts from the database."""
        counts = {
            "dashboards": 0,
            "users": 0,
            "queries_30d": 0,
            "data_sources": 0,
        }
        try:
            async with db_manager.engine.connect() as conn:
                row = await conn.execute(text(
                    "SELECT COUNT(*) FROM nexus.dashboards"
                ))
                counts["dashboards"] = row.scalar() or 0

                row = await conn.execute(text(
                    "SELECT COUNT(*) FROM nexus.users"
                ))
                counts["users"] = row.scalar() or 0

                row = await conn.execute(text(
                    "SELECT COUNT(*) FROM nexus.query_history "
                    "WHERE created_at > NOW() - INTERVAL '30 days'"
                ))
                counts["queries_30d"] = row.scalar() or 0
        except Exception:
            logger.debug("telemetry.counts_partial_failure", exc_info=True)

        # Trino catalog count (best-effort)
        try:
            from trino.dbapi import connect as trino_connect

            conn_t = trino_connect(
                host=settings.trino_host,
                port=settings.trino_port,
                user=settings.trino_user,
            )
            cur = conn_t.cursor()
            cur.execute("SHOW CATALOGS")
            catalogs = cur.fetchall()
            counts["data_sources"] = len(catalogs)
            cur.close()
            conn_t.close()
        except Exception:
            logger.debug("telemetry.trino_catalog_count_failed", exc_info=True)

        return counts

    async def _send_ping(self):
        """Build the payload and POST it to the telemetry endpoint."""
        counts = await self._collect_counts()

        payload = {
            "instance_id": self._instance_id,
            "version": _VERSION,
            "deployment_method": _DEPLOYMENT_METHOD,
            "counts": counts,
            "platform": {
                "os": platform.system(),
                "arch": platform.machine(),
            },
            "llm_provider": settings.external_llm_provider or "",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(settings.telemetry_url, json=payload)
            logger.debug(
                "telemetry.ping_sent",
                status=resp.status_code,
                instance_id=self._instance_id,
            )


# Global singleton
telemetry_service = TelemetryService()
