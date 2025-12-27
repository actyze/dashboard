"""SQL parsing utilities for access control.

This is an analytics platform - only SELECT queries are allowed.
Groups and their users have read-only access to specific tables.
"""

import re
from typing import List, Dict
import structlog

logger = structlog.get_logger()


def extract_tables_from_sql(sql: str) -> List[Dict[str, str]]:
    """
    Extract table references from SELECT queries only.
    Returns list of dicts with catalog, database, schema, and table.
    
    Handles:
    - catalog.database.schema.table
    - database.schema.table
    - schema.table
    - table
    
    This is an analytics platform - only SELECT queries are supported.
    """
    tables = []
    
    # Remove comments
    sql_no_comments = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    sql_no_comments = re.sub(r'/\*.*?\*/', '', sql_no_comments, flags=re.DOTALL)
    
    # SQL patterns for table references in SELECT queries (FROM/JOIN clauses only)
    patterns = [
        # FROM/JOIN clauses with optional catalog.database.schema.table
        r'(?:FROM|JOIN)\s+(?:LATERAL\s+)?([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+){0,3})',
    ]
    
    table_refs = set()
    
    for pattern in patterns:
        matches = re.findall(pattern, sql_no_comments, re.IGNORECASE)
        table_refs.update(matches)
    
    # Parse each table reference
    for ref in table_refs:
        parts = ref.split('.')
        
        if len(parts) == 4:
            # catalog.database.schema.table
            tables.append({
                "catalog": parts[0],
                "database": parts[1],
                "schema": parts[2],
                "table": parts[3]
            })
        elif len(parts) == 3:
            # database.schema.table (assume postgres catalog)
            tables.append({
                "catalog": "postgres",
                "database": parts[0],
                "schema": parts[1],
                "table": parts[2]
            })
        elif len(parts) == 2:
            # schema.table (assume postgres catalog, default database)
            tables.append({
                "catalog": "postgres",
                "database": "demo",  # Default database
                "schema": parts[0],
                "table": parts[1]
            })
        else:
            # Just table name (assume defaults)
            tables.append({
                "catalog": "postgres",
                "database": "demo",
                "schema": "public",
                "table": parts[0]
            })
    
    logger.info("Extracted tables from SQL", table_count=len(tables), tables=[t["table"] for t in tables])
    
    return tables


def is_select_query(sql: str) -> bool:
    """
    Check if the SQL query is a SELECT query.
    Analytics platform only allows SELECT queries.
    """
    sql_upper = sql.strip().upper()
    return sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')

