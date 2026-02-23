"""Trino client for fetching database schema metadata."""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional

from trino.dbapi import connect
from trino.auth import BasicAuthentication

logger = logging.getLogger("trino-client")


class TrinoSchemaService:
    """Service for fetching schema metadata from Trino."""
    
    def __init__(self, host: str, port: int = 8080, user: str = "admin", password: str = "", 
                 catalog: Optional[str] = None, ssl: bool = False, include_tpch: bool = False,
                 extra_excluded_catalogs: Optional[List[str]] = None):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.catalog = catalog
        self.ssl = ssl
        self.include_tpch = include_tpch
        self.extra_excluded_catalogs = extra_excluded_catalogs or []
        self.connection = None

    def connect(self):
        """Establish connection to Trino."""
        try:
            # SSL configuration
            ssl_enabled = self.ssl
            # Read TRINO_SSL_VERIFY (defaults to true for security)
            ssl_verify_env = os.getenv("TRINO_SSL_VERIFY", "true").lower()
            verify_ssl = ssl_verify_env in ("true", "1", "yes")
            
            # Auto-detect SSL for port 443
            if not ssl_enabled and self.port == 443:
                ssl_enabled = True
                logger.info("Port 443 detected, auto-enabling SSL")
            
            # Build connection parameters
            connect_params = {
                "host": self.host,
                "port": self.port,
                "catalog": self.catalog,
                "user": self.user
            }
            
            if ssl_enabled:
                connect_params["http_scheme"] = "https"
                connect_params["verify"] = verify_ssl
                logger.info(f"Using HTTPS with SSL verification: {ssl_verification}")
            else:
                logger.info("Using HTTP (SSL disabled)")
            
            # Use basic auth if password is provided
            if self.password:
                logger.info(f"Using basic authentication for user: {self.user}")
                auth_obj = BasicAuthentication(self.user, self.password)
                connect_params["auth"] = auth_obj
            
            self.connection = connect(**connect_params)
            logger.info(f"Connected to Trino at {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Trino connect failed: {e}")
            raise

    async def get_all_schemas(self, retries: int = 3, backoff_base: float = 1.0) -> List[Dict[str, Any]]:
        """Fetch catalog/schema/table/columns with connector types using system.jdbc.columns."""
        logger.info("Starting get_all_schemas - fetching schemas with connector types")
        if not self.connection:
            self.connect()

        # Build excluded catalogs list based on configuration
        excluded_catalogs = ['system', 'jmx', 'memory', 'tpcds']
        if not self.include_tpch:
            excluded_catalogs.append('tpch')
        
        # Add any extra excluded catalogs from environment variable
        if self.extra_excluded_catalogs:
            excluded_catalogs.extend(self.extra_excluded_catalogs)
            logger.info(f"Including extra excluded catalogs: {self.extra_excluded_catalogs}")
        
        # Build the NOT IN clause
        excluded_catalogs_str = ', '.join(f"'{cat}'" for cat in excluded_catalogs)
        
        # For TPC-H, only load sf1 and tiny (exclude large scale factors: sf10, sf100, sf1000, etc.)
        # Join with system.metadata.catalogs to get connector_name in the same query
        query = f"""
            SELECT
                c.table_cat   AS catalog,
                c.table_schem AS schema,
                c.table_name,
                t.table_type,
                c.column_name,
                c.type_name   AS data_type,
                cat.connector_name AS connector_type
            FROM system.jdbc.columns c
            LEFT JOIN system.jdbc.tables t
                ON c.table_cat   = t.table_cat
            AND c.table_schem = t.table_schem
            AND c.table_name  = t.table_name
            LEFT JOIN system.metadata.catalogs cat
                ON c.table_cat = cat.catalog_name
            WHERE c.table_cat NOT IN ({excluded_catalogs_str})
            AND c.table_schem <> 'information_schema'
            AND c.table_schem <> 'nexus'
            AND t.table_type IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
            AND (
                c.table_cat <> 'tpch' 
                OR c.table_schem IN ('sf1', 'tiny')
            )
            ORDER BY
                catalog,
                schema,
                table_name,
                column_name
        """
        
        logger.info(f"Loading schemas (include_tpch={self.include_tpch}, excluded={excluded_catalogs})")

        attempt = 0
        while True:
            try:
                logger.info(f"Executing schema query (attempt {attempt + 1}/{retries})")
                cursor = self.connection.cursor()
                cursor.execute(query)
                logger.info("Query executed, fetching results...")
                rows = cursor.fetchall()
                logger.info(f"Fetched {len(rows)} raw rows from Trino")
                cursor.close()

                # Group by table
                table_map: Dict[str, Dict[str, Any]] = {}
                connector_type_logged = False
                for catalog, schema, table, table_type, col, dtype, connector_type in rows:
                    key = f"{catalog}.{schema}.{table}"
                    if key not in table_map:
                        # Log first connector type as verification
                        if not connector_type_logged:
                            logger.info(f"Connector type fetched from query: '{connector_type}' for catalog '{catalog}'")
                            connector_type_logged = True
                        
                        table_map[key] = {
                            "catalog": catalog,
                            "schema": schema,
                            "table": table,
                            "type": table_type,
                            "full_name": key,
                            "connector_type": connector_type or "unknown",
                            "columns": []
                        }
                    table_map[key]["columns"].append(f"{col}|{self._normalize_data_type(dtype)}")

                schemas = list(table_map.values())
                
                # Log summary statistics
                catalogs = set(s['catalog'] for s in schemas)
                schema_names = set(f"{s['catalog']}.{s['schema']}" for s in schemas)
                total_columns = sum(len(s['columns']) for s in schemas)
                
                logger.info("SCHEMA SUMMARY:")
                logger.info(f"  Catalogs: {len(catalogs)} ({', '.join(sorted(catalogs))})")
                logger.info(f"  Schemas: {len(schema_names)}")
                logger.info(f"  Tables: {len(schemas)}")
                logger.info(f"  Total Columns: {total_columns}")
                logger.info(f"  Schema Objects: {len(schemas)}")
                
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

