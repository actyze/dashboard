"""Extended models for user management and frontend integration."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime


# User Management Models
class UserCreate(BaseModel):
    """Input for creating a new user."""
    username: str = Field(..., description="Unique username")
    email: str = Field(..., description="User email address")
    full_name: Optional[str] = Field(default=None, description="Full name")


class UserResponse(BaseModel):
    """User response model."""
    id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    full_name: Optional[str] = Field(default=None, description="Full name")
    is_active: bool = Field(..., description="Whether user is active")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")


class UserPreferenceInput(BaseModel):
    """Input for setting user preferences."""
    preference_key: str = Field(..., description="Preference key")
    preference_value: Dict[str, Any] = Field(..., description="Preference value")


class ConversationMessageInput(BaseModel):
    """Input for saving conversation messages."""
    session_id: str = Field(..., description="Conversation session ID")
    message_type: str = Field(..., description="Message type: 'user' or 'assistant'")
    message_content: str = Field(..., description="Message content")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")


class SavedQueryInput(BaseModel):
    """Input for saving queries."""
    query_name: str = Field(..., description="Name for the saved query")
    natural_language_query: str = Field(..., description="Original natural language query")
    generated_sql: str = Field(..., description="Generated SQL query")
    description: Optional[str] = Field(default=None, description="Query description")
    tags: Optional[List[str]] = Field(default=None, description="Query tags")


class ConversationMessage(BaseModel):
    """Conversation message model."""
    id: int = Field(..., description="Message ID")
    message_type: str = Field(..., description="Message type")
    message_content: str = Field(..., description="Message content")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Message metadata")
    created_at: str = Field(..., description="Creation timestamp")


class QueryHistoryItem(BaseModel):
    """Query history item model."""
    id: int = Field(..., description="Query ID")
    session_id: str = Field(..., description="Session ID")
    natural_language_query: str = Field(..., description="Natural language query")
    generated_sql: Optional[str] = Field(default=None, description="Generated SQL")
    execution_status: str = Field(..., description="Execution status")
    execution_time_ms: Optional[int] = Field(default=None, description="Execution time in milliseconds")
    row_count: Optional[int] = Field(default=None, description="Number of rows returned")
    error_message: Optional[str] = Field(default=None, description="Error message if failed")
    model_confidence: Optional[float] = Field(default=None, description="Model confidence score")
    retry_attempts: int = Field(..., description="Number of retry attempts")
    created_at: str = Field(..., description="Creation timestamp")


class SavedQuery(BaseModel):
    """Saved query model."""
    id: int = Field(..., description="Query ID")
    query_name: str = Field(..., description="Query name")
    description: Optional[str] = Field(default=None, description="Query description")
    natural_language_query: str = Field(..., description="Natural language query")
    generated_sql: str = Field(..., description="Generated SQL")
    is_favorite: bool = Field(..., description="Whether query is marked as favorite")
    tags: Optional[List[str]] = Field(default=None, description="Query tags")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")


# Frontend Integration Models
class DashboardStats(BaseModel):
    """Dashboard statistics for frontend."""
    total_queries: int = Field(..., description="Total queries executed")
    successful_queries: int = Field(..., description="Successful queries")
    failed_queries: int = Field(..., description="Failed queries")
    average_execution_time: float = Field(..., description="Average execution time in ms")
    most_used_schemas: List[Dict[str, Any]] = Field(..., description="Most frequently used schemas")
    recent_activity: List[Dict[str, Any]] = Field(..., description="Recent query activity")
