from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.orchestration_service import orchestration_service
from app.services.user_service import UserService
from app.services.schema_service import SchemaService
from app.services.dashboard_service import dashboard_service
from app.auth.dependencies import get_current_user, require_viewer, require_editor, require_admin

router = APIRouter(prefix="/api", tags=["REST API"])
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
explorer_router = APIRouter(prefix="/api/explorer", tags=["Schema Explorer"])
dashboard_router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])
public_router = APIRouter(prefix="/api/public", tags=["Public Access (No Auth)"])

user_service = UserService()
schema_service_client = SchemaService()

class GenerateSQLRequest(BaseModel):
    nl_query: str
    conversation_history: Optional[List[str]] = []
    session_id: Optional[str] = None
    last_sql: Optional[str] = None  # For intent-aware schema reuse
    last_schema_recommendations: Optional[List[dict]] = None  # For intent-aware schema reuse

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
    """Generate SQL from natural language without executing it (with ML-based intent detection)."""
    result = await orchestration_service.generate_sql_from_nl(
        request.nl_query, 
        request.conversation_history,
        session_id=request.session_id,
        last_sql=request.last_sql,
        last_schema_recommendations=request.last_schema_recommendations
    )
    return result

@router.post("/execute-sql")
async def execute_sql(
    request: ExecuteSQLRequest,
    current_user: dict = Depends(require_viewer)
):
    """Execute raw SQL query directly with data access control check."""
    from datetime import datetime
    import asyncio
    from app.utils.sql_parser import extract_tables_from_sql, is_select_query
    from app.services.admin_service import admin_service
    
    user_id = current_user.get("id")
    session_id = request.session_id if hasattr(request, 'session_id') and request.session_id else f"session-{datetime.utcnow().timestamp()}"
    
    # Analytics platform: Only SELECT queries allowed
    if not is_select_query(request.sql):
        raise HTTPException(
            status_code=403,
            detail="Only SELECT queries are allowed. This is an analytics platform with read-only access."
        )
    
    # Check data access permissions for all tables in the query
    tables = extract_tables_from_sql(request.sql)
    access_denied_tables = []
    
    for table in tables:
        access_check = await admin_service.check_user_access(
            user_id=user_id,
            catalog=table["catalog"],
            database=table["database"],
            schema=table["schema"],
            table=table["table"]
        )
        
        if not access_check.get("has_access", False):
            access_denied_tables.append(f"{table['catalog']}.{table['database']}.{table['schema']}.{table['table']}")
    
    if access_denied_tables:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied to the following tables: {', '.join(access_denied_tables)}"
        )
    
    # Track execution time and timestamps
    generated_at = datetime.utcnow()
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
    executed_at = datetime.utcnow()
    execution_time_ms = int((execution_end - execution_start) * 1000)
    
    # NO AUTOMATIC SAVE - User must click "Save" or "Save As New" button
    # This removes the confusing hash-based auto-deduplication
    
    return result

# =============================================================================
# Query History Endpoints (Tab 1: Recent Queries)
# =============================================================================

class UpdateQueryNameRequest(BaseModel):
    query_name: str

