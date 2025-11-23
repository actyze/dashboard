"""Trino SQL execution service."""

import asyncio
import asyncpg
from typing import List, Dict, Any, Optional, Tuple
import structlog
from app.config import settings

logger = structlog.get_logger()


class TrinoService:
    """Service for executing SQL queries against Trino."""
    
    def __init__(self):
        self.host = settings.trino_host
        self.port = settings.trino_port
        self.user = settings.trino_user
        self.password = settings.trino_password
        self.catalog = settings.trino_catalog
        self.schema = settings.trino_schema
        self.logger = logger.bind(service="trino-service")
    
    async def execute_query(
        self,
        sql: str,
        max_results: int = 100,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """Execute SQL query against Trino."""
        
        self.logger.info(
            "Processing SQL execution request",
            sql=sql[:200] + "..." if len(sql) > 200 else sql,
            max_results=max_results,
            timeout=timeout_seconds
        )
        self.logger.debug("Full SQL query", sql=sql)
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            # For now, we'll use a simple HTTP-based approach
            # In production, you might want to use the official Trino Python client
            result = await self._execute_via_http(sql, max_results, timeout_seconds)
            
            execution_time = (asyncio.get_event_loop().time() - start_time) * 1000
            
            self.logger.info(
                "Query executed successfully",
                execution_time=execution_time,
                row_count=len(result.get("rows", []))
            )
            
            return {
                "success": True,
                "query_results": result,
                "execution_time": execution_time,
                "sql": sql
            }
            
        except Exception as e:
            execution_time = (asyncio.get_event_loop().time() - start_time) * 1000
            error_msg = str(e)
            
            self.logger.error(
                "Query execution failed",
                error=error_msg,
                execution_time=execution_time
            )
            
            # Classify error type
            error_type = self._classify_error(error_msg)
            
            return {
                "success": False,
                "error": error_msg,
                "error_type": error_type,
                "execution_time": execution_time,
                "sql": sql
            }
    
    async def _execute_via_http(
        self,
        sql: str,
        max_results: int,
        timeout_seconds: int
    ) -> Dict[str, Any]:
        """Execute query via HTTP (placeholder implementation)."""
        
        # This is a placeholder implementation
        # In a real scenario, you would use the Trino HTTP API or Python client
        
        # For demonstration, return mock data
        if "SELECT" in sql.upper():
            return {
                "columns": ["id", "name", "value"],
                "rows": [
                    [1, "Sample Row 1", 100.0],
                    [2, "Sample Row 2", 200.0],
                    [3, "Sample Row 3", 300.0]
                ],
                "row_count": 3
            }
        else:
            return {
                "columns": ["result"],
                "rows": [["Query executed successfully"]],
                "row_count": 1
            }
    
    def _classify_error(self, error_message: str) -> str:
        """Classify error type based on error message."""
        error_lower = error_message.lower()
        
        if "syntax" in error_lower or "parse" in error_lower:
            return "SYNTAX_ERROR"
        elif "column" in error_lower and ("not found" in error_lower or "does not exist" in error_lower):
            return "COLUMN_NOT_FOUND"
        elif "table" in error_lower and ("not found" in error_lower or "does not exist" in error_lower):
            return "TABLE_NOT_FOUND"
        elif "permission" in error_lower or "access" in error_lower or "denied" in error_lower:
            return "PERMISSION_ERROR"
        elif "timeout" in error_lower or "cancelled" in error_lower:
            return "TIMEOUT_ERROR"
        elif "connection" in error_lower or "network" in error_lower:
            return "CONNECTION_ERROR"
        else:
            return "UNKNOWN_ERROR"
    
    async def execute_with_retry(
        self,
        original_query: str,
        sql: str,
        max_results: int,
        timeout_seconds: int,
        max_retries: int,
        correction_callback
    ) -> Dict[str, Any]:
        """Execute SQL with retry logic and error correction."""
        
        error_history = []
        current_sql = sql
        
        for attempt in range(max_retries + 1):
            self.logger.info(
                f"--- RETRY ATTEMPT {attempt + 1}/{max_retries + 1} ---"
            )
            self.logger.info(
                "Executing SQL",
                sql=current_sql[:200] + "..." if len(current_sql) > 200 else current_sql
            )
            self.logger.debug("Cleaned SQL", sql=current_sql)
            
            result = await self.execute_query(current_sql, max_results, timeout_seconds)
            
            if result["success"]:
                self.logger.info(f"✅ SQL EXECUTION SUCCESSFUL on attempt {attempt + 1}")
                result.update({
                    "retry_attempts": attempt,
                    "error_history": error_history,
                    "final_sql": current_sql
                })
                return result
            
            # If this was the last attempt, return the failure
            if attempt >= max_retries:
                result.update({
                    "retry_attempts": attempt,
                    "error_history": error_history,
                    "final_sql": current_sql
                })
                return result
            
            # Add error to history
            error_history.append(f"Attempt {attempt + 1}: {result['error']}")
            
            # Try to get corrected SQL
            self.logger.info("Attempting SQL correction", attempt=attempt + 1)
            
            try:
                correction_result = await correction_callback(
                    original_query,
                    current_sql,
                    result["error"],
                    result["error_type"],
                    error_history
                )
                
                if correction_result.get("success") and correction_result.get("sql"):
                    current_sql = correction_result["sql"]
                    self.logger.info("SQL correction received", corrected_sql=current_sql[:100])
                else:
                    self.logger.warning("SQL correction failed", error=correction_result.get("error"))
                    break
                    
            except Exception as e:
                self.logger.error("Error during SQL correction", error=str(e))
                break
        
        # Return final failure result
        return {
            "success": False,
            "error": f"Failed after {max_retries + 1} attempts",
            "error_type": "MAX_RETRIES_EXCEEDED",
            "retry_attempts": max_retries,
            "error_history": error_history,
            "final_sql": current_sql
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Trino service health."""
        try:
            # Simple query to test connection
            result = await self.execute_query("SELECT 1", max_results=1, timeout_seconds=5)
            
            return {
                "name": "trino-service",
                "healthy": result["success"],
                "response_time": result.get("execution_time", 0) / 1000,  # Convert to seconds
                "error": result.get("error") if not result["success"] else None
            }
        except Exception as e:
            return {
                "name": "trino-service",
                "healthy": False,
                "error": str(e)
            }
