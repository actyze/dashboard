import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional

# OAuth2 scheme for Swagger UI support
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Configuration - Should match Nexus service config
SECRET_KEY = os.getenv("JWT_SECRET", "unsafe-secret-key-change-me")
ALGORITHM = "HS256"

def verify_service_token(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Verifies a JWT token sent by another service (like Nexus).
    Uses a shared secret key pattern for simplicity in this architecture.
    """
    if not token:
        # For now, allowing unauthenticated access if token is missing during transition
        # In production strict mode, this should raise HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        # return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Basic validation - could check for specific "service" scope or "iss" claim
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_auth(token: str = Depends(oauth2_scheme)):
    """Dependency to enforce authentication."""
    if not token:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_service_token(token)