@router.get("/query-history")
async def get_query_history(
    limit: int = 50,
    offset: int = 0,
    favorites_only: bool = False,
    current_user: dict = Depends(require_viewer)
):
    """Get query execution history for the current user.
    Use favorites_only=true for Favorite Queries tab, false for Recent Queries tab."""
    user_id = current_user.get("id")
    result = await user_service.get_query_history(
        user_id=user_id,
        limit=limit,
        offset=offset,
        favorites_only=favorites_only
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

# Removed: delete_query_history endpoint - queries are user-controlled now

class SaveQueryRequest(BaseModel):
    generated_sql: str
    query_name: Optional[str] = None
    natural_language_query: Optional[str] = None
    chart_recommendation: Optional[Dict[str, Any]] = None
    execution_status: Optional[str] = "SUCCESS"
    execution_time_ms: Optional[int] = None
    row_count: Optional[int] = None

class UpdateQueryRequest(BaseModel):
    generated_sql: Optional[str] = None
    query_name: Optional[str] = None
    natural_language_query: Optional[str] = None
    chart_recommendation: Optional[Dict[str, Any]] = None
    execution_status: Optional[str] = None
    execution_time_ms: Optional[int] = None
    row_count: Optional[int] = None

@router.post("/query-history/save")
async def save_query(
    request: SaveQueryRequest,
    current_user: dict = Depends(require_viewer)
):
    """Save a new query - explicit user action (Save As New button)."""
    user_id = current_user.get("id")
    result = await user_service.save_new_query(
        user_id=user_id,
        generated_sql=request.generated_sql,
        query_name=request.query_name,
        natural_language_query=request.natural_language_query,
        chart_recommendation=request.chart_recommendation,
        execution_status=request.execution_status,
        execution_time_ms=request.execution_time_ms,
        row_count=request.row_count
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.patch("/query-history/{query_id}")
async def update_query_by_id(
    query_id: int,
    request: UpdateQueryRequest,
    current_user: dict = Depends(require_viewer)
):
    """Update an existing query - explicit user action (Save button)."""
    user_id = current_user.get("id")
    result = await user_service.update_query(
        query_id=query_id,
        user_id=user_id,
        generated_sql=request.generated_sql,
        query_name=request.query_name,
        natural_language_query=request.natural_language_query,
        chart_recommendation=request.chart_recommendation,
        execution_status=request.execution_status,
        execution_time_ms=request.execution_time_ms,
        row_count=request.row_count
    )
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.delete("/query-history/{query_id}")
async def delete_query_by_id(
    query_id: int,
    current_user: dict = Depends(require_viewer)
):
    """Delete a saved query."""
    user_id = current_user.get("id")
    result = await user_service.delete_query(query_id=query_id, user_id=user_id)
    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result.get("error"))
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

# =============================================================================
# Favorite Queries Endpoints (Tab 2: Favorite Queries)
# =============================================================================

class CreateFavoriteQueryRequest(BaseModel):
    query_name: str
    natural_language_query: str
    generated_sql: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    chart_recommendation: Optional[Dict[str, Any]] = None
    created_from_history_id: Optional[int] = None

class UpdateFavoriteQueryRequest(BaseModel):
    query_name: Optional[str] = None
    description: Optional[str] = None
    natural_language_query: Optional[str] = None
    generated_sql: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None

class SaveFromHistoryRequest(BaseModel):
    query_name: str
    description: Optional[str] = None

@router.post("/query-history/{query_id}/favorite")
async def toggle_favorite(
    query_id: int,
    query_name: Optional[str] = None,
    current_user: dict = Depends(require_viewer)
):
    """Toggle favorite status for a query history entry. Optionally provide a query_name."""
    user_id = current_user.get("id")
    result = await user_service.toggle_query_favorite(
        query_id=query_id,
        user_id=user_id,
        query_name=query_name
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

# =============================================================================
# Dashboard Endpoints (with RBAC)
# =============================================================================

class CreateDashboardRequest(BaseModel):
    title: str
    description: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    layout_config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    is_public: bool = False

class UpdateDashboardRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    layout_config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_anonymous_public: Optional[bool] = None
    is_favorite: Optional[bool] = None

class CreateTileRequest(BaseModel):
    title: str
    sql_query: str
    chart_type: str
    position_x: int = 0
    position_y: int = 0
    width: int = 6
    height: int = 4
    description: Optional[str] = None
    natural_language_query: Optional[str] = None
    chart_config: Optional[Dict[str, Any]] = None
    refresh_interval_seconds: Optional[int] = None

class UpdateTileRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sql_query: Optional[str] = None
    natural_language_query: Optional[str] = None
    chart_type: Optional[str] = None
    chart_config: Optional[Dict[str, Any]] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    refresh_interval_seconds: Optional[int] = None

class GrantPermissionRequest(BaseModel):
    target_user_id: str  # Required - user to grant permission to
    can_view: bool = True
    can_edit: bool = False
    can_delete: bool = False
    can_share: bool = False
    expires_at: Optional[str] = None  # ISO format datetime

@dashboard_router.get("")
async def list_dashboards(
    include_public: bool = True,
    favorites_only: bool = False,
    current_user: dict = Depends(require_viewer)
):
    """
    Get all dashboards accessible by current user with RBAC verification.
    Returns only dashboards user has permission to view.
    """
    try:
        user_id = current_user.get("id")
        dashboards = await dashboard_service.get_user_dashboards(
            user_id=user_id,
            include_public=include_public,
            favorites_only=favorites_only
        )
        
        return {
            "success": True,
            "dashboards": dashboards,
            "total": len(dashboards)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    include_tiles: bool = False,
    current_user: dict = Depends(require_viewer)
):
    """
    Get dashboard by ID (with permission check).
    
    Args:
        dashboard_id: Dashboard UUID
        include_tiles: If True, includes all tiles in response (default: False)
        current_user: Authenticated user
    
    Returns:
        Dashboard metadata only (if include_tiles=False) or dashboard + tiles (if include_tiles=True)
    """
    try:
        user_id = current_user.get("id")
        dashboard = await dashboard_service.get_dashboard_by_id(dashboard_id, user_id)
        
        if not dashboard:
            raise HTTPException(
                status_code=404, 
                detail="Dashboard not found or access denied"
            )
        
        response = {
            "success": True,
            "dashboard": dashboard
        }
        
        # Optionally include tiles in the same response
        if include_tiles:
            tiles = await dashboard_service.get_dashboard_tiles(dashboard_id, user_id)
            response["tiles"] = tiles
            response["total_tiles"] = len(tiles)
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("")
async def create_dashboard(
    request: CreateDashboardRequest,
    current_user: dict = Depends(require_viewer)
):
    """Create new dashboard."""
    try:
        user_id = current_user.get("id")
        dashboard = await dashboard_service.create_dashboard(
            user_id=user_id,
            title=request.title,
            description=request.description,
            configuration=request.configuration,
            layout_config=request.layout_config,
            tags=request.tags,
            is_public=request.is_public
        )
        
        return {
            "success": True,
            "dashboard": dashboard
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    request: UpdateDashboardRequest,
    current_user: dict = Depends(require_viewer)
):
    """Update dashboard (requires edit permission). Returns updated dashboard."""
    try:
        user_id = current_user.get("id")
        success = await dashboard_service.update_dashboard(
            dashboard_id=dashboard_id,
            user_id=user_id,
            title=request.title,
            description=request.description,
            configuration=request.configuration,
            layout_config=request.layout_config,
            tags=request.tags,
            is_public=request.is_public,
            is_anonymous_public=request.is_anonymous_public,
            is_favorite=request.is_favorite
        )
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied or dashboard not found"
            )
        
        # Fetch and return the updated dashboard
        dashboard = await dashboard_service.get_dashboard_by_id(dashboard_id, user_id)
        
        return {
            "success": True,
            "dashboard": dashboard
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(require_viewer)
):
    """Delete dashboard (requires delete permission)."""
    try:
        user_id = current_user.get("id")
        success = await dashboard_service.delete_dashboard(dashboard_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied or dashboard not found"
            )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------------
# Tile Endpoints
# -------------------------------------------------------------------------

@dashboard_router.get("/{dashboard_id}/tiles")
async def get_dashboard_tiles(
    dashboard_id: str,
    current_user: dict = Depends(require_viewer)
):
    """Get all tiles for a dashboard (requires view permission)."""
    try:
        user_id = current_user.get("id")
        tiles = await dashboard_service.get_dashboard_tiles(dashboard_id, user_id)
        
        return {
            "success": True,
            "tiles": tiles,
            "total": len(tiles)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/{dashboard_id}/tiles/{tile_id}")
async def get_tile(
    dashboard_id: str,
    tile_id: str,
    current_user: dict = Depends(require_viewer)
):
    """
    Get a single tile by ID (requires view permission on dashboard).
    Useful for refreshing just one tile after an update.
    """
    try:
        user_id = current_user.get("id")
        tile = await dashboard_service.get_tile_by_id(tile_id, dashboard_id, user_id)
        
        if not tile:
            raise HTTPException(
                status_code=404,
                detail="Tile not found or access denied"
            )
        
        return {
            "success": True,
            "tile": tile
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/{dashboard_id}/tiles")
async def create_tile(
    dashboard_id: str,
    request: CreateTileRequest,
    current_user: dict = Depends(require_viewer)
):
    """Create new tile in dashboard (requires edit permission)."""
    try:
        user_id = current_user.get("id")
        tile = await dashboard_service.create_tile(
            dashboard_id=dashboard_id,
            user_id=user_id,
            title=request.title,
            sql_query=request.sql_query,
            chart_type=request.chart_type,
            position_x=request.position_x,
            position_y=request.position_y,
            width=request.width,
            height=request.height,
            description=request.description,
            natural_language_query=request.natural_language_query,
            chart_config=request.chart_config,
            refresh_interval_seconds=request.refresh_interval_seconds
        )
        
        return {
            "success": True,
            "tile": tile
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.put("/{dashboard_id}/tiles/{tile_id}")
async def update_tile(
    dashboard_id: str,
    tile_id: str,
    request: UpdateTileRequest,
    current_user: dict = Depends(require_viewer)
):
    """Update tile (requires edit permission on dashboard). Returns updated tile."""
    try:
        user_id = current_user.get("id")
        
        # Filter out None values
        updates = {k: v for k, v in request.dict().items() if v is not None}
        
        success = await dashboard_service.update_tile(
            tile_id=tile_id,
            user_id=user_id,
            **updates
        )
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied or tile not found"
            )
        
        # Fetch and return the updated tile
        tile = await dashboard_service.get_tile_by_id(tile_id, dashboard_id, user_id)
        
        if not tile:
            raise HTTPException(
                status_code=404,
                detail="Tile not found after update"
            )
        
        return {
            "success": True,
            "tile": tile
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.delete("/{dashboard_id}/tiles/{tile_id}")
async def delete_tile(
    dashboard_id: str,
    tile_id: str,
    current_user: dict = Depends(require_viewer)
):
    """Delete tile (requires edit permission on dashboard)."""
    try:
        user_id = current_user.get("id")
        success = await dashboard_service.delete_tile(tile_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied or tile not found"
            )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------------
# Permission / Sharing Endpoints
# -------------------------------------------------------------------------

@dashboard_router.post("/{dashboard_id}/permissions")
async def grant_permission(
    dashboard_id: str,
    request: GrantPermissionRequest,
    current_user: dict = Depends(require_viewer)
):
    """Grant permissions to a user (requires share permission)."""
    try:
        user_id = current_user.get("id")
        
        from datetime import datetime
        expires_at = None
        if request.expires_at:
            expires_at = datetime.fromisoformat(request.expires_at)
        
        success = await dashboard_service.grant_permission(
            dashboard_id=dashboard_id,
            granter_user_id=user_id,
            target_user_id=request.target_user_id,
            can_view=request.can_view,
            can_edit=request.can_edit,
            can_delete=request.can_delete,
            can_share=request.can_share,
            expires_at=expires_at
        )
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied - you cannot share this dashboard"
            )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.delete("/{dashboard_id}/permissions")
async def revoke_permission(
    dashboard_id: str,
    target_user_id: str,
    current_user: dict = Depends(require_viewer)
):
    """Revoke permissions from a user (requires share permission)."""
    try:
        user_id = current_user.get("id")
        success = await dashboard_service.revoke_permission(
            dashboard_id=dashboard_id,
            revoker_user_id=user_id,
            target_user_id=target_user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Permission denied"
            )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Dashboard Versioning & Publishing Endpoints
# =============================================================================

class PublishDashboardRequest(BaseModel):
    version_notes: Optional[str] = None

@dashboard_router.post("/{dashboard_id}/publish")
async def publish_dashboard(
    dashboard_id: str,
    request: PublishDashboardRequest = PublishDashboardRequest(),
    current_user: dict = Depends(require_editor)
):
    """
    Publish dashboard - creates version snapshot and changes status to published.
    Published dashboards become visible to others based on RBAC permissions.
    Draft dashboards are only visible to the creator.
    """
    try:
        user_id = current_user.get("id")
        result = await dashboard_service.publish_dashboard(
            dashboard_id=dashboard_id,
            user_id=user_id,
            version_notes=request.version_notes
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=403 if "Permission denied" in result.get("error", "") else 500,
                detail=result.get("error")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/{dashboard_id}/versions")
async def list_dashboard_versions(
    dashboard_id: str,
    current_user: dict = Depends(require_viewer)
):
    """
    Get version history for a dashboard.
    Shows all published versions with metadata.
    """
    try:
        user_id = current_user.get("id")
        versions = await dashboard_service.get_dashboard_versions(
            dashboard_id=dashboard_id,
            user_id=user_id
        )
        
        return {
            "success": True,
            "versions": versions,
            "total": len(versions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/{dashboard_id}/revert/{version}")
async def revert_dashboard_version(
    dashboard_id: str,
    version: int,
    current_user: dict = Depends(require_editor)
):
    """
    Revert dashboard to a previous version.
    This restores dashboard settings and all tiles to the specified version.
    Status is set to draft after revert - you'll need to publish again.
    """
    try:
        user_id = current_user.get("id")
        result = await dashboard_service.revert_dashboard_version(
            dashboard_id=dashboard_id,
            target_version=version,
            user_id=user_id
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=403 if "Permission denied" in result.get("error", "") else 500,
                detail=result.get("error")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Public Endpoints (No Authentication Required)
# =============================================================================

@public_router.get("/dashboards")
async def list_public_dashboards():
    """
    Get all anonymous-public dashboards (NO AUTHENTICATION REQUIRED).
    These dashboards can be embedded or shared publicly.
    """
    try:
        dashboards = await dashboard_service.get_anonymous_public_dashboards()
        
        return {
            "success": True,
            "dashboards": dashboards,
            "total": len(dashboards)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@public_router.get("/dashboards/{dashboard_id}")
async def get_public_dashboard(dashboard_id: str):
    """
    Get anonymous-public dashboard by ID (NO AUTHENTICATION REQUIRED).
    Returns 404 if dashboard is not marked as anonymous-public.
    """
    try:
        dashboard = await dashboard_service.get_anonymous_public_dashboard_by_id(dashboard_id)
        
        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail="Dashboard not found or not publicly accessible"
            )
        
        return {
            "success": True,
            "dashboard": dashboard
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@public_router.get("/dashboards/{dashboard_id}/tiles")
async def get_public_dashboard_tiles(dashboard_id: str):
    """
    Get tiles for anonymous-public dashboard (NO AUTHENTICATION REQUIRED).
    Returns empty array if dashboard is not publicly accessible.
    """
    try:
        tiles = await dashboard_service.get_anonymous_public_tiles(dashboard_id)
        
        return {
            "success": True,
            "tiles": tiles,
            "total": len(tiles)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
