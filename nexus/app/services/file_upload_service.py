"""
File Upload Service
Handles CSV and Excel file uploads, parsing, and table creation
"""

import io
import csv
import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, date
import re
from sqlalchemy import text, Integer, BigInteger, String, Float, Boolean, DateTime, Date, Text, Numeric, MetaData, Table, Column

from app.database import get_db
import structlog

logger = structlog.get_logger(__name__)


def convert_to_json_serializable(obj):
    """Convert pandas/numpy types to JSON serializable types"""
    if pd.isna(obj):
        return None
    elif isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    elif isinstance(obj, (np.integer, np.int64)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64)):
        return float(obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, pd.NA.__class__):
        return None
    return obj


class FileUploadService:
    """Service for handling file uploads and table creation"""
    
    # Maximum file size (50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls'}
    
    # Maximum retention days for temporary tables
    MAX_RETENTION_DAYS = 7
    MIN_RETENTION_DAYS = 1
    
    @staticmethod
    def validate_file(filename: str, file_size: int) -> Tuple[bool, Optional[str]]:
        """Validate uploaded file"""
        # Check file size
        if file_size > FileUploadService.MAX_FILE_SIZE:
            return False, f"File size exceeds maximum allowed size of {FileUploadService.MAX_FILE_SIZE / 1024 / 1024}MB"
        
        # Check file extension
        file_ext = '.' + filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if file_ext not in FileUploadService.ALLOWED_EXTENSIONS:
            return False, f"File type not supported. Allowed types: {', '.join(FileUploadService.ALLOWED_EXTENSIONS)}"
        
        return True, None
    
    @staticmethod
    def sanitize_table_name(name: str) -> str:
        """Sanitize table name to be SQL-safe"""
        # Remove special characters, replace with underscore
        name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
        # Ensure it starts with a letter
        if name and not name[0].isalpha():
            name = 'tbl_' + name
        # Limit length
        name = name[:63]
        return name.lower()
    
    @staticmethod
    def sanitize_column_name(name: str) -> str:
        """Sanitize column name to be SQL-safe"""
        # Remove special characters
        name = re.sub(r'[^a-zA-Z0-9_]', '_', str(name))
        # Ensure it starts with a letter
        if name and not name[0].isalpha():
            name = 'col_' + name
        # Limit length
        name = name[:63]
        return name.lower()
    
    @staticmethod
    def infer_column_type(series: pd.Series) -> Any:
        """Infer SQLAlchemy column type from pandas series"""
        dtype = series.dtype
        
        # Try to infer more specific types
        if pd.api.types.is_integer_dtype(dtype):
            return Integer
        elif pd.api.types.is_float_dtype(dtype):
            return Float
        elif pd.api.types.is_bool_dtype(dtype):
            return Boolean
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            return DateTime
        else:
            # Check if it's a date string
            try:
                if series.notna().any():
                    pd.to_datetime(series.dropna().iloc[0])
                    return DateTime
            except:
                pass
            
            # Default to Text for strings
            max_len = series.astype(str).str.len().max() if len(series) > 0 else 255
            if max_len <= 255:
                return String(255)
            else:
                return Text
    
    @staticmethod
    async def parse_csv(file_content: bytes, encoding: str = 'utf-8') -> pd.DataFrame:
        """Parse CSV file content"""
        try:
            # Try different encodings if utf-8 fails
            encodings = [encoding, 'utf-8', 'latin-1', 'iso-8859-1']
            df = None
            
            for enc in encodings:
                try:
                    df = pd.read_csv(io.BytesIO(file_content), encoding=enc)
                    logger.info("csv_parsed", encoding=enc, rows=len(df), columns=len(df.columns))
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                raise ValueError("Could not decode CSV file with any supported encoding")
            
            return df
        except Exception as e:
            logger.error("csv_parse_error", error=str(e))
            raise ValueError(f"Failed to parse CSV file: {str(e)}")
    
    @staticmethod
    async def parse_excel(file_content: bytes) -> pd.DataFrame:
        """Parse Excel file content (single sheet only)"""
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_content))
            
            # Check for multiple sheets
            if len(excel_file.sheet_names) > 1:
                raise ValueError(
                    f"Excel file contains {len(excel_file.sheet_names)} sheets. "
                    f"Please upload a file with only one sheet. "
                    f"Found sheets: {', '.join(excel_file.sheet_names)}"
                )
            
            # Read the single sheet
            df = pd.read_excel(excel_file, sheet_name=0)
            logger.info("excel_parsed", sheet=excel_file.sheet_names[0], rows=len(df), columns=len(df.columns))
            
            return df
        except ValueError:
            # Re-raise validation errors as-is
            raise
        except Exception as e:
            logger.error("excel_parse_error", error=str(e))
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    
    @staticmethod
    async def generate_table_name(db, user_id: str, base_name: Optional[str] = None) -> str:
        """Generate unique table name"""
        query = text("SELECT nexus.generate_upload_table_name(:user_id, :base_name)")
        result = await db.execute(query, {"user_id": user_id, "base_name": base_name})
        return result.scalar()
    
    @staticmethod
    async def create_table_from_dataframe(
        db,
        schema_name: str,
        table_name: str,
        df: pd.DataFrame,
        custom_column_types: Optional[Dict[str, str]] = None
    ) -> Tuple[int, int, Dict[str, str]]:
        """Create new table and insert data from DataFrame"""
        
        # Sanitize column names
        df.columns = [FileUploadService.sanitize_column_name(col) for col in df.columns]
        
        # Create SQLAlchemy metadata
        metadata = MetaData()
        
        # Build column definitions
        # Choose a primary key column name that doesn't conflict with existing columns
        pk_column_name = '_row_id'
        if '_row_id' in df.columns:
            pk_column_name = '__row_id'
        if '__row_id' in df.columns:
            pk_column_name = '___internal_id'
        
        columns = [Column(pk_column_name, Integer, primary_key=True, autoincrement=True)]
        column_definitions = {}
        
        # Type mapping from frontend strings to SQLAlchemy types
        type_mapping = {
            'varchar': String(255),
            'text': Text,
            'integer': Integer,
            'bigint': BigInteger,
            'float': Float,
            'numeric': Numeric(precision=20, scale=6),  # Precise decimal with 20 total digits, 6 after decimal
            'boolean': Boolean,
            'date': Date,
            'timestamp': DateTime
        }
        
        # SQL type strings for CREATE TABLE statement
        sql_type_mapping = {
            'varchar': 'VARCHAR(255)',
            'text': 'TEXT',
            'integer': 'INTEGER',
            'bigint': 'BIGINT',
            'float': 'DOUBLE PRECISION',
            'numeric': 'NUMERIC(20,6)',
            'boolean': 'BOOLEAN',
            'date': 'DATE',
            'timestamp': 'TIMESTAMP'
        }
        
        for col_name in df.columns:
            # Use custom type if provided, otherwise infer
            if custom_column_types and col_name in custom_column_types:
                type_str = custom_column_types[col_name]
                col_type = type_mapping.get(type_str, Text)
                sql_type = sql_type_mapping.get(type_str, 'TEXT')
            else:
                col_type = FileUploadService.infer_column_type(df[col_name])
                # Map SQLAlchemy type to SQL string
                if isinstance(col_type, Integer):
                    sql_type = 'INTEGER'
                elif isinstance(col_type, BigInteger):
                    sql_type = 'BIGINT'
                elif isinstance(col_type, Float):
                    sql_type = 'DOUBLE PRECISION'
                elif isinstance(col_type, Numeric):
                    sql_type = 'NUMERIC(20,6)'
                elif isinstance(col_type, Boolean):
                    sql_type = 'BOOLEAN'
                elif isinstance(col_type, Date):
                    sql_type = 'DATE'
                elif isinstance(col_type, DateTime):
                    sql_type = 'TIMESTAMP'
                elif isinstance(col_type, Text):
                    sql_type = 'TEXT'
                elif isinstance(col_type, String):
                    sql_type = 'VARCHAR(255)'
                else:
                    sql_type = 'TEXT'
            
            columns.append(Column(col_name, col_type, nullable=True))
            column_definitions[col_name] = sql_type
        
        # Create table object
        table = Table(table_name, metadata, *columns, schema=schema_name)
        
        try:
            # Create table
            logger.info("creating_table", schema=schema_name, table=table_name, columns=len(columns))
            
            # Execute the CREATE TABLE statement
            await db.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}."{table_name}" (
                    {pk_column_name} SERIAL PRIMARY KEY,
                    {', '.join([f'"{col}" {column_definitions[col]}' for col in df.columns])}
                )
            """))
            await db.commit()
            
            # Convert DataFrame columns to proper Python types before insertion
            for col_name in df.columns:
                sql_type = column_definitions[col_name]
                
                if sql_type == 'TIMESTAMP':
                    # Convert to datetime
                    df[col_name] = pd.to_datetime(df[col_name], errors='coerce')
                elif sql_type == 'DATE':
                    # Convert to date
                    df[col_name] = pd.to_datetime(df[col_name], errors='coerce').dt.date
                elif sql_type == 'BOOLEAN':
                    # Convert to boolean
                    df[col_name] = df[col_name].astype(bool, errors='ignore')
                elif sql_type in ('INTEGER', 'BIGINT'):
                    # Convert to int (handling NaN)
                    df[col_name] = pd.to_numeric(df[col_name], errors='coerce').astype('Int64')
                elif sql_type in ('DOUBLE PRECISION', 'NUMERIC(20,6)'):
                    # Convert to float
                    df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
            
            # Insert data in batches
            batch_size = 1000
            total_rows = len(df)
            
            for i in range(0, total_rows, batch_size):
                batch_df = df.iloc[i:i+batch_size]
                
                # Convert DataFrame to list of dicts
                records = batch_df.to_dict('records')
                
                # Replace NaN/NaT with None for NULL values in database
                # This is crucial because PostgreSQL doesn't accept NaN as a valid value
                clean_records = []
                for record in records:
                    clean_record = {}
                    for key, value in record.items():
                        # Check for NaN, NaT, pd.NA, or any null-like values
                        if pd.isna(value):
                            clean_record[key] = None
                        else:
                            clean_record[key] = value
                    clean_records.append(clean_record)
                
                if clean_records:
                    # Build INSERT statement
                    columns_str = ', '.join([f'"{col}"' for col in df.columns])
                    placeholders = ', '.join([f':{col}' for col in df.columns])
                    insert_query = text(f"""
                        INSERT INTO {schema_name}."{table_name}" ({columns_str})
                        VALUES ({placeholders})
                    """)
                    
                    # Execute batch insert with clean records
                    await db.execute(insert_query, clean_records)
                    await db.commit()
                
                logger.info("batch_inserted", batch=i//batch_size + 1, rows=len(clean_records))
            
            logger.info("table_created_and_populated", 
                       schema=schema_name, 
                       table=table_name, 
                       total_rows=total_rows,
                       columns=len(df.columns))
            
            return total_rows, len(df.columns), column_definitions
            
        except Exception as e:
            await db.rollback()
            logger.error("table_creation_error", error=str(e), schema=schema_name, table=table_name)
            raise
    
    @staticmethod
    async def save_upload_metadata(
        db,
        user_id: str,
        original_filename: str,
        file_size: int,
        file_type: str,
        schema_name: str,
        table_name: str,
        sheet_name: Optional[str],
        row_count: int,
        column_count: int,
        column_definitions: Dict[str, str],
        is_temporary: bool,
        retention_days: int,
        sample_data: Optional[List[Dict]] = None
    ) -> int:
        """Save upload metadata to database"""
        
        expires_at = None
        if is_temporary:
            expires_at = datetime.utcnow() + timedelta(days=retention_days)
        
        query = text("""
            INSERT INTO nexus.user_upload_metadata (
                user_id, original_filename, file_size_bytes, file_type,
                schema_name, table_name, sheet_name,
                row_count, column_count, column_definitions,
                is_temporary, retention_days, expires_at,
                status, sample_data
            ) VALUES (
                :user_id, :original_filename, :file_size, :file_type,
                :schema_name, :table_name, :sheet_name,
                :row_count, :column_count, :column_definitions,
                :is_temporary, :retention_days, :expires_at,
                'active', :sample_data
            )
            RETURNING id
        """)
        
        # Convert sample data to JSON-serializable format
        if sample_data:
            serializable_sample = [
                {k: convert_to_json_serializable(v) for k, v in row.items()}
                for row in sample_data
            ]
        else:
            serializable_sample = None
        
        result = await db.execute(query, {
            "user_id": user_id,
            "original_filename": original_filename,
            "file_size": file_size,
            "file_type": file_type,
            "schema_name": schema_name,
            "table_name": table_name,
            "sheet_name": sheet_name,
            "row_count": row_count,
            "column_count": column_count,
            "column_definitions": json.dumps(column_definitions),
            "is_temporary": is_temporary,
            "retention_days": retention_days,
            "expires_at": expires_at,
            "sample_data": json.dumps(serializable_sample) if serializable_sample else None
        })
        await db.commit()
        
        upload_id = result.scalar()
        logger.info("upload_metadata_saved", upload_id=upload_id, table=table_name)
        
        return upload_id
    
    @staticmethod
    async def get_user_tables(db, user_id: str) -> List[Dict[str, Any]]:
        """Get list of tables created by user"""
        query = text("""
            SELECT 
                id, schema_name, table_name, sheet_name,
                original_filename, row_count, column_count,
                is_temporary, expires_at, status, created_at
            FROM nexus.user_upload_metadata
            WHERE user_id = :user_id
                AND status IN ('active', 'processing')
                AND deleted_at IS NULL
            ORDER BY created_at DESC
        """)
        
        result = await db.execute(query, {"user_id": user_id})
        tables = []
        
        for row in result:
            tables.append({
                "id": row.id,
                "schema_name": row.schema_name,
                "table_name": row.table_name,
                "sheet_name": row.sheet_name,
                "original_filename": row.original_filename,
                "row_count": row.row_count,
                "column_count": row.column_count,
                "is_temporary": row.is_temporary,
                "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                "status": row.status,
                "created_at": row.created_at.isoformat()
            })
        
        return tables
    
    @staticmethod
    async def cleanup_expired_tables(db) -> int:
        """Mark expired temporary tables and drop them"""
        # Mark as expired
        mark_query = text("SELECT nexus.mark_expired_temporary_tables()")
        result = await db.execute(mark_query)
        expired_count = result.scalar()
        
        if expired_count > 0:
            # Get expired tables
            get_expired_query = text("""
                SELECT schema_name, table_name
                FROM nexus.user_upload_metadata
                WHERE status = 'expired' AND deleted_at IS NULL
            """)
            
            expired_tables = await db.execute(get_expired_query)
            
            # Drop each table
            for row in expired_tables:
                try:
                    drop_query = text(f'DROP TABLE IF EXISTS {row.schema_name}."{row.table_name}" CASCADE')
                    await db.execute(drop_query)
                    
                    # Mark as deleted
                    update_query = text("""
                        UPDATE nexus.user_upload_metadata
                        SET deleted_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE schema_name = :schema_name
                            AND table_name = :table_name
                    """)
                    await db.execute(update_query, {
                        "schema_name": row.schema_name,
                        "table_name": row.table_name
                    })
                    
                    logger.info("expired_table_dropped", 
                               schema=row.schema_name, 
                               table=row.table_name)
                except Exception as e:
                    logger.error("failed_to_drop_expired_table", 
                                schema=row.schema_name,
                                table=row.table_name,
                                error=str(e))
            
            await db.commit()
        
        logger.info("cleanup_completed", expired_tables=expired_count)
        return expired_count
    
    @staticmethod
    async def get_table_by_id(db, user_id: str, table_id: str) -> Optional[Dict[str, Any]]:
        """Get table metadata by ID for current user"""
        query = text("""
            SELECT 
                id, schema_name, table_name, column_definitions,
                row_count, column_count, is_temporary
            FROM nexus.user_upload_metadata
            WHERE id = :table_id
                AND user_id = :user_id
                AND status = 'active'
                AND deleted_at IS NULL
        """)
        result = await db.execute(query, {"table_id": int(table_id), "user_id": user_id})
        row = result.fetchone()
        
        if not row:
            return None
        
        return {
            "id": str(row.id),
            "schema_name": row.schema_name,
            "table_name": row.table_name,
            "column_definitions": row.column_definitions if row.column_definitions else {},
            "row_count": row.row_count,
            "column_count": row.column_count,
            "is_temporary": row.is_temporary
        }
    
    @staticmethod
    def validate_columns_match(df: pd.DataFrame, existing_columns: Dict[str, str]) -> Tuple[bool, str]:
        """
        Validate that DataFrame columns match existing table columns
        Returns (is_valid, error_message)
        """
        # Sanitize incoming column names to match what will be in the table
        df_columns = {FileUploadService.sanitize_column_name(col) for col in df.columns}
        existing_column_names = set(existing_columns.keys())
        
        # Check if columns match exactly
        if df_columns != existing_column_names:
            missing_in_df = existing_column_names - df_columns
            extra_in_df = df_columns - existing_column_names
            
            error_parts = []
            if missing_in_df:
                error_parts.append(f"Missing columns: {', '.join(sorted(missing_in_df))}")
            if extra_in_df:
                error_parts.append(f"Extra columns: {', '.join(sorted(extra_in_df))}")
            
            error_msg = f"Column mismatch. {' '.join(error_parts)}. Expected: {', '.join(sorted(existing_column_names))}"
            return False, error_msg
        
        return True, ""
    
    @staticmethod
    async def insert_into_existing_table(
        db,
        schema_name: str,
        table_name: str,
        df: pd.DataFrame,
        column_definitions: Dict[str, str]
    ) -> Tuple[int, int, Dict[str, str]]:
        """Insert data from DataFrame into existing table"""
        
        # Sanitize column names to match table
        df.columns = [FileUploadService.sanitize_column_name(col) for col in df.columns]
        
        # Convert DataFrame columns to proper Python types before insertion
        for col_name in df.columns:
            sql_type = column_definitions.get(col_name, 'TEXT')
            
            if sql_type == 'TIMESTAMP':
                df[col_name] = pd.to_datetime(df[col_name], errors='coerce')
            elif sql_type == 'DATE':
                df[col_name] = pd.to_datetime(df[col_name], errors='coerce').dt.date
            elif sql_type == 'BOOLEAN':
                df[col_name] = df[col_name].astype(bool, errors='ignore')
            elif sql_type in ('INTEGER', 'BIGINT'):
                df[col_name] = pd.to_numeric(df[col_name], errors='coerce').astype('Int64')
            elif sql_type in ('DOUBLE PRECISION', 'NUMERIC(20,6)'):
                df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
        
        # Insert data in batches
        batch_size = 1000
        total_rows = len(df)
        
        try:
            for i in range(0, total_rows, batch_size):
                batch_df = df.iloc[i:i+batch_size]
                records = batch_df.to_dict('records')
                
                # Replace NaN/NaT with None for NULL values
                clean_records = []
                for record in records:
                    clean_record = {}
                    for key, value in record.items():
                        if pd.isna(value):
                            clean_record[key] = None
                        else:
                            clean_record[key] = value
                    clean_records.append(clean_record)
                
                if clean_records:
                    columns_str = ', '.join([f'"{col}"' for col in df.columns])
                    placeholders = ', '.join([f':{col}' for col in df.columns])
                    insert_query = text(f"""
                        INSERT INTO {schema_name}."{table_name}" ({columns_str})
                        VALUES ({placeholders})
                    """)
                    
                    await db.execute(insert_query, clean_records)
                    await db.commit()
                
                logger.info("batch_inserted_into_existing", batch=i//batch_size + 1, rows=len(clean_records))
            
            logger.info("data_inserted_into_existing_table",
                       schema=schema_name,
                       table=table_name,
                       new_rows=total_rows)
            
            return total_rows, len(df.columns), column_definitions
            
        except Exception as e:
            await db.rollback()
            logger.error("insert_into_existing_error", error=str(e), schema=schema_name, table=table_name)
            raise
    
    @staticmethod
    async def update_upload_metadata(db, table_id: str, additional_rows: int) -> str:
        """Update metadata after inserting into existing table"""
        query = text("""
            UPDATE nexus.user_upload_metadata
            SET row_count = row_count + :additional_rows,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :table_id
            RETURNING id
        """)
        result = await db.execute(query, {"table_id": int(table_id), "additional_rows": additional_rows})
        await db.commit()
        
        row = result.fetchone()
        return str(row.id) if row else table_id
    
    @staticmethod
    async def truncate_user_table(db, user_id: str, table_id: str) -> Dict[str, Any]:
        """
        Truncate (fast delete) a user's uploaded table
        Uses TRUNCATE for performance and no history overhead
        """
        # Get table info
        table = await FileUploadService.get_table_by_id(db, user_id, table_id)
        if not table:
            return {"success": False, "error": "Table not found"}
        
        try:
            # TRUNCATE the table (fast, no transaction log overhead)
            truncate_query = text(f'TRUNCATE TABLE {table["schema_name"]}."{table["table_name"]}" CASCADE')
            await db.execute(truncate_query)
            
            # Mark as deleted in metadata
            update_query = text("""
                UPDATE nexus.user_upload_metadata
                SET status = 'deleted',
                    deleted_at = CURRENT_TIMESTAMP
                WHERE id = :table_id
            """)
            await db.execute(update_query, {"table_id": int(table_id)})
            await db.commit()
            
            logger.info("table_truncated",
                       schema=table["schema_name"],
                       table=table["table_name"],
                       user_id=user_id)
            
            return {
                "success": True,
                "message": f"Table '{table['table_name']}' deleted successfully",
                "schema_name": table["schema_name"],
                "table_name": table["table_name"]
            }
            
        except Exception as e:
            await db.rollback()
            logger.error("truncate_table_error",
                        error=str(e),
                        table_id=table_id,
                        user_id=user_id)
            raise

