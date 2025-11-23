"""SQL error analysis service for enhanced error handling and correction."""

from typing import List, Dict, Any
import structlog


class SqlErrorAnalysisService:
    """Service for analyzing SQL errors and building enhanced error prompts."""
    
    def __init__(self):
        self.logger = structlog.get_logger().bind(service="sql-error-analysis")
    
    def analyze_error_type(self, sql_error: str) -> str:
        """Analyze SQL error type to improve retry strategy."""
        if not sql_error:
            return "UNKNOWN"
        
        error = sql_error.lower()
        
        # Syntax errors - usually fixable with retry
        if any(keyword in error for keyword in ["syntax error", "mismatched input", "expecting"]):
            # Special case: Semicolon errors are very specific and fixable
            if "semicolon" in error or "mismatched input ';'" in error:
                return "SEMICOLON_ERROR"
            return "SYNTAX_ERROR"
        
        # Schema/table not found - might need different schema context
        if (("schema" in error and "does not exist" in error) or
            ("table" in error and "not found" in error) or
            ("relation" in error and "does not exist" in error)):
            return "SCHEMA_ERROR"
        
        # Column not found - might need better column mapping
        if "column" in error and ("not found" in error or "does not exist" in error):
            return "COLUMN_ERROR"
        
        # Permission/access errors - usually not fixable with retry
        if any(keyword in error for keyword in ["permission", "access denied", "unauthorized"]):
            return "PERMISSION_ERROR"
        
        # Connection/timeout errors - might be temporary
        if any(keyword in error for keyword in ["connection", "timeout", "network"]):
            return "CONNECTION_ERROR"
        
        # Type/casting errors
        if any(keyword in error for keyword in ["type", "cast", "conversion"]):
            return "TYPE_ERROR"
        
        return "UNKNOWN_ERROR"
    
    def get_user_friendly_error(self, error_type: str, original_error: str) -> str:
        """Convert technical error types to user-friendly messages."""
        
        error_messages = {
            "CONFIGURATION_ERROR": "LLM service is not properly configured. Please contact administrator.",
            "NETWORK_ERROR": "Unable to connect to LLM service. Please try again later.",
            "API_ERROR": "LLM service authentication failed. Please contact administrator.",
            "SYNTAX_ERROR": "Generated SQL has syntax issues. Trying to fix automatically...",
            "SEMICOLON_ERROR": "SQL contains unsupported semicolons. Fixing automatically...",
            "SCHEMA_ERROR": "Referenced table or schema not found. Checking available schemas...",
            "COLUMN_ERROR": "Referenced column not found. Verifying column names...",
            "PERMISSION_ERROR": "Access denied to requested data. Please contact administrator.",
            "CONNECTION_ERROR": "Database connection issue. Please try again later.",
            "TYPE_ERROR": "Data type conversion error. Adjusting query format...",
            "TIMEOUT_ERROR": "Query took too long to execute. Try simplifying your request.",
            "UNKNOWN_ERROR": "An unexpected error occurred. Please try rephrasing your request."
        }
        
        return error_messages.get(error_type, f"Failed to process query: {original_error}")
    
    def build_enhanced_error_prompt(
        self, 
        original_query: str, 
        failed_sql: str, 
        sql_error: str, 
        error_type: str, 
        error_history: List[str]
    ) -> str:
        """Build enhanced error correction prompt with Trino-specific guidance."""
        
        prompt_parts = [
            "TARGET DATABASE: Trino/Presto SQL Engine",
            self._get_trino_rules(),
            "",
            "FIX SQL ERROR",
            f"Original Request: {original_query}",
            f"Failed SQL: {failed_sql}",
            f"Error: {sql_error}",
            ""
        ]
        
        # Add specific guidance based on error type
        guidance = self._get_error_type_guidance(error_type, sql_error)
        if guidance:
            prompt_parts.append(guidance)
            prompt_parts.append("")
        
        # Add error history if available
        if error_history:
            prompt_parts.append(f"Previous Errors: {'; '.join(error_history)}")
            prompt_parts.append("")
        
        prompt_parts.append("Generate corrected SQL (no semicolons, proper Trino syntax):")
        
        return "\n".join(prompt_parts)
    
    def _get_trino_rules(self) -> str:
        """Get Trino-specific SQL rules."""
        return (
            "RULES: "
            "- NO semicolons (;) - Trino JDBC rejects them"
            "- Use catalog.schema.table format"
            "- Trino/Presto syntax only"
            "- Case-sensitive identifiers"
            "- Use proper JOIN syntax"
        )
    
    def _get_error_type_guidance(self, error_type: str, sql_error: str) -> str:
        """Get specific guidance based on error type."""
        
        guidance_map = {
            "SYNTAX_ERROR": "Check commas, parentheses, keywords. Ensure Trino/Presto compatibility.",
            "SEMICOLON_ERROR": "Remove ALL semicolons (;). Example: 'SELECT * FROM table' not 'SELECT * FROM table;'",
            "SCHEMA_ERROR": "Schema/table not found. Use provided schema recommendations, check catalog.schema.table format.",
            "COLUMN_ERROR": "Column not found. Check schema recommendations, use exact column names (case-sensitive).",
            "PERMISSION_ERROR": "Access denied. Use only accessible tables and columns.",
            "CONNECTION_ERROR": "Connection issue. Simplify query, reduce complexity.",
            "TYPE_ERROR": "Data type issue. Check column types and casting.",
            "TIMEOUT_ERROR": "Query too complex. Add LIMIT clause, simplify JOINs."
        }
        
        base_guidance = guidance_map.get(error_type, "Review error message, ensure Trino compatibility.")
        
        # Add specific semicolon guidance if detected
        if "semicolon" in sql_error.lower() or ";" in sql_error:
            base_guidance += " CRITICAL: Remove all semicolons from the query."
        
        return base_guidance
    
    def should_retry_error(self, error_type: str) -> bool:
        """Determine if an error type is worth retrying."""
        
        retryable_errors = {
            "SYNTAX_ERROR", "SEMICOLON_ERROR", "SCHEMA_ERROR", 
            "COLUMN_ERROR", "TYPE_ERROR", "UNKNOWN_ERROR"
        }
        
        non_retryable_errors = {
            "PERMISSION_ERROR", "CONFIGURATION_ERROR", "API_ERROR"
        }
        
        if error_type in retryable_errors:
            return True
        elif error_type in non_retryable_errors:
            return False
        else:
            # Default to retry for unknown error types
            return True
    
    def get_retry_strategy(self, error_type: str) -> Dict[str, Any]:
        """Get retry strategy based on error type."""
        
        strategies = {
            "SEMICOLON_ERROR": {
                "max_retries": 1,  # Usually fixed in one attempt
                "priority": "high"
            },
            "SYNTAX_ERROR": {
                "max_retries": 2,
                "priority": "high"
            },
            "SCHEMA_ERROR": {
                "max_retries": 2,
                "priority": "medium"
            },
            "COLUMN_ERROR": {
                "max_retries": 2,
                "priority": "medium"
            },
            "TYPE_ERROR": {
                "max_retries": 1,
                "priority": "low"
            },
            "PERMISSION_ERROR": {
                "max_retries": 0,  # Don't retry permission errors
                "priority": "none"
            }
        }
        
        return strategies.get(error_type, {
            "max_retries": 1,
            "priority": "low"
        })
