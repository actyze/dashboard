"""Simplified Admin API - 2 roles (ADMIN/USER), direct user-level data access."""

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
    role: str = "USER"  # "ADMIN", "USER", or "READONLY"

class UserRoleUpdate(BaseModel):
    role: str  # "ADMIN", "USER", or "READONLY"

class UserDataAccessCreate(BaseModel):
    """Create a data access rule for a user."""
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
    List all users with their roles.
    
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
    
    **Requires:** ADMIN role (any admin can promote users to ADMIN)
    """
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
# USER DATA ACCESS MANAGEMENT ENDPOINTS
# ============================================================================

@admin_router.get("/users/{user_id}/access")
async def get_user_data_access(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Get all data access rules for a user.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.get_user_data_access(user_id=user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@admin_router.post("/users/{user_id}/access")
async def add_user_data_access(
    user_id: str,
    data: UserDataAccessCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Add a data access rule for a user.
    
    Admin selects: catalog, database, schema, table, columns (optional)
    NULL values mean "all" (wildcard).
    
    Examples:
    - {catalog: null, database_name: null} → Full access to everything
    - {database_name: "tpch"} → Access to entire tpch database
    - {database_name: "tpch", schema_name: "sf1"} → Access to tpch.sf1 schema
    - {database_name: "tpch", schema_name: "sf1", table_name: "orders"} → Access to specific table
    
    **Requires:** ADMIN role
    """
    result = await admin_service.add_user_data_access(
        user_id=user_id,
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

@admin_router.delete("/users/{user_id}/access/{rule_id}")
async def remove_user_data_access(
    user_id: str,
    rule_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Remove a data access rule from a user.
    
    **Requires:** ADMIN role
    """
    result = await admin_service.remove_user_data_access(
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
