from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import bcrypt
from app.config import settings

# JWT Configuration
SECRET_KEY = settings.jwt_secret or settings.secret_key or "unsafe-secret-key-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.jwt_expiration // 60 if settings.jwt_expiration else 60

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password using bcrypt directly."""
    try:
        # Ensure bytes
        password_bytes = plain_password.encode('utf-8')
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def should_refresh_token(payload: Dict[str, Any], threshold_minutes: int = 15) -> bool:
    """
    Check if token should be refreshed based on remaining time.
    
    Args:
        payload: Decoded JWT payload
        threshold_minutes: Refresh if less than this many minutes remain (default: 15)
    
    Returns:
        True if token should be refreshed, False otherwise
    
    Example:
        Token expires at 12:00 PM
        Current time is 11:50 AM (10 minutes left)
        threshold_minutes = 15
        → Returns True (refresh needed)
    """
    exp = payload.get("exp")
    if not exp:
        return False
    
    # Calculate time remaining until expiration
    expiration_time = datetime.utcfromtimestamp(exp)
    time_remaining = expiration_time - datetime.utcnow()
    
    # Refresh if less than threshold minutes remain
    return time_remaining < timedelta(minutes=threshold_minutes)

