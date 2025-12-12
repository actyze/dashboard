"""User management and authentication service."""

from typing import List, Dict, Any, Optional
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from datetime import datetime, timedelta
import uuid

from app.database import (
    db_manager, User, UserPreferences, ConversationHistory, 
    QueryHistory, FavoriteQueries, FavoriteQueryVersion, 
    SavedQueries,  # Alias for backward compatibility
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

    async def save_query_execution(
        self,
        user_id: str,
        session_id: str,
        natural_language_query: str,
        generated_sql: str,
        execution_status: str,
        execution_time_ms: Optional[int] = None,
        row_count: Optional[int] = None,
        error_message: Optional[str] = None,
        schema_recommendations: Optional[Dict] = None,
        model_confidence: Optional[float] = None,
        retry_attempts: int = 0,
        query_name: Optional[str] = None,
        query_type: str = 'natural_language',
        chart_recommendation: Optional[Dict] = None,
        llm_response_time_ms: Optional[int] = None,
        model_reasoning: Optional[str] = None,
        generated_at: Optional[datetime] = None,
        executed_at: Optional[datetime] = None
    ):
        """
        Save query execution to history with de-duplication.
        
        Uses upsert_query_history SQL function to:
        - Find existing query by hash (SQL + user_id)
        - Update execution count and metadata if found
        - Create new entry if not found
        """
        async with db_manager.get_session() as session:
            try:
                # Call the SQL function for upsert
                result = await session.execute(
                    select(func.nexus.upsert_query_history(
                        uuid.UUID(user_id),
                        natural_language_query,
                        generated_sql,
                        execution_status,
                        execution_time_ms,
                        row_count,
                        chart_recommendation,
                        model_reasoning,
                        schema_recommendations,
                        llm_response_time_ms
                    ))
                )
                query_id = result.scalar_one()
                await session.commit()
                
                self.logger.info("Query execution saved to history (de-duplicated)",
                    query_id=str(query_id),
                    user_id=user_id,
                    query_type=query_type,
                    status=execution_status
                )
                
                return {"success": True, "query_id": str(query_id)}
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save query execution", error=str(e))
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
    
    async def get_query_history(
        self, 
        user_id: str, 
        limit: int = 50, 
        offset: int = 0,
        query_type: Optional[str] = None
    ):
        """Get query history for a user."""
        async with db_manager.get_session() as session:
            try:
                query = select(QueryHistory).where(
                    QueryHistory.user_id == uuid.UUID(user_id)
                )
                
                if query_type:
                    query = query.where(QueryHistory.query_type == query_type)
                
                query = query.order_by(QueryHistory.executed_at.desc()).limit(limit).offset(offset)
                
                result = await session.execute(query)
                queries = result.scalars().all()
                
                return {
                    "success": True,
                    "queries": [
                        {
                            "id": q.id,
                            "query_name": q.query_name,
                            "query_type": q.query_type,
                            "natural_language_query": q.natural_language_query,
                            "generated_sql": q.generated_sql,
                            "execution_status": q.execution_status,
                            "execution_time_ms": q.execution_time_ms,
                            "llm_response_time_ms": q.llm_response_time_ms,
                            "row_count": q.row_count,
                            "chart_recommendation": q.chart_recommendation,
                            "generated_at": q.generated_at.isoformat() if q.generated_at else None,
                            "executed_at": q.executed_at.isoformat() if q.executed_at else None,
                            "created_at": q.created_at.isoformat()
                        }
                        for q in queries
                    ]
                }
            except Exception as e:
                self.logger.error("Failed to get query history", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def delete_query_history(self, query_id: int, user_id: str):
        """Delete a query from history."""
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
                
                self.logger.info("Query history deleted", query_id=query_id)
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to delete query history", error=str(e))
                return {"success": False, "error": str(e)}
    
    # =============================================================================
    # Saved Queries CRUD Operations
    # =============================================================================
    
    async def create_saved_query(
        self,
        user_id: str,
        query_name: str,
        natural_language_query: str,
        generated_sql: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        chart_recommendation: Optional[Dict] = None,
        created_from_history_id: Optional[int] = None
    ):
        """Create a new saved query."""
        async with db_manager.get_session() as session:
            try:
                saved_query = SavedQueries(
                    user_id=uuid.UUID(user_id),
                    query_name=query_name,
                    description=description,
                    natural_language_query=natural_language_query,
                    generated_sql=generated_sql,
                    tags=tags or [],
                    chart_recommendation=chart_recommendation or {},
                    created_from_history_id=created_from_history_id
                )
                session.add(saved_query)
                await session.commit()
                await session.refresh(saved_query)
                
                self.logger.info("Saved query created", query_id=saved_query.id, user_id=user_id)
                return {"success": True, "query_id": saved_query.id}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to create saved query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_saved_queries(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        favorites_only: bool = False
    ):
        """Get saved queries for a user."""
        async with db_manager.get_session() as session:
            try:
                query = select(SavedQueries).where(
                    SavedQueries.user_id == uuid.UUID(user_id)
                )
                
                if favorites_only:
                    query = query.where(SavedQueries.is_favorite == True)
                
                query = query.order_by(SavedQueries.updated_at.desc()).limit(limit).offset(offset)
                
                result = await session.execute(query)
                queries = result.scalars().all()
                
                return {
                    "success": True,
                    "queries": [
                        {
                            "id": q.id,
                            "query_name": q.query_name,
                            "description": q.description,
                            "natural_language_query": q.natural_language_query,
                            "generated_sql": q.generated_sql,
                            "is_favorite": q.is_favorite,
                            "tags": q.tags,
                            "chart_recommendation": q.chart_recommendation,
                            "execution_count": q.execution_count,
                            "last_executed_at": q.last_executed_at.isoformat() if q.last_executed_at else None,
                            "created_at": q.created_at.isoformat(),
                            "updated_at": q.updated_at.isoformat()
                        }
                        for q in queries
                    ]
                }
            except Exception as e:
                self.logger.error("Failed to get saved queries", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_saved_query(self, query_id: int, user_id: str):
        """Get a specific saved query."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(SavedQueries).where(
                        and_(
                            SavedQueries.id == query_id,
                            SavedQueries.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                return {
                    "success": True,
                    "query": {
                        "id": query.id,
                        "query_name": query.query_name,
                        "description": query.description,
                        "natural_language_query": query.natural_language_query,
                        "generated_sql": query.generated_sql,
                        "is_favorite": query.is_favorite,
                        "tags": query.tags,
                        "chart_recommendation": query.chart_recommendation,
                        "execution_count": query.execution_count,
                        "last_executed_at": query.last_executed_at.isoformat() if query.last_executed_at else None,
                        "created_at": query.created_at.isoformat(),
                        "updated_at": query.updated_at.isoformat()
                    }
                }
            except Exception as e:
                self.logger.error("Failed to get saved query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def update_saved_query(
        self,
        query_id: int,
        user_id: str,
        query_name: Optional[str] = None,
        description: Optional[str] = None,
        natural_language_query: Optional[str] = None,
        generated_sql: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        tags: Optional[List[str]] = None,
        chart_recommendation: Optional[Dict] = None,
        version_notes: Optional[str] = None
    ):
        """
        Update a favorite query.
        
        If SQL changes, automatically creates a version snapshot using the
        update_favorite_query_sql SQL function.
        """
        async with db_manager.get_session() as session:
            try:
                user_uuid = uuid.UUID(user_id)
                
                # Check if SQL is being updated
                if generated_sql is not None:
                    # Use SQL function for versioning
                    result = await session.execute(
                        select(func.nexus.update_favorite_query_sql(
                            query_id,
                            user_uuid,
                            generated_sql,
                            natural_language_query,
                            chart_recommendation,
                            version_notes
                        ))
                    )
                    new_version = result.scalar_one()
                    await session.commit()
                    
                    self.logger.info("Favorite query SQL updated (versioned)",
                        query_id=query_id,
                        new_version=new_version
                    )
                
                # Update non-SQL fields separately (doesn't trigger versioning)
                result = await session.execute(
                    select(FavoriteQueries).where(
                        and_(
                            FavoriteQueries.id == query_id,
                            FavoriteQueries.user_id == user_uuid
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                # Update non-SQL fields
                if query_name is not None:
                    query.query_name = query_name
                if description is not None:
                    query.description = description
                if is_favorite is not None:
                    query.is_favorite = is_favorite
                if tags is not None:
                    query.tags = tags
                
                query.updated_at = datetime.utcnow()
                await session.commit()
                
                self.logger.info("Favorite query updated", query_id=query_id)
                return {"success": True, "version": query.version}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to update favorite query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def delete_saved_query(self, query_id: int, user_id: str):
        """Delete a saved query."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(SavedQueries).where(
                        and_(
                            SavedQueries.id == query_id,
                            SavedQueries.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                await session.delete(query)
                await session.commit()
                
                self.logger.info("Saved query deleted", query_id=query_id)
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to delete saved query", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def save_query_from_history(
        self,
        user_id: str,
        history_id: int,
        query_name: str,
        description: Optional[str] = None
    ):
        """Save a query from history to saved queries."""
        async with db_manager.get_session() as session:
            try:
                # Get history record
                result = await session.execute(
                    select(QueryHistory).where(
                        and_(
                            QueryHistory.id == history_id,
                            QueryHistory.user_id == uuid.UUID(user_id)
                        )
                    )
                )
                history = result.scalar_one_or_none()
                
                if not history:
                    return {"success": False, "error": "Query history not found or access denied"}
                
                # Create saved query
                saved_query = SavedQueries(
                    user_id=uuid.UUID(user_id),
                    query_name=query_name,
                    description=description,
                    natural_language_query=history.natural_language_query,
                    generated_sql=history.generated_sql,
                    chart_recommendation=history.chart_recommendation,
                    created_from_history_id=history_id,
                    tags=[]
                )
                session.add(saved_query)
                await session.commit()
                await session.refresh(saved_query)
                
                self.logger.info("Query saved from history", 
                    history_id=history_id, 
                    saved_query_id=saved_query.id
                )
                return {"success": True, "query_id": str(saved_query.id)}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to save query from history", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def get_favorite_query_versions(
        self,
        query_id: int,
        user_id: str
    ):
        """Get all versions of a favorite query."""
        async with db_manager.get_session() as session:
            try:
                user_uuid = uuid.UUID(user_id)
                
                # Check if user owns the query
                result = await session.execute(
                    select(FavoriteQueries).where(
                        and_(
                            FavoriteQueries.id == query_id,
                            FavoriteQueries.user_id == user_uuid
                        )
                    )
                )
                query = result.scalar_one_or_none()
                
                if not query:
                    return {"success": False, "error": "Query not found or access denied"}
                
                # Get all versions
                versions_result = await session.execute(
                    select(FavoriteQueryVersion)
                    .where(FavoriteQueryVersion.favorite_query_id == query_id)
                    .order_by(FavoriteQueryVersion.version.desc())
                )
                versions = versions_result.scalars().all()
                
                return {
                    "success": True,
                    "current_version": query.version,
                    "versions": [
                        {
                            "version": v.version,
                            "query_name": v.query_name,
                            "description": v.description,
                            "natural_language_query": v.natural_language_query,
                            "generated_sql": v.generated_sql,
                            "chart_recommendation": v.chart_recommendation,
                            "version_notes": v.version_notes,
                            "created_by": str(v.created_by) if v.created_by else None,
                            "created_at": v.created_at.isoformat()
                        }
                        for v in versions
                    ]
                }
            except Exception as e:
                self.logger.error("Failed to get favorite query versions", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def revert_favorite_query_version(
        self,
        query_id: int,
        user_id: str,
        target_version: int
    ):
        """Revert a favorite query to a previous version."""
        async with db_manager.get_session() as session:
            try:
                user_uuid = uuid.UUID(user_id)
                
                # Use SQL function for revert (creates auto-save snapshot)
                result = await session.execute(
                    select(func.nexus.revert_favorite_query_version(
                        query_id,
                        target_version,
                        user_uuid
                    ))
                )
                new_version = result.scalar_one()
                await session.commit()
                
                self.logger.info("Favorite query reverted",
                    query_id=query_id,
                    target_version=target_version,
                    new_version=new_version
                )
                
                return {
                    "success": True,
                    "new_version": new_version,
                    "reverted_to": target_version
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to revert favorite query version", error=str(e))
                return {"success": False, "error": str(e)}
