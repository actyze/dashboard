from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import db_manager, User
from app.auth.utils import SECRET_KEY, ALGORITHM, decode_access_token
from app.services.user_service import UserService
import uuid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
user_service = UserService()

async def get_current_user(token: str = Depends(oauth2_scheme)):
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
    # We could use the payload data for stateless auth, but DB check is safer for "is_active"
    user_result = await user_service.get_user(user_id)
    if not user_result.get("success"):
        raise credentials_exception
        
    user_data = user_result.get("user")
    if not user_data.get("is_active"):
        raise HTTPException(status_code=400, detail="Inactive user")
        
    # Inject roles/groups from payload or fetch fresh?
    # Fetching fresh ensures immediate revocation effect
    async with db_manager.get_session() as session:
        user_uuid = uuid.UUID(user_id)
        roles = await user_service.get_user_roles(user_uuid, session)
        groups = await user_service.get_user_groups(user_uuid, session)
        
    return {
        "id": user_id,
        "username": user_data["username"],
        "email": user_data["email"],
        "roles": roles,
        "groups": groups
    }

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
require_admin = RoleChecker(["ADMIN"])
require_editor = RoleChecker(["ADMIN", "EDITOR"])
require_viewer = RoleChecker(["ADMIN", "EDITOR", "VIEWER"])

