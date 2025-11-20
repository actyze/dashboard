"""Database configuration and models for user data persistence."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, JSON, Integer, Boolean
from datetime import datetime
from typing import Optional, Dict, Any, List
import structlog
from app.config import settings

logger = structlog.get_logger()


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


class User(Base):
    """User model for authentication and preferences."""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserPreferences(Base):
    """User preferences and settings."""
    __tablename__ = "user_preferences"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    preference_key: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_value: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConversationHistory(Base):
    """Conversation history for context-aware queries."""
    __tablename__ = "conversation_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QueryHistory(Base):
    """Query execution history for analytics and caching."""
    __tablename__ = "query_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    natural_language_query: Mapped[str] = mapped_column(Text, nullable=False)
    generated_sql: Mapped[Optional[str]] = mapped_column(Text)
    execution_status: Mapped[str] = mapped_column(String(20), nullable=False)  # 'success', 'error', 'timeout'
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    schema_recommendations: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    model_confidence: Mapped[Optional[float]] = mapped_column()
    retry_attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SavedQueries(Base):
    """User-saved queries for reuse."""
    __tablename__ = "saved_queries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    query_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    natural_language_query: Mapped[str] = mapped_column(Text, nullable=False)
    generated_sql: Mapped[str] = mapped_column(Text, nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
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
        """Create all tables (for development - use Alembic in production)."""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            self.logger.info("Database tables created successfully")
        except Exception as e:
            self.logger.error("Failed to create tables", error=str(e))
            raise
    
    async def get_session(self) -> AsyncSession:
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
