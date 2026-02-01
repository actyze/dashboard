from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import db_manager, User
from app.auth.utils import SECRET_KEY, ALGORITHM, decode_access_token, create_access_token, should_refresh_token
from app.services.user_service import UserService
import uuid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
user_service = UserService()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    request: Request = None,
    response: Response = None
):
    """
    Get current user from JWT token with sliding session support.
    
    If token is valid but near expiry (< 15 minutes), automatically issue
    a new token to extend the session (sliding session behavior).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Fetch user from DB to ensure valid and active
    user_result = await user_service.get_user(user_id)
    if not user_result.get("success"):
        raise credentials_exception
        
    user_data = user_result.get("user")
    
    # Check if user is active
    if not user_data.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
        
    # Fetch fresh roles to ensure immediate revocation effect
    async with db_manager.get_session() as session:
        user_uuid = uuid.UUID(user_id)
        roles = await user_service.get_user_roles(user_uuid, session)
    
    user_info = {
        "id": user_id,
        "username": user_data["username"],
        "email": user_data["email"],
        "roles": roles
    }
    
    # ═══════════════════════════════════════════════
    # SLIDING SESSION: Refresh token if near expiry
    # ═══════════════════════════════════════════════
    if response and should_refresh_token(payload):
        # Issue new token with fresh expiration
        new_token_data = {
            "sub": str(user_id),
            "username": user_data["username"],
            "roles": roles
        }
        new_token = create_access_token(new_token_data)
        
        # Return new token in response header (frontend will intercept)
        response.headers["X-New-Token"] = new_token
        
        # Also set a flag so frontend knows to update
        response.headers["X-Token-Refreshed"] = "true"
    
    return user_info

async def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    """
    Helper dependency to extract just the user ID (UUID) from the current user.
    
    Used by endpoints that only need the user ID (e.g., file uploads).
    
    Note: Returns UUID string as stored in the database.
    """
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token"
        )
    return user_id

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Depends(get_current_user)):
        user_roles = user.get("roles", [])
        # Check if user has ANY of the allowed roles
        if not any(role in self.allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return user

# Pre-configured dependencies
# System uses 3 roles:
# - ADMIN: Full access (user management, license management, schema visibility)
# - USER: Regular access (can create/edit/delete dashboards, upload CSVs, query data)
# - READONLY: View-only access (can only view data intelligence, no create/edit/delete/upload)
require_admin = RoleChecker(["ADMIN"])
require_editor = RoleChecker(["ADMIN", "USER"])  # READONLY cannot edit
require_viewer = RoleChecker(["ADMIN", "USER", "READONLY"])  # All can view

