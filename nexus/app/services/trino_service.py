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
        max_results: int = 500,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """Execute SQL query against Trino."""
        
        # Strip whitespace and trailing semicolon to prevent syntax errors
        sql = sql.strip().rstrip(';')
        
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
            
            # Extract clean error message from Trino exceptions
            error_msg = str(e)
            if hasattr(e, 'message'):
                # Trino exceptions have a clean message attribute
                error_msg = str(e.message)
            elif hasattr(e, 'args') and e.args:
                # Fallback to first arg if available
                error_msg = str(e.args[0])
            
            self.logger.error(
                "Query execution failed",
                error=error_msg,
                error_type=type(e).__name__,
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
        """Execute query using Trino Python client."""
        
        def _run_query():
            import trino
            from trino.dbapi import connect
            from trino.auth import BasicAuthentication
            
            auth = None
            if self.password:
                auth = BasicAuthentication(self.user, self.password)
            
            # Connection arguments
            conn_args = {
                "host": self.host,
                "port": self.port,
                "user": self.user,
                "catalog": self.catalog,
                "schema": self.schema,
                "http_scheme": 'https' if settings.trino_ssl else 'http',
            }
            if auth:
                conn_args["auth"] = auth
                
            conn = connect(**conn_args)
            cur = conn.cursor()
            cur.execute(sql)
            
            # Fetch results
            rows = cur.fetchmany(max_results)
            
            # Get columns
            columns = []
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                
            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows)
            }

        loop = asyncio.get_event_loop()
        try:
            # Run synchronous Trino call in thread pool
            result = await loop.run_in_executor(None, _run_query)
            return result
        except Exception as e:
            self.logger.error("Trino client execution failed", error=str(e))
            raise e
    
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
                self.logger.info(f"SQL EXECUTION SUCCESSFUL on attempt {attempt + 1}")
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
        
        # Return final failure result with user-friendly message
        last_error = error_history[-1] if error_history else "Unknown error"
        return {
            "success": False,
            "error": "Unable to execute the query after multiple attempts. Please review the generated SQL or try rephrasing your question.",
            "error_type": "MAX_RETRIES_EXCEEDED",
            "retry_attempts": max_retries,
            "error_history": error_history,
            "final_sql": current_sql,
            "last_error": last_error
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
