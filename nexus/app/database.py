"""Database configuration and models for user data persistence."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Text, DateTime, JSON, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
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
    """Role definitions (ADMIN, EDITOR, VIEWER)."""
    __tablename__ = "roles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Group(Base):
    """Group/Team definitions."""
    __tablename__ = "groups"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserRole(Base):
    """Direct mapping of Users to Roles."""
    __tablename__ = "user_roles"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserGroup(Base):
    """Mapping of Users to Groups."""
    __tablename__ = "user_groups"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), primary_key=True)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.groups.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GroupRole(Base):
    """Mapping of Groups to Roles (Inheritance)."""
    __tablename__ = "group_roles"
    
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.groups.id", ondelete="CASCADE"), primary_key=True)
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
    owner_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("nexus.groups.id", ondelete="SET NULL"))
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
    """Query execution history for analytics and caching."""
    __tablename__ = "query_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    query_name: Mapped[Optional[str]] = mapped_column(String(255))
    query_type: Mapped[str] = mapped_column(String(20), nullable=False, default='natural_language', index=True)  # 'natural_language' or 'manual'
    natural_language_query: Mapped[str] = mapped_column(Text, nullable=False)
    generated_sql: Mapped[Optional[str]] = mapped_column(Text)
    execution_status: Mapped[str] = mapped_column(String(20), nullable=False)  # 'success', 'error', 'timeout'
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    llm_response_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    schema_recommendations: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    chart_recommendation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    model_confidence: Mapped[Optional[float]] = mapped_column()
    retry_attempts: Mapped[int] = mapped_column(Integer, default=0)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class SavedQueries(Base):
    """User-saved queries for reuse."""
    __tablename__ = "saved_queries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nexus.users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("nexus.groups.id", ondelete="SET NULL"))
    query_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    natural_language_query: Mapped[str] = mapped_column(Text, nullable=False)
    generated_sql: Mapped[str] = mapped_column(Text, nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    chart_recommendation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    execution_count: Mapped[int] = mapped_column(Integer, default=0)
    last_executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_from_history_id: Mapped[Optional[int]] = mapped_column(ForeignKey("nexus.query_history.id", ondelete="SET NULL"))
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
