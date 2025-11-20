"""Pydantic models for data validation and serialization."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import strawberry


# Input Models
class ConversationInput(BaseModel):
    """Input for natural language conversation."""
    message: str = Field(..., description="Natural language query")
    conversation_history: Optional[List[str]] = Field(default=None, description="Previous conversation context")


class SQLInput(BaseModel):
    """Input for direct SQL execution."""
    sql: str = Field(..., description="SQL query to execute")
    max_results: Optional[int] = Field(default=100, description="Maximum number of results")
    timeout_seconds: Optional[int] = Field(default=30, description="Query timeout in seconds")


# Response Models
class QueryResults(BaseModel):
    """Query execution results."""
    columns: List[str] = Field(..., description="Column names")
    rows: List[List[Any]] = Field(..., description="Result rows")
    row_count: int = Field(..., description="Number of rows returned")


class SchemaRecommendation(BaseModel):
    """Schema recommendation from FAISS service."""
    full_name: str = Field(..., description="Full schema.table name")
    confidence: float = Field(..., description="Confidence score")
    table_name: str = Field(..., description="Table name")
    schema_name: str = Field(..., description="Schema name")
    columns: Optional[List[str]] = Field(default=None, description="Column names")


class ServiceHealth(BaseModel):
    """Health status of an external service."""
    name: str = Field(..., description="Service name")
    healthy: bool = Field(..., description="Health status")
    response_time: Optional[float] = Field(default=None, description="Response time in seconds")
    error: Optional[str] = Field(default=None, description="Error message if unhealthy")


class HealthCheckResponse(BaseModel):
    """Overall health check response."""
    status: str = Field(..., description="Overall status")
    services: List[ServiceHealth] = Field(..., description="Individual service health")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")


class WorkflowResponse(BaseModel):
    """Response from natural language workflow."""
    success: bool = Field(..., description="Whether the workflow succeeded")
    nl_query: str = Field(..., description="Original natural language query")
    generated_sql: Optional[str] = Field(default=None, description="Generated SQL query")
    query_results: Optional[QueryResults] = Field(default=None, description="Query execution results")
    schema_recommendations: Optional[List[SchemaRecommendation]] = Field(default=None, description="Schema recommendations")
    model_confidence: Optional[float] = Field(default=None, description="Model confidence score")
    model_reasoning: Optional[str] = Field(default=None, description="Model reasoning")
    processing_time: float = Field(..., description="Total processing time in milliseconds")
    execution_time: Optional[float] = Field(default=None, description="SQL execution time in milliseconds")
    retry_attempts: int = Field(default=0, description="Number of retry attempts")
    error_history: Optional[List[str]] = Field(default=None, description="History of errors during retries")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    error_type: Optional[str] = Field(default=None, description="Error type classification")


class SQLResponse(BaseModel):
    """Response from direct SQL execution."""
    success: bool = Field(..., description="Whether the execution succeeded")
    original_sql: str = Field(..., description="Original SQL query")
    query_results: Optional[QueryResults] = Field(default=None, description="Query execution results")
    execution_time: float = Field(..., description="Execution time in milliseconds")
    error: Optional[str] = Field(default=None, description="Error message if failed")


# GraphQL Types (using Strawberry)
@strawberry.input
class ConversationInputGQL:
    """GraphQL input for natural language conversation."""
    message: str = strawberry.field(description="Natural language query")
    conversation_history: Optional[List[str]] = strawberry.field(default=None, description="Previous conversation context")


@strawberry.input
class SQLInputGQL:
    """GraphQL input for direct SQL execution."""
    sql: str = strawberry.field(description="SQL query to execute")
    max_results: Optional[int] = strawberry.field(default=100, description="Maximum number of results")
    timeout_seconds: Optional[int] = strawberry.field(default=30, description="Query timeout in seconds")


@strawberry.type
class QueryResultsGQL:
    """GraphQL type for query execution results."""
    columns: List[str] = strawberry.field(description="Column names")
    rows: List[List[strawberry.scalars.JSON]] = strawberry.field(description="Result rows")
    row_count: int = strawberry.field(description="Number of rows returned")


@strawberry.type
class SchemaRecommendationGQL:
    """GraphQL type for schema recommendation."""
    full_name: str = strawberry.field(description="Full schema.table name")
    confidence: float = strawberry.field(description="Confidence score")
    table_name: str = strawberry.field(description="Table name")
    schema_name: str = strawberry.field(description="Schema name")
    columns: Optional[List[str]] = strawberry.field(default=None, description="Column names")


@strawberry.type
class ServiceHealthGQL:
    """GraphQL type for service health."""
    name: str = strawberry.field(description="Service name")
    healthy: bool = strawberry.field(description="Health status")
    response_time: Optional[float] = strawberry.field(default=None, description="Response time in seconds")
    error: Optional[str] = strawberry.field(default=None, description="Error message if unhealthy")


@strawberry.type
class HealthCheckResponseGQL:
    """GraphQL type for health check response."""
    status: str = strawberry.field(description="Overall status")
    services: List[ServiceHealthGQL] = strawberry.field(description="Individual service health")
    timestamp: datetime = strawberry.field(description="Check timestamp")


@strawberry.type
class WorkflowResponseGQL:
    """GraphQL type for workflow response."""
    success: bool = strawberry.field(description="Whether the workflow succeeded")
    nl_query: str = strawberry.field(description="Original natural language query")
    generated_sql: Optional[str] = strawberry.field(default=None, description="Generated SQL query")
    query_results: Optional[QueryResultsGQL] = strawberry.field(default=None, description="Query execution results")
    schema_recommendations: Optional[List[SchemaRecommendationGQL]] = strawberry.field(default=None, description="Schema recommendations")
    model_confidence: Optional[float] = strawberry.field(default=None, description="Model confidence score")
    model_reasoning: Optional[str] = strawberry.field(default=None, description="Model reasoning")
    processing_time: float = strawberry.field(description="Total processing time in milliseconds")
    execution_time: Optional[float] = strawberry.field(default=None, description="SQL execution time in milliseconds")
    retry_attempts: int = strawberry.field(description="Number of retry attempts")
    error_history: Optional[List[str]] = strawberry.field(default=None, description="History of errors during retries")
    error: Optional[str] = strawberry.field(default=None, description="Error message if failed")
    error_type: Optional[str] = strawberry.field(default=None, description="Error type classification")


@strawberry.type
class SQLResponseGQL:
    """GraphQL type for SQL response."""
    success: bool = strawberry.field(description="Whether the execution succeeded")
    original_sql: str = strawberry.field(description="Original SQL query")
    query_results: Optional[QueryResultsGQL] = strawberry.field(default=None, description="Query execution results")
    execution_time: float = strawberry.field(description="Execution time in milliseconds")
    error: Optional[str] = strawberry.field(default=None, description="Error message if failed")
