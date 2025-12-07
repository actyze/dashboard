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
    session_id: Optional[str] = None
    chart_recommendation: Optional[dict] = None
    model_reasoning: Optional[str] = None
    schema_recommendations: Optional[List[dict]] = None
    llm_response_time_ms: Optional[int] = None

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
    """Execute raw SQL query directly and save to query history."""
    from datetime import datetime
    import asyncio
    
    user_id = current_user.get("id")
    session_id = request.session_id if hasattr(request, 'session_id') and request.session_id else f"session-{datetime.utcnow().timestamp()}"
    
    # Track execution time
    execution_start = asyncio.get_event_loop().time()
    
    # Execute SQL
    result = await orchestration_service.execute_sql_directly(
        request.sql,
        request.max_results,
        request.timeout_seconds,
        request.nl_query,
        request.conversation_history
    )
    
    execution_end = asyncio.get_event_loop().time()
    execution_time_ms = int((execution_end - execution_start) * 1000)
    
    # Save to query history (fire and forget - don't block response)
    try:
        # Determine query type based on whether NL query was provided
        query_type = 'natural_language' if request.nl_query else 'manual'
        
        # Save query execution to history
        asyncio.create_task(
            user_service.save_query_execution(
                user_id=user_id,
                session_id=session_id,
                natural_language_query=request.nl_query or request.sql,
                generated_sql=request.sql,
                execution_status="success" if result.get("success") else "error",
                execution_time_ms=execution_time_ms,
                row_count=result.get("query_results", {}).get("row_count") if result.get("query_results") else None,
                error_message=result.get("error"),
                schema_recommendations={"recommendations": request.schema_recommendations} if request.schema_recommendations else None,
                model_confidence=0.85 if request.chart_recommendation else None,  # Default confidence if LLM was used
                retry_attempts=0,
                query_type=query_type,
                chart_recommendation=request.chart_recommendation,
                llm_response_time_ms=request.llm_response_time_ms,
                generated_at=datetime.fromtimestamp(execution_start),
                executed_at=datetime.fromtimestamp(execution_end)
            )
        )
    except Exception as e:
        # Log but don't fail the request if history save fails
        logger = orchestration_service.logger
        logger.warning("Failed to save query history", error=str(e), user_id=user_id)
    
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
# Query History Endpoints (Tab 1: Recent Queries)
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
    """Get query execution history for the current user (Recent Queries tab)."""
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
async def update_query_history_name(
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

@router.delete("/query-history/{query_id}")
async def delete_query_history(
    query_id: int,
    current_user: dict = Depends(require_viewer)
):
    """Delete a query from history."""
    user_id = current_user.get("id")
    result = await user_service.delete_query_history(
        query_id=query_id,
        user_id=user_id
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
# Saved Queries Endpoints (Tab 2: Saved Queries)
# =============================================================================

class CreateSavedQueryRequest(BaseModel):
    query_name: str
    natural_language_query: str
    generated_sql: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    chart_recommendation: Optional[Dict[str, Any]] = None
    created_from_history_id: Optional[int] = None

class UpdateSavedQueryRequest(BaseModel):
    query_name: Optional[str] = None
    description: Optional[str] = None
    natural_language_query: Optional[str] = None
    generated_sql: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None

class SaveFromHistoryRequest(BaseModel):
    query_name: str
    description: Optional[str] = None

@router.get("/saved-queries")
async def get_saved_queries(
    limit: int = 50,
    offset: int = 0,
    favorites_only: bool = False,
    current_user: dict = Depends(require_viewer)
):
    """Get saved queries for the current user (Saved Queries tab)."""
    user_id = current_user.get("id")
    result = await user_service.get_saved_queries(
        user_id=user_id,
        limit=limit,
        offset=offset,
        favorites_only=favorites_only
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.get("/saved-queries/{query_id}")
async def get_saved_query(
    query_id: int,
    current_user: dict = Depends(require_viewer)
):
    """Get a specific saved query."""
    user_id = current_user.get("id")
    result = await user_service.get_saved_query(
        query_id=query_id,
        user_id=user_id
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.post("/saved-queries")
async def create_saved_query(
    request: CreateSavedQueryRequest,
    current_user: dict = Depends(require_viewer)
):
    """Create a new saved query."""
    user_id = current_user.get("id")
    result = await user_service.create_saved_query(
        user_id=user_id,
        query_name=request.query_name,
        natural_language_query=request.natural_language_query,
        generated_sql=request.generated_sql,
        description=request.description,
        tags=request.tags,
        chart_recommendation=request.chart_recommendation,
        created_from_history_id=request.created_from_history_id
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.put("/saved-queries/{query_id}")
async def update_saved_query(
    query_id: int,
    request: UpdateSavedQueryRequest,
    current_user: dict = Depends(require_viewer)
):
    """Update a saved query."""
    user_id = current_user.get("id")
    result = await user_service.update_saved_query(
        query_id=query_id,
        user_id=user_id,
        query_name=request.query_name,
        description=request.description,
        natural_language_query=request.natural_language_query,
        generated_sql=request.generated_sql,
        is_favorite=request.is_favorite,
        tags=request.tags
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.delete("/saved-queries/{query_id}")
async def delete_saved_query(
    query_id: int,
    current_user: dict = Depends(require_viewer)
):
    """Delete a saved query."""
    user_id = current_user.get("id")
    result = await user_service.delete_saved_query(
        query_id=query_id,
        user_id=user_id
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.post("/saved-queries/from-history/{history_id}")
async def save_query_from_history(
    history_id: int,
    request: SaveFromHistoryRequest,
    current_user: dict = Depends(require_viewer)
):
    """Save a query from history to saved queries."""
    user_id = current_user.get("id")
    result = await user_service.save_query_from_history(
        user_id=user_id,
        history_id=history_id,
        query_name=request.query_name,
        description=request.description
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
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
