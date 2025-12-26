"""Database migrations runner for Nexus service.

This module runs Flyway-compatible SQL migrations on startup,
eliminating the need for a separate Flyway container.
"""

import os
import hashlib
from pathlib import Path
from typing import List, Tuple, Optional
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = structlog.get_logger(__name__)


class MigrationRunner:
    """Runs SQL migrations from db/migrations directory."""
    
    def __init__(self, migrations_dir: str = None):
        """Initialize migration runner.
        
        Args:
            migrations_dir: Path to migrations directory (default: ../db/migrations)
        """
        if migrations_dir is None:
            # Default to nexus/db/migrations
            base_path = Path(__file__).parent.parent
            migrations_dir = base_path / "db" / "migrations"
        
        self.migrations_dir = Path(migrations_dir)
        logger.info("Migration runner initialized", 
                   migrations_dir=str(self.migrations_dir))
    
    def _parse_version(self, filename: str) -> Optional[Tuple[str, str]]:
        """Parse version and description from Flyway filename.
        
        Expected format: V{version}__{description}.sql
        Example: V001__user_controlled_query_saves.sql
        
        Returns:
            (version, description) or None if not a valid migration file
        """
        if not filename.startswith('V') or not filename.endswith('.sql'):
            return None
        
        try:
            # Remove 'V' prefix and '.sql' suffix
            name = filename[1:-4]
            # Split on double underscore
            parts = name.split('__', 1)
            if len(parts) != 2:
                return None
            
            version = parts[0]
            description = parts[1].replace('_', ' ')
            return (version, description)
        except Exception as e:
            logger.warning("Failed to parse migration filename", 
                         filename=filename, error=str(e))
            return None
    
    def _calculate_checksum(self, sql: str) -> int:
        """Calculate checksum for SQL content (Flyway-compatible)."""
        # Flyway uses CRC32 but we'll use a simple hash
        return int(hashlib.md5(sql.encode()).hexdigest()[:8], 16)
    
    def _get_pending_migrations(self) -> List[Tuple[str, str, str, int]]:
        """Get list of pending migrations.
        
        Returns:
            List of (version, description, filename, checksum) tuples
        """
        if not self.migrations_dir.exists():
            logger.warning("Migrations directory not found", 
                         path=str(self.migrations_dir))
            return []
        
        migrations = []
        for file_path in sorted(self.migrations_dir.glob("V*.sql")):
            result = self._parse_version(file_path.name)
            if result:
                version, description = result
                sql_content = file_path.read_text()
                checksum = self._calculate_checksum(sql_content)
                migrations.append((version, description, file_path.name, checksum))
        
        logger.info("Found migration files", count=len(migrations))
        return migrations
    
    async def _ensure_migration_table(self, conn: AsyncConnection):
        """Ensure flyway_schema_history table exists."""
        logger.info("Ensuring migration history table exists")
        
        await conn.execute(text("""
            CREATE SCHEMA IF NOT EXISTS nexus
        """))
        
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS nexus.flyway_schema_history (
                installed_rank SERIAL PRIMARY KEY,
                version VARCHAR(50),
                description VARCHAR(200) NOT NULL,
                type VARCHAR(20) NOT NULL,
                script VARCHAR(1000) NOT NULL,
                checksum BIGINT,
                installed_by VARCHAR(100) NOT NULL,
                installed_on TIMESTAMP NOT NULL DEFAULT NOW(),
                execution_time INTEGER NOT NULL,
                success BOOLEAN NOT NULL
            )
        """))
        
        # Alter checksum column to BIGINT if it exists as INTEGER
        await conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'nexus' 
                    AND table_name = 'flyway_schema_history' 
                    AND column_name = 'checksum' 
                    AND data_type = 'integer'
                ) THEN
                    ALTER TABLE nexus.flyway_schema_history 
                    ALTER COLUMN checksum TYPE BIGINT;
                END IF;
            END $$;
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx 
            ON nexus.flyway_schema_history (success)
        """))
        
        # No explicit commit - managed by context manager
    
    async def _get_applied_migrations(self, conn: AsyncConnection) -> set:
        """Get set of already applied migration versions."""
        result = await conn.execute(text("""
            SELECT version FROM nexus.flyway_schema_history 
            WHERE success = true
        """))
        applied = {row[0] for row in result.fetchall()}
        logger.info("Applied migrations", count=len(applied), versions=sorted(applied))
        return applied
    
    async def _record_migration(
        self,
        conn: AsyncConnection,
        version: str,
        description: str,
        script: str,
        checksum: int,
        execution_time_ms: int,
        success: bool
    ):
        """Record migration execution in history table."""
        await conn.execute(text("""
            INSERT INTO nexus.flyway_schema_history 
            (version, description, type, script, checksum, installed_by, execution_time, success)
            VALUES (:version, :description, 'SQL', :script, :checksum, 'nexus_service', :execution_time, :success)
        """), {
            "version": version,
            "description": description,
            "script": script,
            "checksum": checksum,
            "execution_time": execution_time_ms,
            "success": success
        })
        # No explicit commit - managed by context manager
    
    async def _run_migration(
        self,
        conn: AsyncConnection,
        version: str,
        description: str,
        filename: str,
        checksum: int
    ) -> bool:
        """Run a single migration file.
        
        Returns:
            True if successful, False otherwise
        """
        import time
        
        logger.info("Running migration", 
                   version=version, 
                   description=description,
                   filename=filename)
        
        file_path = self.migrations_dir / filename
        sql_content = file_path.read_text()
        
        start_time = time.time()
        success = False
        
        try:
            # Execute the SQL - use exec_driver_sql for multi-statement SQL files
            # asyncpg requires using the raw connection for multi-statement execution
            raw_conn = await conn.get_raw_connection()
            await raw_conn.driver_connection.execute(sql_content)
            # No explicit commit - managed by context manager
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            success = True
            
            # Record successful migration
            await self._record_migration(
                conn, version, description, filename, 
                checksum, execution_time_ms, True
            )
            
            logger.info("Migration completed successfully",
                       version=version,
                       execution_time_ms=execution_time_ms)
            
            return True
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            logger.error("Migration failed",
                        version=version,
                        error=str(e),
                        execution_time_ms=execution_time_ms)
            
            # Record failed migration
            try:
                await self._record_migration(
                    conn, version, description, filename,
                    checksum, execution_time_ms, False
                )
            except Exception as record_error:
                logger.error("Failed to record migration failure",
                           error=str(record_error))
            
            return False
    
    async def run_migrations(self, conn: AsyncConnection) -> bool:
        """Run all pending migrations.
        
        Args:
            conn: AsyncConnection to database
            
        Returns:
            True if all migrations succeeded, False if any failed
        """
        logger.info("Starting database migrations")
        
        try:
            # Ensure migration table exists
            await self._ensure_migration_table(conn)
            
            # Get applied and pending migrations
            applied = await self._get_applied_migrations(conn)
            all_migrations = self._get_pending_migrations()
            
            # Filter to only pending migrations
            pending = [
                m for m in all_migrations 
                if m[0] not in applied  # m[0] is version
            ]
            
            if not pending:
                logger.info("No pending migrations")
                return True
            
            logger.info("Found pending migrations", count=len(pending))
            
            # Run each pending migration
            for version, description, filename, checksum in pending:
                success = await self._run_migration(
                    conn, version, description, filename, checksum
                )
                if not success:
                    logger.error("Migration failed, stopping",
                               version=version)
                    return False
            
            logger.info("All migrations completed successfully",
                       total=len(pending))
            return True
            
        except Exception as e:
            logger.error("Migration process failed", error=str(e))
            return False


# Global migration runner instance
_migration_runner = None


def get_migration_runner() -> MigrationRunner:
    """Get or create global migration runner instance."""
    global _migration_runner
    if _migration_runner is None:
        _migration_runner = MigrationRunner()
    return _migration_runner


async def run_migrations(conn: AsyncConnection) -> bool:
    """Run all pending database migrations.
    
    This is the main entry point for running migrations.
    Call this during application startup.
    
    Args:
        conn: AsyncConnection to database
        
    Returns:
        True if successful, False otherwise
    """
    runner = get_migration_runner()
    return await runner.run_migrations(conn)

