from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.orchestration_service import orchestration_service

router = APIRouter(prefix="/api", tags=["REST API"])

class GenerateSQLRequest(BaseModel):
    nl_query: str
    conversation_history: Optional[List[str]] = []
    user_id: Optional[int] = None
    session_id: Optional[str] = None

class ExecuteSQLRequest(BaseModel):
    sql: str
    max_results: Optional[int] = 100
    timeout_seconds: Optional[int] = 30

class QueryRequest(BaseModel):
    input: str
    type: str = 'auto' # 'auto' (NL) or 'sql'
    includeChart: Optional[bool] = False
    chartType: Optional[str] = None
    conversation_history: Optional[List[str]] = []

@router.post("/generate-sql")
async def generate_sql(request: GenerateSQLRequest):
    """Generate SQL from natural language without executing it."""
    result = await orchestration_service.generate_sql_from_nl(
        request.nl_query, 
        request.conversation_history
    )
    return result

@router.post("/execute-sql")
async def execute_sql(request: ExecuteSQLRequest):
    """Execute raw SQL query directly."""
    result = await orchestration_service.execute_sql_directly(
        request.sql,
        request.max_results,
        request.timeout_seconds
    )
    return result

@router.post("/query")
async def query(request: QueryRequest):
    """
    Unified endpoint for query execution.
    Supports both raw SQL execution and Natural Language processing.
    """
    if request.type == 'sql':
        result = await orchestration_service.execute_sql_directly(request.input)
        return result
    elif request.type == 'auto':
        result = await orchestration_service.process_natural_language_workflow(
            nl_query=request.input,
            conversation_history=request.conversation_history,
            include_chart=request.includeChart,
            chart_type=request.chartType
        )
        return result
    else:
        raise HTTPException(status_code=400, detail="Invalid query type. Use 'sql' or 'auto'.")

