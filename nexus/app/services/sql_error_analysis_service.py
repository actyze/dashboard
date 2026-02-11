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
            "MAX_RETRIES_EXCEEDED": "Unable to execute the query after multiple attempts. Please review the generated SQL or try rephrasing your question.",
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
        """Build simple error correction prompt with raw error details."""
        
        prompt_parts = [
            f"User Query: {original_query}",
            "",
            f"Failed SQL Query:\n{failed_sql}",
            "",
            f"Database Error:\n{sql_error}",
            ""
        ]
        
        # Add error history if available
        if error_history:
            prompt_parts.append("Previous Attempt Errors:")
            for i, error in enumerate(error_history, 1):
                prompt_parts.append(f"{i}. {error}")
            prompt_parts.append("")
        
        prompt_parts.append("Please generate corrected SQL based on the error above.")
        
        return "\n".join(prompt_parts)
    
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
