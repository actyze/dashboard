"""LLM service client for SQL generation."""

from typing import List, Dict, Any, Optional
from app.services.base import BaseService
from app.config import settings


class LLMService(BaseService):
    """Client for LLM-based SQL generation service."""
    
    def __init__(self):
        super().__init__(settings.llm_service_url, "llm-service")
    
    async def generate_sql(
        self,
        natural_language_query: str,
        conversation_history: Optional[List[str]] = None,
        schema_recommendations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate SQL from natural language query with schema context."""
        
        request_data = {
            "natural_language_query": natural_language_query,
            "conversation_history": conversation_history or [],
            "schema_recommendations": schema_recommendations or {}
        }
        
        self.logger.info(
            "Generating SQL",
            query=natural_language_query,
            history_size=len(conversation_history) if conversation_history else 0,
            schema_count=len(schema_recommendations.get("recommendations", [])) if schema_recommendations else 0
        )
        
        try:
            # Try the generate-sql endpoint first (FastAPI service)
            result = await self._make_request("POST", "/generate-sql", data=request_data)
            
            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("Invalid response format")
            
            success = result.get("success", False)
            if not success:
                error = result.get("error", "Unknown error")
                self.logger.error("SQL generation failed", error=error)
                return {
                    "success": False,
                    "error": error,
                    "error_type": result.get("error_type", "GENERATION_ERROR")
                }
            
            sql = result.get("sql", "").strip()
            if not sql:
                self.logger.error("Generated SQL is empty")
                return {
                    "success": False,
                    "error": "Generated SQL is empty",
                    "error_type": "EMPTY_SQL"
                }
            
            self.logger.info(
                "SQL generated successfully",
                sql_length=len(sql),
                confidence=result.get("confidence")
            )
            
            return {
                "success": True,
                "sql": sql,
                "confidence": result.get("confidence"),
                "reasoning": result.get("reasoning"),
                "model_info": result.get("model_info", {})
            }
            
        except Exception as e:
            self.logger.error("Failed to generate SQL", error=str(e))
            return {
                "success": False,
                "error": f"LLM service error: {str(e)}",
                "error_type": "SERVICE_ERROR"
            }
    
    async def generate_corrected_sql(
        self,
        original_query: str,
        failed_sql: str,
        sql_error: str,
        error_type: str,
        schema_recommendations: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[str]] = None,
        error_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generate corrected SQL based on previous error."""
        
        # Build enhanced prompt with error context
        enhanced_prompt = self._build_error_correction_prompt(
            original_query, failed_sql, sql_error, error_type, error_history or []
        )
        
        self.logger.info(
            "Generating corrected SQL",
            original_query=original_query,
            error_type=error_type,
            retry_attempt=len(error_history) if error_history else 1
        )
        
        return await self.generate_sql(
            enhanced_prompt,
            conversation_history,
            schema_recommendations
        )
    
    def _build_error_correction_prompt(
        self,
        original_query: str,
        failed_sql: str,
        sql_error: str,
        error_type: str,
        error_history: List[str]
    ) -> str:
        """Build enhanced prompt for error correction."""
        
        prompt_parts = [
            f"CORRECTION NEEDED: The previous SQL query failed.",
            f"Original request: {original_query}",
            f"Failed SQL: {failed_sql}",
            f"Error: {sql_error}",
            f"Error type: {error_type}"
        ]
        
        if error_history:
            prompt_parts.append(f"Previous errors: {'; '.join(error_history)}")
        
        # Add specific guidance based on error type
        if "syntax" in error_type.lower():
            prompt_parts.append("Focus on SQL syntax correctness.")
        elif "column" in error_type.lower() or "table" in error_type.lower():
            prompt_parts.append("Verify table and column names exist in the schema.")
        elif "permission" in error_type.lower():
            prompt_parts.append("Use only tables and columns you have access to.")
        
        prompt_parts.append(f"Please generate a corrected SQL query for: {original_query}")
        
        return " ".join(prompt_parts)
