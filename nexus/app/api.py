from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.orchestration_service import orchestration_service
from app.services.user_service import UserService
from app.services.schema_service import SchemaService
from app.auth.dependencies import get_current_user, require_viewer, require_editor, require_admin

router = APIRouter(prefix="/api", tags=["REST API"])
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
explorer_router = APIRouter(prefix="/api/explorer", tags=["Schema Explorer"])

user_service = UserService()
schema_service_client = SchemaService()

class GenerateSQLRequest(BaseModel):
    nl_query: str
    conversation_history: Optional[List[str]] = []
    session_id: Optional[str] = None

class ExecuteSQLRequest(BaseModel):
    sql: str
    max_results: Optional[int] = 500
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

class ChartRequest(BaseModel):
    nl_query: str
    sql: str
    schema_context: Optional[Dict[str, Any]] = None
    row_count: Optional[int] = None
    is_limited: Optional[bool] = False

@router.post("/generate-chart")
async def generate_chart(
    request: ChartRequest,
    current_user: dict = Depends(require_viewer)
):
    """Generate chart configuration and aggregated data asynchronously."""
    result = await orchestration_service.generate_chart_data(
        request.nl_query,
        request.sql,
        request.schema_context,
        request.row_count,
        request.is_limited
    )
    return result

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

# =============================================================================
# Query History Endpoints
# =============================================================================

class UpdateQueryNameRequest(BaseModel):
    query_name: str

@router.get("/query-history")
async def get_query_history(
    limit: int = 50,
    offset: int = 0,
    query_type: Optional[str] = None,
    current_user: dict = Depends(require_viewer)
):
    """Get query execution history for the current user."""
    user_id = current_user.get("id")
    result = await user_service.get_query_history(
        user_id=user_id,
        limit=limit,
        offset=offset,
        query_type=query_type
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.patch("/query-history/{query_id}/name")
async def update_query_name(
    query_id: int,
    request: UpdateQueryNameRequest,
    current_user: dict = Depends(require_viewer)
):
    """Update the name of a query in history."""
    user_id = current_user.get("id")
    result = await user_service.update_query_name(
        query_id=query_id,
        user_id=user_id,
        query_name=request.query_name
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.post("/query-history/manual")
async def save_manual_query(
    request: ExecuteSQLRequest,
    current_user: dict = Depends(require_viewer)
):
    """Execute and save a manual SQL query to history."""
    from datetime import datetime
    
    # Execute the SQL
    result = await orchestration_service.execute_sql_directly(
        request.sql,
        request.max_results,
        request.timeout_seconds
    )
    
    # Save to history
    user_id = current_user.get("id")
    session_id = f"manual-{datetime.utcnow().timestamp()}"
    
    await user_service.save_query_execution(
        user_id=user_id,
        session_id=session_id,
        natural_language_query="",  # Empty for manual queries
        generated_sql=request.sql,
        execution_status="success" if result.get("success") else "error",
        execution_time_ms=int(result.get("execution_time", 0) or 0),
        row_count=result.get("query_results", {}).get("row_count") if result.get("query_results") else None,
        error_message=result.get("error"),
        query_type='manual',
        generated_at=datetime.utcnow(),
        executed_at=datetime.utcnow()
    )
    
    return result

# =============================================================================
# Explorer Endpoints
# =============================================================================

@explorer_router.get("/databases")
async def get_databases(current_user: dict = Depends(require_viewer)):
    """Get list of all databases."""
    return await schema_service_client.get_databases()

@explorer_router.get("/databases/{database}/schemas")
async def get_database_schemas(database: str, current_user: dict = Depends(require_viewer)):
    """Get schemas for a database."""
    return await schema_service_client.get_database_schemas(database)

@explorer_router.get("/databases/{database}/schemas/{schema}/objects")
async def get_schema_objects(database: str, schema: str, current_user: dict = Depends(require_viewer)):
    """Get objects (tables/views) for a schema."""
    return await schema_service_client.get_schema_objects(database, schema)

@explorer_router.get("/databases/{database}/schemas/{schema}/tables/{table}")
async def get_table_details(database: str, schema: str, table: str, current_user: dict = Depends(require_viewer)):
    """Get detailed information about a specific table."""
    return await schema_service_client.get_table_details(database, schema, table)

@explorer_router.get("/search")
async def search_objects(
    query: str, 
    database: Optional[str] = None,
    schema: Optional[str] = None,
    object_type: Optional[str] = None,
    current_user: dict = Depends(require_viewer)
):
    """Search for database objects."""
    return await schema_service_client.search_database_objects(query, database, schema, object_type)
