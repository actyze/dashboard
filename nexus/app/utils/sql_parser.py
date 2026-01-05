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
    Returns list of dicts with catalog, schema, and table (Trino naming convention).
    
    Trino naming hierarchy: catalog.schema.table
    
    Handles:
    - catalog.schema.table (3 parts - Trino standard)
    - schema.table (2 parts - assumes 'postgres' catalog)
    - table (1 part - assumes postgres.public.table)
    
    This is an analytics platform - only SELECT queries are supported.
    """
    tables = []
    
    # Remove comments
    sql_no_comments = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    sql_no_comments = re.sub(r'/\*.*?\*/', '', sql_no_comments, flags=re.DOTALL)
    
    # SQL patterns for table references in SELECT queries (FROM/JOIN clauses only)
    patterns = [
        # FROM/JOIN clauses with optional catalog.schema.table
        r'(?:FROM|JOIN)\s+(?:LATERAL\s+)?([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+){0,2})',
    ]
    
    table_refs = set()
    
    for pattern in patterns:
        matches = re.findall(pattern, sql_no_comments, re.IGNORECASE)
        table_refs.update(matches)
    
    # Parse each table reference
    for ref in table_refs:
        parts = ref.split('.')
        
        if len(parts) == 3:
            # catalog.schema.table (Trino standard: tpch.sf1.orders)
            tables.append({
                "catalog": parts[0],
                "schema": parts[1],
                "table": parts[2]
            })
        elif len(parts) == 2:
            # schema.table (assume postgres catalog)
            tables.append({
                "catalog": "postgres",
                "schema": parts[0],
                "table": parts[1]
            })
        else:
            # Just table name (assume postgres.public.table)
            tables.append({
                "catalog": "postgres",
                "schema": "public",
                "table": parts[0]
            })
    
    logger.info("Extracted tables from SQL", 
                table_count=len(tables), 
                tables=[f"{t['catalog']}.{t['schema']}.{t['table']}" for t in tables])
    
    return tables


def is_select_query(sql: str) -> bool:
    """
    Check if the SQL query is a SELECT query.
    Analytics platform only allows SELECT queries.
    """
    sql_upper = sql.strip().upper()
    return sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')

