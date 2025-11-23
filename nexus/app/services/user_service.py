"""User management and preferences service."""

from typing import List, Dict, Any, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from datetime import datetime
import uuid

from app.database import (
    db_manager, User, UserPreferences, ConversationHistory, 
    QueryHistory, SavedQueries
)

logger = structlog.get_logger()


class UserService:
    """Service for managing users, preferences, and conversation history."""
    
    def __init__(self):
        self.logger = logger.bind(service="user-service")
    
    async def create_user(
        self, 
        username: str, 
        email: str, 
        full_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new user."""
        async with db_manager.get_session() as session:
            try:
                # Check if user already exists
                existing_user = await session.execute(
                    select(User).where(
                        (User.username == username) | (User.email == email)
                    )
                )
                if existing_user.scalar_one_or_none():
                    return {
                        "success": False,
                        "error": "User with this username or email already exists"
                    }
                
                # Create new user
                user = User(
                    username=username,
                    email=email,
                    full_name=full_name
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                
                self.logger.info("User created", user_id=user.id, username=username)
                
                return {
                    "success": True,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "created_at": user.created_at.isoformat()
                    }
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to create user", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_user(self, user_id: int) -> Dict[str, Any]:
        """Get user by ID."""
        async with db_manager.get_session() as session:
            try:
                user = await session.get(User, user_id)
                if not user:
                    return {"success": False, "error": "User not found"}
                
                return {
                    "success": True,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "created_at": user.created_at.isoformat(),
                        "updated_at": user.updated_at.isoformat()
                    }
                }
                
            except Exception as e:
                self.logger.error("Failed to get user", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_user_by_username(self, username: str) -> Dict[str, Any]:
        """Get user by username."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(User).where(User.username == username)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    return {"success": False, "error": "User not found"}
                
                return {
                    "success": True,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "created_at": user.created_at.isoformat(),
                        "updated_at": user.updated_at.isoformat()
                    }
                }
                
            except Exception as e:
                self.logger.error("Failed to get user by username", username=username, error=str(e))
                return {"success": False, "error": str(e)}
    
    async def set_user_preference(
        self, 
        user_id: int, 
        preference_key: str, 
        preference_value: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Set or update user preference."""
        async with db_manager.get_session() as session:
            try:
                # Check if preference exists
                result = await session.execute(
                    select(UserPreferences).where(
                        (UserPreferences.user_id == user_id) & 
                        (UserPreferences.preference_key == preference_key)
                    )
                )
                existing_pref = result.scalar_one_or_none()
                
                if existing_pref:
                    # Update existing preference
                    existing_pref.preference_value = preference_value
                    existing_pref.updated_at = datetime.utcnow()
                else:
                    # Create new preference
                    pref = UserPreferences(
                        user_id=user_id,
                        preference_key=preference_key,
                        preference_value=preference_value
                    )
                    session.add(pref)
                
                await session.commit()
                
                self.logger.info(
                    "User preference updated", 
                    user_id=user_id, 
                    preference_key=preference_key
                )
                
                return {"success": True, "message": "Preference updated successfully"}
                
            except Exception as e:
                await session.rollback()
                self.logger.error(
                    "Failed to set user preference", 
                    user_id=user_id, 
                    preference_key=preference_key, 
                    error=str(e)
                )
                return {"success": False, "error": str(e)}
    
    async def get_user_preferences(self, user_id: int) -> Dict[str, Any]:
        """Get all user preferences."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserPreferences).where(UserPreferences.user_id == user_id)
                )
                preferences = result.scalars().all()
                
                prefs_dict = {}
                for pref in preferences:
                    prefs_dict[pref.preference_key] = {
                        "value": pref.preference_value,
                        "updated_at": pref.updated_at.isoformat()
                    }
                
                return {
                    "success": True,
                    "preferences": prefs_dict
                }
                
            except Exception as e:
                self.logger.error("Failed to get user preferences", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}
    
    async def save_conversation_message(
        self,
        user_id: int,
        session_id: str,
        message_type: str,
        message_content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Save conversation message to history."""
        async with db_manager.get_session() as session:
            try:
                conversation = ConversationHistory(
                    user_id=user_id,
                    session_id=session_id,
                    message_type=message_type,
                    message_content=message_content,
                    message_metadata=metadata or {}
                )
                session.add(conversation)
                await session.commit()
                
                self.logger.debug(
                    "Conversation message saved",
                    user_id=user_id,
                    session_id=session_id,
                    message_type=message_type
                )
                
                return {"success": True, "message": "Conversation message saved"}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save conversation message", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_conversation_history(
        self, 
        user_id: int, 
        session_id: str, 
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get conversation history for a session."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(ConversationHistory)
                    .where(
                        (ConversationHistory.user_id == user_id) &
                        (ConversationHistory.session_id == session_id)
                    )
                    .order_by(ConversationHistory.created_at.desc())
                    .limit(limit)
                )
                messages = result.scalars().all()
                
                history = []
                for msg in reversed(messages):  # Reverse to get chronological order
                    history.append({
                        "id": msg.id,
                        "message_type": msg.message_type,
                        "message_content": msg.message_content,
                        "metadata": msg.message_metadata,
                        "created_at": msg.created_at.isoformat()
                    })
                
                return {
                    "success": True,
                    "conversation_history": history
                }
                
            except Exception as e:
                self.logger.error("Failed to get conversation history", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def save_query_execution(
        self,
        user_id: int,
        session_id: str,
        natural_language_query: str,
        generated_sql: Optional[str],
        execution_status: str,
        execution_time_ms: Optional[int] = None,
        row_count: Optional[int] = None,
        error_message: Optional[str] = None,
        schema_recommendations: Optional[Dict[str, Any]] = None,
        model_confidence: Optional[float] = None,
        retry_attempts: int = 0
    ) -> Dict[str, Any]:
        """Save query execution to history."""
        async with db_manager.get_session() as session:
            try:
                query_record = QueryHistory(
                    user_id=user_id,
                    session_id=session_id,
                    natural_language_query=natural_language_query,
                    generated_sql=generated_sql,
                    execution_status=execution_status,
                    execution_time_ms=execution_time_ms,
                    row_count=row_count,
                    error_message=error_message,
                    schema_recommendations=schema_recommendations,
                    model_confidence=model_confidence,
                    retry_attempts=retry_attempts
                )
                session.add(query_record)
                await session.commit()
                
                self.logger.info(
                    "Query execution saved",
                    user_id=user_id,
                    session_id=session_id,
                    status=execution_status
                )
                
                return {"success": True, "message": "Query execution saved"}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save query execution", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_query_history(
        self, 
        user_id: int, 
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get user's query history."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(QueryHistory)
                    .where(QueryHistory.user_id == user_id)
                    .order_by(QueryHistory.created_at.desc())
                    .limit(limit)
                )
                queries = result.scalars().all()
                
                history = []
                for query in queries:
                    history.append({
                        "id": query.id,
                        "session_id": query.session_id,
                        "natural_language_query": query.natural_language_query,
                        "generated_sql": query.generated_sql,
                        "execution_status": query.execution_status,
                        "execution_time_ms": query.execution_time_ms,
                        "row_count": query.row_count,
                        "error_message": query.error_message,
                        "model_confidence": query.model_confidence,
                        "retry_attempts": query.retry_attempts,
                        "created_at": query.created_at.isoformat()
                    })
                
                return {
                    "success": True,
                    "query_history": history
                }
                
            except Exception as e:
                self.logger.error("Failed to get query history", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def save_query(
        self,
        user_id: int,
        query_name: str,
        natural_language_query: str,
        generated_sql: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Save a query for reuse."""
        async with db_manager.get_session() as session:
            try:
                saved_query = SavedQueries(
                    user_id=user_id,
                    query_name=query_name,
                    description=description,
                    natural_language_query=natural_language_query,
                    generated_sql=generated_sql,
                    tags=tags or []
                )
                session.add(saved_query)
                await session.commit()
                await session.refresh(saved_query)
                
                self.logger.info(
                    "Query saved",
                    user_id=user_id,
                    query_name=query_name,
                    query_id=saved_query.id
                )
                
                return {
                    "success": True,
                    "saved_query": {
                        "id": saved_query.id,
                        "query_name": saved_query.query_name,
                        "description": saved_query.description,
                        "natural_language_query": saved_query.natural_language_query,
                        "generated_sql": saved_query.generated_sql,
                        "tags": saved_query.tags,
                        "created_at": saved_query.created_at.isoformat()
                    }
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_saved_queries(self, user_id: int) -> Dict[str, Any]:
        """Get user's saved queries."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(SavedQueries)
                    .where(SavedQueries.user_id == user_id)
                    .order_by(SavedQueries.created_at.desc())
                )
                queries = result.scalars().all()
                
                saved_queries = []
                for query in queries:
                    saved_queries.append({
                        "id": query.id,
                        "query_name": query.query_name,
                        "description": query.description,
                        "natural_language_query": query.natural_language_query,
                        "generated_sql": query.generated_sql,
                        "is_favorite": query.is_favorite,
                        "tags": query.tags,
                        "created_at": query.created_at.isoformat(),
                        "updated_at": query.updated_at.isoformat()
                    })
                
                return {
                    "success": True,
                    "saved_queries": saved_queries
                }
                
            except Exception as e:
                self.logger.error("Failed to get saved queries", error=str(e))
                return {"success": False, "error": str(e)}
    
    def generate_session_id(self) -> str:
        """Generate a unique session ID."""
        return str(uuid.uuid4())
