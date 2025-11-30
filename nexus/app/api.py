from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.orchestration_service import orchestration_service
from app.services.user_service import UserService
from app.auth.dependencies import get_current_user, require_viewer, require_editor, require_admin

router = APIRouter(prefix="/api", tags=["REST API"])
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

user_service = UserService()

class GenerateSQLRequest(BaseModel):
    nl_query: str
    conversation_history: Optional[List[str]] = []
    session_id: Optional[str] = None

class ExecuteSQLRequest(BaseModel):
    sql: str
    max_results: Optional[int] = 100
    timeout_seconds: Optional[int] = 30
    nl_query: Optional[str] = None
    conversation_history: Optional[List[str]] = []

class QueryRequest(BaseModel):
    input: str
    type: str = 'auto' # 'auto' (NL) or 'sql'
    includeChart: Optional[bool] = False
    chartType: Optional[str] = None
    conversation_history: Optional[List[str]] = []

# =============================================================================
# Authentication Endpoints
# =============================================================================

@auth_router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    result = await user_service.authenticate_user(form_data.username, form_data.password)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result

@auth_router.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user details."""
    return current_user

# =============================================================================
# Protected Query Endpoints
# =============================================================================

@router.post("/generate-sql")
async def generate_sql(
    request: GenerateSQLRequest,
    current_user: dict = Depends(require_viewer)
):
    """Generate SQL from natural language without executing it."""
    # We can pass user_id for logging if orchestration service supports it
    result = await orchestration_service.generate_sql_from_nl(
        request.nl_query, 
        request.conversation_history
    )
    return result

@router.post("/execute-sql")
async def execute_sql(
    request: ExecuteSQLRequest,
    current_user: dict = Depends(require_viewer)
):
    """Execute raw SQL query directly."""
    result = await orchestration_service.execute_sql_directly(
        request.sql,
        request.max_results,
        request.timeout_seconds,
        request.nl_query,
        request.conversation_history
    )
    return result

@router.post("/query")
async def query(
    request: QueryRequest,
    current_user: dict = Depends(require_viewer)
):
    """
    Unified endpoint for query execution.
    Supports both raw SQL execution and Natural Language processing.
    """
    # Pass user context to workflow if needed
    user_id = current_user.get("id")
    
    if request.type == 'sql':
        result = await orchestration_service.execute_sql_directly(request.input)
        return result
    elif request.type == 'auto':
        result = await orchestration_service.process_natural_language_workflow(
            nl_query=request.input,
            conversation_history=request.conversation_history,
            include_chart=request.includeChart,
            chart_type=request.chartType,
            user_id=None, # Can pass user_id converted to int if service expects it, but currently service uses int IDs
            session_id=None 
        )
        return result
    else:
        raise HTTPException(status_code=400, detail="Invalid query type. Use 'sql' or 'auto'.")
