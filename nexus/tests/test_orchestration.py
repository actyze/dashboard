"""Tests for the orchestration service."""

import pytest
from unittest.mock import AsyncMock
from app.services.orchestration_service import OrchestrationService


@pytest.fixture
def orchestration_service():
    """Create orchestration service with mocked dependencies."""
    service = OrchestrationService()
    
    # Mock all external services
    service.schema_service = AsyncMock()
    service.llm_service = AsyncMock()
    service.trino_service = AsyncMock()
    service.cache_service = AsyncMock()
    
    return service


@pytest.mark.asyncio
async def test_successful_workflow(orchestration_service):
    """Test successful natural language workflow."""
    
    # Mock schema service response
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": True,
        "recommendations": [
            {
                "full_name": "sales.customers",
                "confidence": 0.9,
                "table_name": "customers",
                "schema_name": "sales"
            }
        ]
    }
    
    # Mock LLM service response
    orchestration_service.llm_service.generate_sql.return_value = {
        "success": True,
        "sql": "SELECT * FROM sales.customers LIMIT 10",
        "confidence": 0.95,
        "reasoning": "Query for customer data"
    }
    
    # Mock Trino service response
    orchestration_service.trino_service.execute_with_retry.return_value = {
        "success": True,
        "query_results": {
            "columns": ["id", "name", "email"],
            "rows": [[1, "John Doe", "john@example.com"]],
            "row_count": 1
        },
        "execution_time": 150.0,
        "retry_attempts": 0,
        "error_history": [],
        "final_sql": "SELECT * FROM sales.customers LIMIT 10"
    }
    
    # Mock cache service (no cached results)
    orchestration_service.cache_service.get_schema_recommendations.return_value = None
    orchestration_service.cache_service.get_sql_generation.return_value = None
    orchestration_service.cache_service.get_query_result.return_value = None
    
    # Execute workflow
    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data",
        ["Previous query about sales"]
    )
    
    # Verify result
    assert result["success"] is True
    assert result["nl_query"] == "Show me customer data"
    assert result["generated_sql"] == "SELECT * FROM sales.customers LIMIT 10"
    assert result["model_confidence"] == 0.95
    assert result["retry_attempts"] == 0
    assert len(result["schema_recommendations"]) == 1


@pytest.mark.asyncio
async def test_schema_service_failure(orchestration_service):
    """Test workflow when schema service fails."""
    
    # Mock schema service failure
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": False,
        "error": "Schema service unavailable"
    }
    
    # Mock cache service (no cached results)
    orchestration_service.cache_service.get_schema_recommendations.return_value = None
    
    # Execute workflow
    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )
    
    # Verify error response
    assert result["success"] is False
    assert result["error"] == "Schema service unavailable"
    assert result["error_type"] == "SCHEMA_SERVICE_ERROR"


@pytest.mark.asyncio
async def test_sql_generation_failure(orchestration_service):
    """Test workflow when SQL generation fails."""
    
    # Mock successful schema service
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": True,
        "recommendations": []
    }
    
    # Mock LLM service failure
    orchestration_service.llm_service.generate_sql.return_value = {
        "success": False,
        "error": "LLM service unavailable",
        "error_type": "SERVICE_ERROR"
    }
    
    # Mock cache service (no cached results)
    orchestration_service.cache_service.get_schema_recommendations.return_value = None
    orchestration_service.cache_service.get_sql_generation.return_value = None
    
    # Execute workflow
    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )
    
    # Verify error response
    assert result["success"] is False
    assert result["error"] == "LLM service unavailable"
    assert result["error_type"] == "SERVICE_ERROR"


@pytest.mark.asyncio
async def test_cached_results(orchestration_service):
    """Test workflow with cached results."""
    
    # Mock cached schema recommendations
    orchestration_service.cache_service.get_schema_recommendations.return_value = {
        "success": True,
        "recommendations": [{"full_name": "sales.customers", "confidence": 0.9}]
    }
    
    # Mock cached SQL generation
    orchestration_service.cache_service.get_sql_generation.return_value = {
        "success": True,
        "sql": "SELECT * FROM sales.customers",
        "confidence": 0.95
    }
    
    # Mock cached query result
    orchestration_service.cache_service.get_query_result.return_value = {
        "success": True,
        "query_results": {"columns": ["id"], "rows": [[1]], "row_count": 1},
        "execution_time": 100.0
    }
    
    # Execute workflow
    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )
    
    # Verify that external services were not called
    orchestration_service.schema_service.get_recommendations.assert_not_called()
    orchestration_service.llm_service.generate_sql.assert_not_called()
    orchestration_service.trino_service.execute_with_retry.assert_not_called()
    
    # Verify successful result from cache
    assert result["success"] is True


@pytest.mark.asyncio
async def test_direct_sql_execution(orchestration_service):
    """Test direct SQL execution."""
    
    # Mock Trino service response
    orchestration_service.trino_service.execute_query.return_value = {
        "success": True,
        "query_results": {
            "columns": ["count"],
            "rows": [[42]],
            "row_count": 1
        },
        "execution_time": 200.0
    }
    
    # Mock cache service (no cached results)
    orchestration_service.cache_service.get_query_result.return_value = None
    
    # Execute SQL directly
    result = await orchestration_service.execute_sql_directly(
        "SELECT COUNT(*) FROM sales.customers"
    )
    
    # Verify result
    assert result["success"] is True
    assert result["original_sql"] == "SELECT COUNT(*) FROM sales.customers"
    assert result["execution_time"] == 200.0
    assert result["query_results"]["row_count"] == 1


@pytest.mark.asyncio
async def test_health_check(orchestration_service):
    """Test health check functionality."""
    
    # Mock service health responses
    orchestration_service.schema_service.health_check.return_value = {
        "name": "schema-service",
        "healthy": True,
        "response_time": 0.1
    }
    
    orchestration_service.llm_service.health_check.return_value = {
        "name": "llm-service",
        "healthy": True,
        "response_time": 0.2
    }
    
    orchestration_service.trino_service.health_check.return_value = {
        "name": "trino-service",
        "healthy": False,
        "error": "Connection refused"
    }
    
    orchestration_service.cache_service.get_stats.return_value = {
        "connected": True,
        "used_memory": "1MB"
    }
    
    # Get health status
    result = await orchestration_service.get_health_status()
    
    # Verify result
    assert result["status"] == "unhealthy"  # Because Trino is unhealthy
    assert len(result["services"]) == 4  # 3 main services + cache
    
    # Find Trino service in results
    trino_health = next(s for s in result["services"] if s["name"] == "trino-service")
    assert trino_health["healthy"] is False
    assert trino_health["error"] == "Connection refused"
