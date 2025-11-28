"""
Database Explorer API Routes (DBeaver-style hierarchy).
Provides hierarchical navigation: Databases → Schemas → Objects → Details
"""

from typing import Optional
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/explorer", tags=["Database Explorer"])


def get_databases_list(raw_schema_cache, last_updated):
    """Get list of all databases with statistics."""
    databases = {}
    
    for schema_obj in raw_schema_cache:
        db_name = schema_obj["database"]
        if db_name not in databases:
            databases[db_name] = {
                "name": db_name,
                "schema_count": 0,
                "table_count": 0,
                "total_columns": 0
            }
        databases[db_name]["table_count"] += 1
        databases[db_name]["total_columns"] += schema_obj["column_count"]
    
    # Get unique schema names per database
    for db_name in databases:
        unique_schemas = set(
            s["schema"] for s in raw_schema_cache 
            if s["database"] == db_name
        )
        databases[db_name]["schema_count"] = len(unique_schemas)
    
    return {
        "databases": list(databases.values()),
        "total_databases": len(databases),
        "last_updated": last_updated.isoformat() if last_updated else None
    }


def get_database_schemas_list(database: str, raw_schema_cache, last_updated):
    """Get list of all schemas in a database."""
    schemas = {}
    
    for schema_obj in raw_schema_cache:
        if schema_obj["database"].lower() == database.lower():
            schema_name = schema_obj["schema"]
            if schema_name not in schemas:
                schemas[schema_name] = {
                    "name": schema_name,
                    "database": database,
                    "table_count": 0,
                    "total_columns": 0
                }
            schemas[schema_name]["table_count"] += 1
            schemas[schema_name]["total_columns"] += schema_obj["column_count"]
    
    if not schemas:
        raise HTTPException(status_code=404, detail=f"Database '{database}' not found")
    
    return {
        "database": database,
        "schemas": list(schemas.values()),
        "total_schemas": len(schemas),
        "last_updated": last_updated.isoformat() if last_updated else None
    }


def get_schema_objects_list(database: str, schema: str, raw_schema_cache, last_updated):
    """Get all database objects in a schema."""
    tables = []
    
    for schema_obj in raw_schema_cache:
        if (schema_obj["database"].lower() == database.lower() and 
            schema_obj["schema"].lower() == schema.lower()):
            tables.append({
                "name": schema_obj["table"],
                "type": schema_obj.get("type", "TABLE"),
                "column_count": schema_obj["column_count"],
                "full_name": schema_obj["full_name"]
            })
    
    if not tables:
        raise HTTPException(
            status_code=404, 
            detail=f"Schema '{database}.{schema}' not found or has no objects"
        )
    
    # Group by object type
    # Views and Materialized Views are grouped under 'views'
    views_list = [t for t in tables if t["type"] in ["VIEW", "MATERIALIZED VIEW"]]
    tables_list = [t for t in tables if t["type"] == "TABLE"]
    
    objects_by_type = {
        "tables": tables_list,
        "views": views_list,
        "indexes": [],
        "functions": []
    }
    
    return {
        "database": database,
        "schema": schema,
        "objects": objects_by_type,
        "summary": {
            "tables": len(objects_by_type["tables"]),
            "views": len(objects_by_type["views"]),
            "indexes": len(objects_by_type["indexes"]),
            "functions": len(objects_by_type["functions"]),
            "total_objects": len(tables)
        },
        "last_updated": last_updated.isoformat() if last_updated else None
    }


def get_table_detail(database: str, schema: str, table: str, raw_schema_cache, last_updated):
    """Get detailed information about a specific table."""
    table_info = None
    for schema_obj in raw_schema_cache:
        if (schema_obj["database"].lower() == database.lower() and 
            schema_obj["schema"].lower() == schema.lower() and
            schema_obj["table"].lower() == table.lower()):
            table_info = schema_obj
            break
    
    if not table_info:
        raise HTTPException(
            status_code=404, 
            detail=f"Table '{database}.{schema}.{table}' not found"
        )
    
    return {
        "database": database,
        "schema": schema,
        "table": table,
        "full_name": table_info["full_name"],
        "type": table_info.get("type", "TABLE"),
        "columns": table_info["columns"],
        "column_count": table_info["column_count"],
        "metadata": {
            "last_updated": last_updated.isoformat() if last_updated else None
        }
    }


def search_database_objects_list(
    query: str,
    raw_schema_cache,
    database: Optional[str] = None,
    schema: Optional[str] = None,
    object_type: Optional[str] = None
):
    """Search for database objects across all databases/schemas."""
    results = []
    query_lower = query.lower()
    
    for schema_obj in raw_schema_cache:
        # Apply filters
        if database and schema_obj["database"].lower() != database.lower():
            continue
        if schema and schema_obj["schema"].lower() != schema.lower():
            continue
        if object_type and schema_obj.get("type", "TABLE").upper() != object_type.upper():
            continue
        
        # Search in table name
        table_match = query_lower in schema_obj["table"].lower()
        
        # Search in column names
        matching_columns = [
            col for col in schema_obj["columns"]
            if query_lower in col["name"].lower()
        ]
        
        if table_match or matching_columns:
            results.append({
                "database": schema_obj["database"],
                "schema": schema_obj["schema"],
                "table": schema_obj["table"],
                "type": schema_obj.get("type", "TABLE"),
                "full_name": schema_obj["full_name"],
                "match_type": "table" if table_match else "column",
                "matching_columns": [col["name"] for col in matching_columns] if matching_columns else [],
                "column_count": schema_obj["column_count"]
            })
    
    return {
        "query": query,
        "filters": {
            "database": database,
            "schema": schema,
            "object_type": object_type
        },
        "results": results,
        "total_results": len(results)
    }

