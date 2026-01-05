"""Simplified Admin Service - 2 roles (ADMIN/USER), direct user-level data access."""

from typing import List, Dict, Any, Optional
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from datetime import datetime
import uuid

from app.database import (
    db_manager, User, Role, UserRole, UserDataAccess
)
from app.auth.utils import get_password_hash

logger = structlog.get_logger()


class AdminService:
    """Simplified admin service: 2 roles (ADMIN/USER), direct user-level data access."""
    
    def __init__(self):
        self.logger = logger.bind(service="admin-service")
    
    # =========================================================================
    # USER MANAGEMENT
    # =========================================================================
    
    async def list_users(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """List users with their roles."""
        async with db_manager.get_session() as session:
            try:
                query = select(User).where(User.is_active == True)
                
                if search:
                    search_pattern = f"%{search}%"
                    query = query.where(
                        or_(
                            User.username.ilike(search_pattern),
                            User.email.ilike(search_pattern),
                            User.full_name.ilike(search_pattern)
                        )
                    )
                
                # Pagination
                offset = (page - 1) * page_size
                query = query.offset(offset).limit(page_size)
                
                result = await session.execute(query)
                users = result.scalars().all()
                
                users_data = []
                for user in users:
                    # Get user's role (should be only 1: ADMIN or USER)
                    role_result = await session.execute(
                        select(Role.name).join(UserRole).where(UserRole.user_id == user.id)
                    )
                    role = role_result.scalar_one_or_none() or "USER"
                    
                    # Count user's data access rules
                    access_count_result = await session.execute(
                        select(func.count()).select_from(UserDataAccess).where(
                            UserDataAccess.user_id == user.id
                        )
                    )
                    access_rule_count = access_count_result.scalar() or 0
                    
                    users_data.append({
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "role": role,
                        "access_rule_count": access_rule_count,
                        "created_at": user.created_at.isoformat()
                    })
                
                # Get total count
                count_query = select(func.count()).select_from(User).where(User.is_active == True)
                if search:
                    search_pattern = f"%{search}%"
                    count_query = count_query.where(
                        or_(
                            User.username.ilike(search_pattern),
                            User.email.ilike(search_pattern),
                            User.full_name.ilike(search_pattern)
                        )
                    )
                total_result = await session.execute(count_query)
                total = total_result.scalar()
                
                return {
                    "success": True,
                    "users": users_data,
                    "total": total,
                    "page": page,
                    "page_size": page_size
                }
                
            except Exception as e:
                self.logger.error("Failed to list users", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def create_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: str = "USER",
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new user with specified role (ADMIN or USER)."""
        async with db_manager.get_session() as session:
            try:
                # Check if user exists
                existing = await session.execute(
                    select(User).where(
                        or_(User.username == username, User.email == email)
                    )
                )
                if existing.scalar_one_or_none():
                    return {"success": False, "error": "User already exists"}
                
                # Create user
                password_hash = get_password_hash(password)
                new_user = User(
                    username=username,
                    email=email,
                    password_hash=password_hash,
                    full_name=full_name,
                    is_active=True
                )
                session.add(new_user)
                await session.flush()
                
                # Assign role (default to USER)
                role_name = role.upper() if role.upper() in ["ADMIN", "USER"] else "USER"
                role_result = await session.execute(
                    select(Role).where(Role.name == role_name)
                )
                role_obj = role_result.scalar_one_or_none()
                
                if role_obj:
                    user_role = UserRole(user_id=new_user.id, role_id=role_obj.id)
                    session.add(user_role)
                
                await session.commit()
                
                self.logger.info("User created", user_id=str(new_user.id), username=username, role=role_name, created_by=admin_id)
                
                return {
                    "success": True,
                    "user": {
                        "id": str(new_user.id),
                        "username": new_user.username,
                        "email": new_user.email,
                        "full_name": new_user.full_name,
                        "role": role_name
                    }
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to create user", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def set_user_role(
        self,
        user_id: str,
        role: str,
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Set user's role (ADMIN or USER). Can only have ONE role."""
        async with db_manager.get_session() as session:
            try:
                # Validate role
                role_name = role.upper() if role.upper() in ["ADMIN", "USER"] else "USER"
                
                # Get role ID
                role_result = await session.execute(
                    select(Role).where(Role.name == role_name)
                )
                role_obj = role_result.scalar_one_or_none()
                
                if not role_obj:
                    return {"success": False, "error": f"Role {role_name} not found"}
                
                # Remove all existing roles for this user
                await session.execute(
                    delete(UserRole).where(UserRole.user_id == uuid.UUID(user_id))
                )
                
                # Assign new role
                user_role = UserRole(user_id=uuid.UUID(user_id), role_id=role_obj.id)
                session.add(user_role)
                await session.commit()
                
                self.logger.info("User role updated", user_id=user_id, new_role=role_name, updated_by=admin_id)
                
                return {"success": True, "role": role_name}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to set user role", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}
    
    async def deactivate_user(
        self,
        user_id: str,
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deactivate a user."""
        async with db_manager.get_session() as session:
            try:
                await session.execute(
                    update(User)
                    .where(User.id == uuid.UUID(user_id))
                    .values(is_active=False)
                )
                await session.commit()
                
                self.logger.info("User deactivated", user_id=user_id, deactivated_by=admin_id)
                
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to deactivate user", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}
    
    # =========================================================================
    # USER DATA ACCESS MANAGEMENT (DIRECT USER-LEVEL)
    # =========================================================================
    
    async def get_user_data_access(
        self,
        user_id: str
    ) -> Dict[str, Any]:
        """Get all data access rules for a user."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(UserDataAccess).where(UserDataAccess.user_id == uuid.UUID(user_id))
                )
                access_rules = result.scalars().all()
                
                rules_data = []
                for rule in access_rules:
                    rules_data.append({
                        "id": str(rule.id),
                        "catalog": rule.catalog,
                        "database_name": rule.database_name,
                        "schema_name": rule.schema_name,
                        "table_name": rule.table_name,
                        "allowed_columns": rule.allowed_columns,
                        "can_query": rule.can_query,
                        "is_visible": rule.is_visible,
                        "created_at": rule.created_at.isoformat()
                    })
                
                return {"success": True, "rules": rules_data}
                
            except Exception as e:
                self.logger.error("Failed to get user data access", user_id=user_id, error=str(e))
                return {"success": False, "error": str(e)}
    
    async def add_user_data_access(
        self,
        user_id: str,
        catalog: Optional[str],
        database_name: Optional[str],
        schema_name: Optional[str],
        table_name: Optional[str],
        allowed_columns: Optional[List[str]] = None,
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a data access rule for a user."""
        async with db_manager.get_session() as session:
            try:
                # Check if rule already exists
                existing = await session.execute(
                    select(UserDataAccess).where(
                        and_(
                            UserDataAccess.user_id == uuid.UUID(user_id),
                            UserDataAccess.catalog == catalog,
                            UserDataAccess.database_name == database_name,
                            UserDataAccess.schema_name == schema_name,
                            UserDataAccess.table_name == table_name
                        )
                    )
                )
                
                if existing.scalar_one_or_none():
                    return {"success": False, "error": "Access rule already exists"}
                
                access_rule = UserDataAccess(
                    user_id=uuid.UUID(user_id),
                    catalog=catalog,
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name,
                    allowed_columns=allowed_columns,
                    can_query=True,
                    is_visible=True,
                    created_by=uuid.UUID(admin_id) if admin_id else None
                )
                session.add(access_rule)
                await session.commit()
                
                self.logger.info("User data access added", user_id=user_id, rule_id=str(access_rule.id), added_by=admin_id)
                
                return {"success": True, "rule_id": str(access_rule.id)}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to add user data access", error=str(e))
                return {"success": False, "error": str(e)}
    
    async def remove_user_data_access(
        self,
        rule_id: str,
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Remove a data access rule."""
        async with db_manager.get_session() as session:
            try:
                await session.execute(
                    delete(UserDataAccess).where(UserDataAccess.id == uuid.UUID(rule_id))
                )
                await session.commit()
                
                self.logger.info("User data access removed", rule_id=rule_id, removed_by=admin_id)
                
                return {"success": True}
                
            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to remove user data access", error=str(e))
                return {"success": False, "error": str(e)}
    
    # =========================================================================
    # ACCESS CONTROL CHECK
    # =========================================================================
    
    async def check_user_access(
        self,
        user_id: str,
        catalog: str,
        schema: str,
        table: str
    ) -> Dict[str, Any]:
        """
        Check if a user has access to query a specific table.
        - ADMIN role users have full access (no restrictions)
        - USER role users get access through direct user_data_access rules
        
        Trino naming: catalog.schema.table
        Access rules stored in database with database_name = catalog (e.g., "tpch", "postgres")
        """
        async with db_manager.get_session() as session:
            try:
                from uuid import UUID
                user_uuid = UUID(user_id)
                
                # Check if user has ADMIN role - admins have full access
                admin_role_query = select(Role).where(Role.name == 'ADMIN')
                admin_role_result = await session.execute(admin_role_query)
                admin_role = admin_role_result.scalar_one_or_none()
                
                if admin_role:
                    user_role_query = select(UserRole).where(
                        and_(
                            UserRole.user_id == user_uuid,
                            UserRole.role_id == admin_role.id
                        )
                    )
                    user_role_result = await session.execute(user_role_query)
                    if user_role_result.scalar_one_or_none():
                        # User is an admin - grant full access
                        self.logger.info("RBAC: ADMIN user granted access", user_id=user_id, table=f"{catalog}.{schema}.{table}")
                        return {"has_access": True, "reason": "ADMIN role has full access"}
                
                # Check direct user data access rules
                # Rules are hierarchical (Trino naming: catalog.schema.table):
                # - NULL database_name = access to all catalogs
                # - database_name (catalog) + NULL schema_name = access to entire catalog
                # - database_name (catalog) + schema_name + NULL table_name = access to entire schema
                # - database_name (catalog) + schema_name + table_name = access to specific table
                
                access_query = select(UserDataAccess).where(
                    and_(
                        UserDataAccess.user_id == user_uuid,
                        UserDataAccess.can_query == True,
                        # Match catalog (stored as database_name) - NULL = all catalogs
                        or_(
                            UserDataAccess.database_name == catalog,
                            UserDataAccess.database_name.is_(None)
                        )
                    )
                )
                
                access_rules_result = await session.execute(access_query)
                access_rules = access_rules_result.scalars().all()
                
                for rule in access_rules:
                    # Check hierarchical access
                    if rule.database_name is None:
                        # Access to all catalogs
                        self.logger.info("RBAC: Access granted via wildcard catalog rule", user_id=user_id, rule_id=str(rule.id))
                        return {"has_access": True, "rule_id": str(rule.id)}
                    
                    if rule.database_name == catalog:
                        if rule.schema_name is None:
                            # Access to entire catalog
                            self.logger.info("RBAC: Access granted via catalog rule", user_id=user_id, catalog=catalog, rule_id=str(rule.id))
                            return {"has_access": True, "rule_id": str(rule.id)}
                        
                        if rule.schema_name == schema:
                            if rule.table_name is None:
                                # Access to entire schema
                                self.logger.info("RBAC: Access granted via schema rule", user_id=user_id, schema=f"{catalog}.{schema}", rule_id=str(rule.id))
                                return {"has_access": True, "rule_id": str(rule.id)}
                            
                            if rule.table_name == table:
                                # Access to specific table
                                self.logger.info("RBAC: Access granted via table rule", user_id=user_id, table=f"{catalog}.{schema}.{table}", rule_id=str(rule.id))
                                return {"has_access": True, "rule_id": str(rule.id)}
                
                # No matching rules found
                self.logger.warning("RBAC: Access denied - no matching rules", user_id=user_id, table=f"{catalog}.{schema}.{table}")
                return {"has_access": False, "reason": "No matching access rules"}
                
            except Exception as e:
                self.logger.error("Failed to check user access", error=str(e), user_id=user_id, table=f"{catalog}.{schema}.{table}")
                return {"has_access": False, "reason": str(e)}
    
    # =========================================================================
    # ROLES
    # =========================================================================
    
    async def list_roles(self) -> Dict[str, Any]:
        """List all roles (should be only ADMIN and USER)."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(select(Role))
                roles = result.scalars().all()
                
                roles_data = [{
                    "id": str(r.id),
                    "name": r.name,
                    "description": r.description
                } for r in roles]
                
                return {"success": True, "roles": roles_data}
                
            except Exception as e:
                self.logger.error("Failed to list roles", error=str(e))
                return {"success": False, "error": str(e)}


# Global admin service instance
admin_service = AdminService()
