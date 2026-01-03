"""
File Upload API Endpoints
Handles CSV and Excel file uploads
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
import structlog
import json

from app.auth.dependencies import get_current_user_id
from app.database import get_db
from app.services.file_upload_service import FileUploadService
import httpx

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/file-uploads", tags=["file-uploads"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    table_name: Optional[str] = Form(None),
    is_temporary: bool = Form(True),
    retention_days: int = Form(1),
    insert_into_existing: bool = Form(False),
    existing_table_id: Optional[str] = Form(None),
    column_types: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """
    Upload CSV or Excel file and create table or insert into existing table
    
    Note: Excel files must contain only ONE sheet. Multi-sheet files will be rejected.
    
    Parameters:
    - file: CSV or Excel file (Excel must have single sheet only)
    - table_name: Optional base name for table (will be sanitized and made unique)
    - is_temporary: Whether table is temporary (default: True)
    - retention_days: Days to retain temporary table (1-7, default: 1)
    - insert_into_existing: Whether to insert into existing table
    - existing_table_id: If inserting, the existing table metadata ID
    """
    
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file
        is_valid, error_msg = FileUploadService.validate_file(file.filename, file_size)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Validate retention days
        if retention_days < FileUploadService.MIN_RETENTION_DAYS or \
           retention_days > FileUploadService.MAX_RETENTION_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Retention days must be between {FileUploadService.MIN_RETENTION_DAYS} and {FileUploadService.MAX_RETENTION_DAYS}"
            )
        
        # Determine file type
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        file_type = 'csv' if file_ext == 'csv' else 'excel'
        
        # Parse column types if provided
        custom_column_types = None
        if column_types:
            try:
                custom_column_types = json.loads(column_types)
            except:
                custom_column_types = None
        
        logger.info("file_upload_started",
                   filename=file.filename,
                   file_type=file_type,
                   file_size=file_size,
                   user_id=user_id,
                   has_custom_types=custom_column_types is not None)
        
        schema_name = "user_uploads"
        
        # Parse file (both CSV and Excel now return DataFrame)
        if file_type == 'csv':
            df = await FileUploadService.parse_csv(file_content)
        else:
            # Excel - will raise error if multiple sheets
            df = await FileUploadService.parse_excel(file_content)
        
        # Handle insert into existing table vs create new table
        if insert_into_existing and existing_table_id:
            # Get existing table info and validate
            existing_table = await FileUploadService.get_table_by_id(db, user_id, existing_table_id)
            if not existing_table:
                raise HTTPException(status_code=404, detail="Existing table not found")
            
            final_table_name = existing_table["table_name"]
            schema_name = existing_table["schema_name"]
            
            # Validate columns match
            is_valid, error_msg = FileUploadService.validate_columns_match(
                df, existing_table["column_definitions"]
            )
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)
            
            # Insert data into existing table
            row_count, column_count, column_defs = await FileUploadService.insert_into_existing_table(
                db, schema_name, final_table_name, df, existing_table["column_definitions"]
            )
            
            # Update existing metadata (increment row count)
            upload_id = await FileUploadService.update_upload_metadata(
                db, existing_table_id, row_count
            )
            
        else:
            # Create new table
            if table_name:
                final_table_name = await FileUploadService.generate_table_name(
                    db, user_id, FileUploadService.sanitize_table_name(table_name)
                )
            else:
                # Generate from filename
                base_name = file.filename.rsplit('.', 1)[0]
                final_table_name = await FileUploadService.generate_table_name(
                    db, user_id, FileUploadService.sanitize_table_name(base_name)
                )
            
            # Create table and insert data (with custom column types if provided)
            row_count, column_count, column_defs = await FileUploadService.create_table_from_dataframe(
                db, schema_name, final_table_name, df, custom_column_types
            )
            
            # Get sample data (first 5 rows)
            sample_data = df.head(5).to_dict('records')
            
            # Save metadata
            upload_id = await FileUploadService.save_upload_metadata(
                db, user_id, file.filename, file_size, file_type,
                schema_name, final_table_name, None,
                row_count, column_count, column_defs,
                is_temporary, retention_days, sample_data
            )
        
        # Trigger schema service incremental add in background
        if background_tasks and not insert_into_existing:
            # Only add to schema service for new tables (not inserts into existing)
            # Build table metadata for schema service
            columns_for_schema = [f"{col}|{sql_type.lower()}" for col, sql_type in column_defs.items()]
            table_metadata = {
                "catalog": "postgres",  # Assuming postgres catalog
                "schema": schema_name,
                "table": final_table_name,
                "full_name": f"postgres.{schema_name}.{final_table_name}",
                "columns": columns_for_schema,
                "type": "TABLE"
            }
            background_tasks.add_task(notify_schema_service_add_table, table_metadata)
        
        logger.info("file_upload_completed",
                   filename=file.filename,
                   table_name=final_table_name,
                   insert_mode=insert_into_existing,
                   user_id=user_id)
        
        message = f"File uploaded successfully. {row_count} rows {'inserted into' if insert_into_existing else 'created in'} table '{final_table_name}'."
        
        return {
            "success": True,
            "message": message,
            "upload": {
                "upload_id": upload_id,
                "table_name": final_table_name,
                "schema_name": schema_name,
                "sheet_name": None,
                "row_count": row_count,
                "column_count": column_count,
                "inserted_into_existing": insert_into_existing
            }
        }
        
    except ValueError as e:
        logger.error("file_upload_validation_error", error=str(e), user_id=user_id)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("file_upload_error", error=str(e), user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/tables")
async def get_user_tables(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get list of tables uploaded by current user"""
    try:
        tables = await FileUploadService.get_user_tables(db, user_id)
        return {
            "success": True,
            "tables": tables
        }
    except Exception as e:
        logger.error("get_user_tables_error", error=str(e), user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tables/{table_id}")
async def delete_user_table(
    table_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """
    Delete (truncate) a user's uploaded table
    Uses TRUNCATE for fast, clean deletion without history overhead
    """
    try:
        result = await FileUploadService.truncate_user_table(db, user_id, table_id)
        
        # Trigger schema service incremental remove in background
        if background_tasks and result.get("success"):
            schema_name = result.get("schema_name")
            table_name = result.get("table_name")
            if schema_name and table_name:
                background_tasks.add_task(
                    notify_schema_service_remove_table,
                    "postgres",  # catalog
                    schema_name,
                    table_name
                )
        
        return result
    except Exception as e:
        logger.error("delete_table_error", error=str(e), user_id=user_id, table_id=table_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup-expired")
async def cleanup_expired_tables(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger cleanup of expired temporary tables (admin only)"""
    try:
        # TODO: Add admin check here
        count = await FileUploadService.cleanup_expired_tables(db)
        return {
            "success": True,
            "message": f"Cleaned up {count} expired table(s)",
            "count": count
        }
    except Exception as e:
        logger.error("cleanup_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def notify_schema_service_add_table(table_metadata: Dict[str, Any]):
    """
    Notify schema service to add a single table (incremental update)
    
    Much faster than full refresh:
    - Only adds 1 table vector (~50-100ms)
    - No expensive Trino catalog queries
    - Scales independently of total table count
    """
    try:
        import os
        schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
        service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
        
        headers = {}
        if service_key:
            headers["X-Service-Key"] = service_key
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{schema_service_url}/table/add",
                json=table_metadata,
                headers=headers,
                timeout=30.0
            )
            if response.status_code == 200:
                logger.info("schema_service_table_added", table=table_metadata.get("full_name"))
            else:
                logger.warning("schema_service_add_failed", 
                             status_code=response.status_code,
                             response=response.text)
    except Exception as e:
        logger.error("schema_service_add_error", error=str(e))


async def notify_schema_service_remove_table(catalog: str, schema_name: str, table_name: str):
    """
    Notify schema service to remove a table (incremental update)
    
    Faster than full refresh:
    - No Trino queries
    - Rebuilds index from in-memory metadata (~1-5s)
    """
    try:
        import os
        schema_service_url = os.getenv("SCHEMA_SERVICE_URL", "http://schema-service:8000")
        service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
        
        headers = {}
        if service_key:
            headers["X-Service-Key"] = service_key
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{schema_service_url}/table/{catalog}/{schema_name}/{table_name}",
                headers=headers,
                timeout=30.0
            )
            if response.status_code == 200:
                logger.info("schema_service_table_removed", 
                          table=f"{catalog}.{schema_name}.{table_name}")
            else:
                logger.warning("schema_service_remove_failed", 
                             status_code=response.status_code,
                             response=response.text)
    except Exception as e:
        logger.error("schema_service_remove_error", error=str(e))

