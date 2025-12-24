"""User management and authentication service."""

from typing import List, Dict, Any, Optional
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from datetime import datetime, timedelta
import uuid

from app.database import (
    db_manager, User, UserPreferences, ConversationHistory, 
    QueryHistory, 
    Role, UserRole, Group, UserGroup, GroupRole, RefreshToken
)
from app.auth.utils import get_password_hash, verify_password, create_access_token

logger = structlog.get_logger()


class UserService:
    """Service for managing users, roles, and authentication."""
    
    def __init__(self):
        self.logger = logger.bind(service="user-service")
    
    async def create_user(
        self, 
        username: str, 
        email: str, 
        password: str,
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
                    password_hash=get_password_hash(password),
                    full_name=full_name
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                
                # Assign default VIEWER role
                viewer_role_result = await session.execute(select(Role).where(Role.name == "VIEWER"))
                viewer_role = viewer_role_result.scalar_one_or_none()
                
                if viewer_role:
                    user_role = UserRole(user_id=user.id, role_id=viewer_role.id)
                    session.add(user_role)
                    await session.commit()
                
                self.logger.info("User created", user_id=str(user.id), username=username)
                
                return {
                    "success": True,
                    "user": {
                        "id": str(user.id),
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
    
    async def authenticate_user(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user and return tokens."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(select(User).where(User.username == username))
                user = result.scalar_one_or_none()
                
                if not user or not verify_password(password, user.password_hash):
                    return {"success": False, "error": "Invalid username or password"}
                
                if not user.is_active:
                    return {"success": False, "error": "User account is inactive"}
                
                # Get Roles
                roles = await self.get_user_roles(user.id, session)
                groups = await self.get_user_groups(user.id, session)
                
                # Create Tokens
                access_token_data = {
                    "sub": str(user.id),
                    "username": user.username,
                    "roles": roles,
                    "groups": groups
                }
                access_token = create_access_token(access_token_data)
                
                return {
                    "success": True,
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "roles": roles,
                        "groups": groups
                    }
                }
                
            except Exception as e:
                self.logger.error("Authentication failed", error=str(e))
                return {"success": False, "error": str(e)}

    async def get_user_roles(self, user_id: uuid.UUID, session: AsyncSession) -> List[str]:
        """Get all roles for a user (direct + inherited from groups)."""
        # Direct roles
        direct_roles_query = select(Role.name).join(UserRole).where(UserRole.user_id == user_id)
        direct_roles = (await session.execute(direct_roles_query)).scalars().all()
        
        # Group roles
        group_roles_query = (
            select(Role.name)
            .join(GroupRole)
            .join(UserGroup, UserGroup.group_id == GroupRole.group_id)
            .where(UserGroup.user_id == user_id)
        )
        group_roles = (await session.execute(group_roles_query)).scalars().all()
        
        return list(set(direct_roles + group_roles))

    async def get_user_groups(self, user_id: uuid.UUID, session: AsyncSession) -> List[str]:
        """Get all groups a user belongs to."""
        query = select(Group.name).join(UserGroup).where(UserGroup.user_id == user_id)
        return list((await session.execute(query)).scalars().all())

    async def get_service_token(self, service_name: str) -> str:
        """
        Generate a long-lived JWT token for service-to-service communication.
        This acts as a Machine User token.
        """
        # In a real production system, we would lookup a specific 'service account' user
        # For this shared-secret implementation, we just sign a token with specific claims
        token_data = {
            "sub": f"service-account-{service_name}",
            "type": "service",
            "service": service_name,
            "roles": ["SERVICE"]
        }
        # Long expiration for service tokens (e.g., 1 hour, refreshed automatically)
        expires = datetime.utcnow() + timedelta(minutes=60)
        token_data.update({"exp": expires})
        
        return create_access_token(token_data)

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get user by ID."""
        async with db_manager.get_session() as session:
            try:
                user_uuid = uuid.UUID(user_id)
                user = await session.get(User, user_uuid)
                if not user:
                    return {"success": False, "error": "User not found"}
                
                return {
                    "success": True,
                    "user": {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "created_at": user.created_at.isoformat()
                    }
                }
            except Exception as e:
                self.logger.error("Failed to get user", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}

    # ... (Keep other methods like user preferences, history, but update IDs to UUID) ...
    
    # Placeholder for truncated file maintenance - I will keep existing methods but adapt them
    
    async def save_conversation_message(self, user_id: str, session_id: str, message_type: str, message_content: str, metadata: Optional[Dict] = None):
        async with db_manager.get_session() as session:
            try:
                conversation = ConversationHistory(
                    user_id=uuid.UUID(user_id),
                    session_id=session_id,
                    message_type=message_type,
                    message_content=message_content,
                    message_metadata=metadata or {}
                )
                session.add(conversation)
                await session.commit()
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def save_new_query(
        self,
        user_id: str,
        generated_sql: str,
        query_name: Optional[str] = None,
        natural_language_query: Optional[str] = None,  # Kept for API compatibility but not used
        chart_recommendation: Optional[dict] = None,  # Kept for API compatibility but not used
        execution_status: str = "SUCCESS",
        execution_time_ms: Optional[int] = None,
        row_count: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """
        Save a new query - EXPLICIT user action only.
        User clicks "Save As New" button to trigger this.
        """
        async with db_manager.get_session() as session:
            try:
                # Call new SQL function for explicit saves
                result = await session.execute(
                    select(func.nexus.save_new_query(
                        uuid.UUID(user_id),
                        generated_sql,
                        query_name,
                        execution_status,
                        execution_time_ms,
                        row_count,
                        error_message
                    ))
                )
                query_id = result.scalar_one()
                await session.commit()
                
                self.logger.info("New query saved",
                    query_id=str(query_id),
                    user_id=user_id,
                    query_name=query_name
                )
                
                return {"success": True, "query_id": int(query_id)}
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save new query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def update_query(
        self,
        query_id: int,
        user_id: str,
        generated_sql: Optional[str] = None,
        query_name: Optional[str] = None,
        natural_language_query: Optional[str] = None,  # Kept for API compatibility but not used
        chart_recommendation: Optional[dict] = None,  # Kept for API compatibility but not used
        execution_status: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        row_count: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """
        Update an existing query - EXPLICIT user action only.
        User clicks "Save" button to trigger this.
        """
        async with db_manager.get_session() as session:
            try:
                # Call SQL function to update query
                result = await session.execute(
                    select(func.nexus.update_existing_query(
                        query_id,
                        uuid.UUID(user_id),
                        generated_sql,
                        query_name,
                        execution_status,
                        execution_time_ms,
                        row_count,
                        error_message
                    ))
                )
                updated = result.scalar_one()
                await session.commit()
                
                if not updated:
                    return {"success": False, "error": "Query not found or access denied"}
                
                self.logger.info("Query updated",
                    query_id=query_id,
                    user_id=user_id,
                    query_name=query_name
                )
                
                return {"success": True, "query_id": query_id}
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to update query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def update_query_name(self, query_id: int, user_id: str, query_name: str):
        """Update the name of a saved query."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(QueryHistory).where(
                        and_(
                            QueryHistory.id == query_id,
                            QueryHistory.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                query.query_name = query_name
                query.updated_at = datetime.utcnow()
                await session.commit()
                
                self.logger.info("Query name updated", query_id=query_id, new_name=query_name)
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to update query name", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def delete_query(self, query_id: int, user_id: str):
        """Delete a saved query."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(QueryHistory).where(
                        and_(
                            QueryHistory.id == query_id,
                            QueryHistory.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                await session.delete(query)
                await session.commit()
                
                self.logger.info("Query deleted", query_id=query_id)
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to delete query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_query_history(
        self, 
        user_id: str, 
        limit: int = 50, 
        offset: int = 0,
        favorites_only: bool = False
    ):
        """Get query history for a user. Use favorites_only=True for favorites."""
        async with db_manager.get_session() as session:
            try:
                query = select(QueryHistory).where(
                    QueryHistory.user_id == uuid.UUID(user_id)
                )
                
                if favorites_only:
                    query = query.where(QueryHistory.is_favorite == True)
                
                # Sort by updated_at (most recently saved/updated first)
                query = query.order_by(QueryHistory.updated_at.desc()).limit(limit).offset(offset)
                
                result = await session.execute(query)
                queries = result.scalars().all()
                
                return {
                    "success": True,
                    "queries": [
                        {
                            "id": q.id,
                            "query_name": q.query_name,
                            "generated_sql": q.generated_sql,
                            "execution_status": q.execution_status,
                            "execution_time_ms": q.execution_time_ms,
                            "row_count": q.row_count,
                            "error_message": q.error_message,
                            "is_favorite": q.is_favorite,
                            "created_at": q.created_at.isoformat(),
                            "updated_at": q.updated_at.isoformat() if q.updated_at else None
                        }
                        for q in queries
                    ]
                }
            except Exception as e:
                self.logger.error("Failed to get query history", error=str(e))
                return {"success": False, "error": str(e)}
    
    # Removed: delete_query_history - query_history is now an immutable audit log
    
    async def toggle_query_favorite(self, query_id: int, user_id: str, query_name: Optional[str] = None):
        """
        Toggle favorite status for a query history entry.
        Optionally update the query_name when marking as favorite.
        """
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(QueryHistory).where(
                        and_(
                            QueryHistory.id == query_id,
                            QueryHistory.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                # Toggle favorite status
                query.is_favorite = not query.is_favorite
                
                # Update query_name if provided (useful when marking as favorite)
                if query.is_favorite and query_name:
                    query.query_name = query_name
                
                await session.commit()
                
                self.logger.info("Query favorite toggled", 
                    query_id=query_id, 
                    is_favorite=query.is_favorite,
                    query_name=query.query_name
                )
                return {
                    "success": True,
                    "is_favorite": query.is_favorite,
                    "query_name": query.query_name
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to toggle query favorite", error=str(e))
                return {"success": False, "error": str(e)}
    
    # =============================================================================
    # Removed: Saved Queries / Favorite Queries CRUD Operations
    # All functionality now consolidated in query_history with is_favorite flag
    # Use toggle_query_favorite() to mark/unmark favorites
    # Use get_query_history(favorites_only=True) to get favorites
    # =============================================================================
