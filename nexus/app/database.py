"""Database configuration and models for user data persistence."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Text, DateTime, JSON, Integer, Boolean, ForeignKey, Numeric, Float
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
import enum
from datetime import datetime
import uuid
from typing import Optional, Dict, Any, List
import structlog
from app.config import settings

logger = structlog.get_logger()


class Base(DeclarativeBase):
    """Base class for all database models."""
    # Use nexus schema for all Nexus service tables
    __table_args__ = {'schema': 'nexus'}


class User(Base):
    """User model for authentication and preferences."""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Role(Base):
    """Role definitions (ADMIN, USER)."""
    __tablename__ = "roles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserRole(Base):
    """Direct mapping of Users to Roles."""
    __tablename__ = "user_roles"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
    """Refresh tokens for JWT authentication."""
    __tablename__ = "refresh_tokens"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Dashboard(Base):
    """Dashboard configuration and metadata."""
    __tablename__ = "dashboards"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    configuration: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    owner_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("nexus.users.id", ondelete="SET NULL"))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserPreferences(Base):
    """User preferences and settings."""
    __tablename__ = "user_preferences"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    preference_key: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_value: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConversationHistory(Base):
    """Conversation history for context-aware queries."""
    __tablename__ = "conversation_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    message_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QueryHistory(Base):
    """
    User-saved queries (explicit saves only, no automatic deduplication).
    
    Queries are only saved when user clicks "Save" or "Save As New" button.
    Sorted by updated_at timestamp.
    """
    __tablename__ = "query_history"
    __table_args__ = {'schema': 'nexus'}
    
    # Core identifiers
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Query content (SQL is the source of truth)
    generated_sql: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Execution metadata (captured at save time)
    execution_status: Mapped[str] = mapped_column(String(20), nullable=False)  # 'SUCCESS' or 'FAILURE'
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # User preferences
    query_name: Mapped[Optional[str]] = mapped_column(String(255))  # User-provided name
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)  # When first saved
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # When last updated


class UserDataAccess(Base):
    """Direct user-level data access control (no groups)."""
    __tablename__ = "user_data_access"
    __table_args__ = {'schema': 'nexus'}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Resource hierarchy (all optional for flexibility - NULL = wildcard)
    catalog: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    database_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    schema_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    table_name: Mapped[Optional[str]] = mapped_column(String(255))
    allowed_columns: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    
    # Access type (analytics read-only for now)
    can_query: Mapped[bool] = mapped_column(Boolean, default=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Audit fields
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("nexus.users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserSchemaPreference(Base):
    """User-specific preferred tables for AI query prioritization (table-level only)."""
    __tablename__ = "user_schema_preferences"
    __table_args__ = {'schema': 'nexus'}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Resource hierarchy (table-level required)
    catalog: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    database_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    schema_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Required - table-level only
    
    # Preferred tables feature
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=True)
    columns_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, default={})
    table_metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Audit fields
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SchemaExclusion(Base):
    """Global (org-level) exclusions to hide databases, schemas, or tables from AI recommendations."""
    __tablename__ = "schema_exclusions"
    __table_args__ = {'schema': 'nexus'}
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Hierarchical structure
    catalog: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    schema_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    table_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Reason for exclusion (optional)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata tracking
    excluded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TableRelationship(Base):
    """Table-to-table relationship for semantic graph."""
    __tablename__ = "table_relationships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_catalog: Mapped[str] = mapped_column(String(255), nullable=False)
    source_schema: Mapped[str] = mapped_column(String(255), nullable=False)
    source_table: Mapped[str] = mapped_column(String(255), nullable=False)
    target_catalog: Mapped[str] = mapped_column(String(255), nullable=False)
    target_schema: Mapped[str] = mapped_column(String(255), nullable=False)
    target_table: Mapped[str] = mapped_column(String(255), nullable=False)
    join_condition: Mapped[str] = mapped_column(Text, nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(10), nullable=False, default='1:N')
    source_method: Mapped[str] = mapped_column(String(20), nullable=False, default='inferred')
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('nexus.users.id'), nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('nexus.users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class RelationshipAuditLog(Base):
    """Audit trail for relationship changes."""
    __tablename__ = "relationship_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    relationship_id: Mapped[int] = mapped_column(Integer, ForeignKey('nexus.table_relationships.id', ondelete='CASCADE'), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    old_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('nexus.users.id'), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class DatabaseManager:
    """Database connection and session management."""
    
    def __init__(self):
        self.engine = None
        self.async_session = None
        self.logger = logger.bind(component="database")
    
    async def initialize(self):
        """Initialize database connection."""
        try:
            # Create async engine
            database_url = f"postgresql+asyncpg://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_database}"
            
            self.engine = create_async_engine(
                database_url,
                echo=settings.debug,  # Log SQL queries in debug mode
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=3600
            )
            
            # Create session factory
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            self.logger.info("Database initialized successfully")
            
        except Exception as e:
            self.logger.error("Failed to initialize database", error=str(e))
            raise
    
    async def create_tables(self):
        """Create all tables automatically."""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            self.logger.info("Database tables created successfully")
        except Exception as e:
            self.logger.error("Failed to create tables", error=str(e))
            raise
    
    def get_session(self) -> AsyncSession:
        """Get database session."""
        if not self.async_session:
            raise RuntimeError("Database not initialized")
        return self.async_session()
    
    async def close(self):
        """Close database connections."""
        if self.engine:
            await self.engine.dispose()
            self.logger.info("Database connections closed")


# Global database manager instance
db_manager = DatabaseManager()


# FastAPI dependency for database sessions
async def get_db():
    """
    FastAPI dependency that provides a database session.
    
    Usage:
        @router.post("/endpoint")
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            # Use db here
            ...
    """
    session = db_manager.get_session()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
