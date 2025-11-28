"""Trino client for fetching database schema metadata."""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional

import trino
import trino.dbapi
import trino.auth

logger = logging.getLogger("trino-client")


class TrinoSchemaService:
    """Service for fetching schema metadata from Trino."""
    
    def __init__(self, host: str, port: int = 8080, user: str = "admin", catalog: Optional[str] = None):
        self.host = host
        self.port = port
        self.user = user
        self.catalog = catalog
        self.connection = None

    def connect(self):
        """Establish connection to Trino."""
        try:
            # Check for basic auth credentials
            auth_user = os.getenv("TRINO_AUTH_USER")
            auth_password = os.getenv("TRINO_AUTH_PASSWORD")
            
            # Check SSL configuration
            ssl_enabled = os.getenv("TRINO_SSL_ENABLED", "false").lower() == "true"
            ssl_verification = os.getenv("TRINO_SSL_VERIFICATION", "NONE").upper()
            
            # Auto-detect SSL for port 443
            if not ssl_enabled and self.port == 443:
                ssl_enabled = True
                logger.info("Port 443 detected, auto-enabling SSL")
            
            # Determine SSL verification setting
            verify_ssl = ssl_verification != "NONE"
            
            # Build connection parameters
            connect_params = {
                "host": self.host,
                "port": self.port,
                "catalog": self.catalog
            }
            
            if ssl_enabled:
                connect_params["http_scheme"] = "https"
                connect_params["verify"] = verify_ssl
                logger.info(f"Using HTTPS with SSL verification: {ssl_verification}")
            else:
                logger.info("Using HTTP (SSL disabled)")
            
            # Use basic auth if credentials provided
            if auth_user and auth_password:
                logger.info(f"Using basic authentication for user: {auth_user}")
                auth_obj = trino.auth.BasicAuthentication(auth_user, auth_password)
                connect_params["user"] = auth_user
                connect_params["auth"] = auth_obj
            else:
                connect_params["user"] = self.user
            
            self.connection = trino.dbapi.connect(**connect_params)
            logger.info(f"Connected to Trino at {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Trino connect failed: {e}")
            raise

    async def get_all_schemas(self, retries: int = 3, backoff_base: float = 1.0) -> List[Dict[str, Any]]:
        """Fetch catalog/schema/table/columns using system.jdbc.columns."""
        if not self.connection:
            self.connect()

        query = """
            SELECT
                c.table_cat   AS catalog,
                c.table_schem AS schema,
                c.table_name,
                t.table_type,
                c.column_name,
                c.type_name   AS data_type
            FROM system.jdbc.columns c
            LEFT JOIN system.jdbc.tables t
                ON c.table_cat   = t.table_cat
            AND c.table_schem = t.table_schem
            AND c.table_name  = t.table_name
            WHERE c.table_cat NOT IN (
                'system',
                'jmx',
                'memory',
                'tpcds',
                'tpch'
            )
            AND c.table_schem <> 'information_schema'
            AND t.table_type IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
            ORDER BY
                catalog,
                schema,
                table_name,
                column_name
        """

        attempt = 0
        while True:
            try:
                logger.info(f"🔍 Executing schema query (attempt {attempt + 1}/{retries})")
                cursor = self.connection.cursor()
                cursor.execute(query)
                logger.info("📊 Query executed, fetching results...")
                rows = cursor.fetchall()
                logger.info(f"✅ Fetched {len(rows)} raw rows from Trino")
                cursor.close()

                # Group by table
                table_map: Dict[str, Dict[str, Any]] = {}
                for catalog, schema, table, table_type, col, dtype in rows:
                    key = f"{catalog}.{schema}.{table}"
                    if key not in table_map:
                        table_map[key] = {
                            "catalog": catalog,
                            "schema": schema,
                            "table": table,
                            "type": table_type,
                            "full_name": key,
                            "columns": []
                        }
                    table_map[key]["columns"].append(f"{col}|{self._normalize_data_type(dtype)}")

                schemas = list(table_map.values())
                
                # Log summary statistics
                catalogs = set(s['catalog'] for s in schemas)
                schema_names = set(f"{s['catalog']}.{s['schema']}" for s in schemas)
                total_columns = sum(len(s['columns']) for s in schemas)
                
                logger.info("📊 SCHEMA SUMMARY:")
                logger.info(f"  • Catalogs: {len(catalogs)} ({', '.join(sorted(catalogs))})")
                logger.info(f"  • Schemas: {len(schema_names)}")
                logger.info(f"  • Tables: {len(schemas)}")
                logger.info(f"  • Total Columns: {total_columns}")
                logger.info(f"  • Schema Objects: {len(schemas)}")
                
                return schemas

            except Exception as e:
                attempt += 1
                wait = backoff_base * (2 ** (attempt - 1))
                logger.warning(f"Schema fetch failed (attempt {attempt}/{retries}): {e}. Retrying in {wait:.1f}s")
                if attempt >= retries:
                    logger.error("Schema fetch failed after retries.")
                    raise
                await asyncio.sleep(wait)

    @staticmethod
    def _normalize_data_type(trino_type: str) -> str:
        """Normalize Trino data types to simplified categories."""
        trino_type = trino_type.lower()
        
        if any(t in trino_type for t in ['integer', 'int', 'bigint', 'smallint', 'tinyint']):
            return 'integer'
        if any(t in trino_type for t in ['decimal', 'numeric', 'float', 'double', 'real']):
            return 'number'
        if any(t in trino_type for t in ['date', 'time', 'timestamp']):
            return 'date'
        if 'boolean' in trino_type:
            return 'boolean'
        return 'string'

