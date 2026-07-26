"""Audit logging for compliance and tracking."""

import structlog
import json
from typing import Any, Dict, Optional
from datetime import datetime


class AuditLogger:
    """Structured audit logger for tracking important events."""

    def __init__(self):
        self.logger = structlog.get_logger("audit")

    def log_nl_query(
        self,
        user_id: Optional[str],
        query_text: str,
        generated_sql: str,
        catalog: str,
        row_count: int,
        llm_model: str,
        input_tokens: int,
        output_tokens: int,
        request_id: Optional[str] = None,
        execution_time_ms: float = 0
    ):
        """Log a natural language query execution."""
        self.logger.info(
            "nl_query_executed",
            event_type="nl_query",
            request_id=request_id,
            user_id=user_id,
            query_text=query_text,
            generated_sql=generated_sql,
            catalog=catalog,
            row_count=row_count,
            llm_model=llm_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            execution_time_ms=execution_time_ms
        )

    def log_sql_execution(
        self,
        user_id: Optional[str],
        sql_query: str,
        catalog: str,
        row_count: int,
        execution_time_ms: float,
        request_id: Optional[str] = None,
        error: Optional[str] = None
    ):
        """Log SQL query execution."""
        self.logger.info(
            "sql_execution",
            event_type="sql_execution",
            request_id=request_id,
            user_id=user_id,
            sql_query=sql_query,
            catalog=catalog,
            row_count=row_count,
            execution_time_ms=execution_time_ms,
            error=error
        )

    def log_prediction_generated(
        self,
        user_id: Optional[str],
        pipeline_type: str,
        pipeline_name: str,
        metric_name: str,
        row_count: int,
        request_id: Optional[str] = None,
        duration_ms: float = 0
    ):
        """Log prediction generation."""
        self.logger.info(
            "prediction_generated",
            event_type="prediction_generated",
            request_id=request_id,
            user_id=user_id,
            pipeline_type=pipeline_type,
            pipeline_name=pipeline_name,
            metric_name=metric_name,
            row_count=row_count,
            duration_ms=duration_ms
        )

    def log_data_export(
        self,
        user_id: Optional[str],
        export_type: str,
        format: str,
        row_count: int,
        request_id: Optional[str] = None
    ):
        """Log data export action."""
        self.logger.info(
            "data_exported",
            event_type="data_export",
            request_id=request_id,
            user_id=user_id,
            export_type=export_type,
            format=format,
            row_count=row_count
        )

    def log_dashboard_creation(
        self,
        user_id: Optional[str],
        dashboard_name: str,
        tile_count: int,
        request_id: Optional[str] = None
    ):
        """Log dashboard creation."""
        self.logger.info(
            "dashboard_created",
            event_type="dashboard_created",
            request_id=request_id,
            user_id=user_id,
            dashboard_name=dashboard_name,
            tile_count=tile_count
        )

    def log_schema_change(
        self,
        user_id: Optional[str],
        change_type: str,
        affected_tables: list,
        request_id: Optional[str] = None
    ):
        """Log schema-related changes."""
        self.logger.info(
            "schema_change",
            event_type="schema_change",
            request_id=request_id,
            user_id=user_id,
            change_type=change_type,
            affected_tables=affected_tables
        )

    def log_authentication(
        self,
        user_id: str,
        success: bool,
        request_id: Optional[str] = None,
        error: Optional[str] = None
    ):
        """Log authentication attempts."""
        self.logger.info(
            "authentication",
            event_type="authentication",
            request_id=request_id,
            user_id=user_id,
            success=success,
            error=error
        )

    def log_authorization_failure(
        self,
        user_id: Optional[str],
        resource: str,
        action: str,
        request_id: Optional[str] = None
    ):
        """Log authorization failures."""
        self.logger.info(
            "authorization_failure",
            event_type="authorization_failure",
            request_id=request_id,
            user_id=user_id,
            resource=resource,
            action=action
        )

    def log_api_error(
        self,
        user_id: Optional[str],
        endpoint: str,
        method: str,
        status_code: int,
        error_message: str,
        request_id: Optional[str] = None
    ):
        """Log API errors."""
        self.logger.info(
            "api_error",
            event_type="api_error",
            request_id=request_id,
            user_id=user_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            error_message=error_message
        )


# Global audit logger instance
audit_logger = AuditLogger()
