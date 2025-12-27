"""Simplified Admin API - 2 roles (ADMIN/USER), group-level data access."""

import structlog
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from app.services.admin_service import admin_service
from app.auth.dependencies import get_current_user, require_admin

logger = structlog.get_logger()

admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: str = "USER"  # "ADMIN" or "USER"

class UserRoleUpdate(BaseModel):
    role: str  # "ADMIN" or "USER"

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class GroupMemberAdd(BaseModel):
    user_id: str

class GroupDataAccessCreate(BaseModel):
    catalog: Optional[str] = None
    database_name: Optional[str] = None
    schema_name: Optional[str] = None
    table_name: Optional[str] = None
    allowed_columns: Optional[List[str]] = None

# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

@admin_router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    List all users with their roles and groups.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.list_users(page=page, page_size=page_size, search=search)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.post("/users")
async def create_user(
    data: UserCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Create a new user.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.create_user(
        username=data.username,
        email=data.email,
        password=data.password,
        full_name=data.full_name,
        role=data.role,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.put("/users/{user_id}/role")
async def set_user_role(
    user_id: str,
    data: UserRoleUpdate,
    current_user: dict = Depends(require_admin)
):
    """
    Set user's role (ADMIN or USER).
    
    **Requires:** ADMIN role (only super_admin can make other users ADMIN)
    """
    # Check if current user is super admin (nexus_admin)
    if data.role.upper() == "ADMIN":
        # Only nexus_admin can promote to ADMIN
        user_result = await admin_service.list_users(page=1, page_size=1, search=current_user["username"])
        if user_result["success"] and user_result["users"]:
            current_user_data = user_result["users"][0]
            if current_user_data["username"] != "nexus_admin":
                raise HTTPException(status_code=403, detail="Only super admin can promote users to ADMIN")
    
    result = await admin_service.set_user_role(
        user_id=user_id,
        role=data.role,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Deactivate a user.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.deactivate_user(
        user_id=user_id,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ============================================================================
# GROUP MANAGEMENT ENDPOINTS
# ============================================================================

@admin_router.get("/groups")
async def list_groups(current_user: dict = Depends(require_admin)):
    """
    List all groups with member counts.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.list_groups()
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.post("/groups")
async def create_group(
    data: GroupCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Create a new group.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.create_group(
        name=data.name,
        description=data.description,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.post("/groups/{group_id}/members")
async def add_group_member(
    group_id: str,
    data: GroupMemberAdd,
    current_user: dict = Depends(require_admin)
):
    """
    Add a user to a group.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.add_user_to_group(
        group_id=group_id,
        user_id=data.user_id,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Remove a user from a group.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.remove_user_from_group(
        group_id=group_id,
        user_id=user_id,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ============================================================================
# DATA ACCESS MANAGEMENT ENDPOINTS (GROUP-LEVEL)
# ============================================================================

@admin_router.get("/groups/{group_id}/access")
async def get_group_data_access(
    group_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Get all data access rules for a group.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.get_group_data_access(group_id=group_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.post("/groups/{group_id}/access")
async def add_group_data_access(
    group_id: str,
    data: GroupDataAccessCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Add a data access rule for a group.
    
    Admin selects: catalog, database, schema, table, columns (optional)
    NULL values mean "all" (wildcard).
    
    **Requires:** ADMIN role
    """
    result = await admin_service.set_group_data_access(
        group_id=group_id,
        catalog=data.catalog,
        database_name=data.database_name,
        schema_name=data.schema_name,
        table_name=data.table_name,
        allowed_columns=data.allowed_columns,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.delete("/groups/access/{rule_id}")
async def remove_group_data_access(
    rule_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Remove a data access rule.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.remove_group_data_access(
        rule_id=rule_id,
        admin_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ============================================================================
# ROLES ENDPOINTS (for dropdown lists)
# ============================================================================

@admin_router.get("/roles")
async def list_roles(current_user: dict = Depends(require_admin)):
    """
    List all roles (ADMIN and USER).
    
    **Requires:** ADMIN role
    """
    result = await admin_service.list_roles()
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

