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
    service.preference_service = AsyncMock()
    service.user_service = AsyncMock()
    service.error_analysis_service = AsyncMock()

    # Default: detect_intent returns NEW_QUERY
    service.schema_service.detect_intent.return_value = {
        "intent": "NEW_QUERY",
        "confidence": 0.95
    }

    # Default: all cache misses
    service.cache_service.get_schema_recommendations.return_value = None
    service.cache_service.get_sql_generation.return_value = None
    service.cache_service.get_query_result.return_value = None
    service.cache_service.get_generated_sql.return_value = None
    service.cache_service.get_llm_response.return_value = None

    # Default: no preferred tables
    service.preference_service.get_user_preferred_tables_with_metadata.return_value = []

    return service


@pytest.mark.asyncio
async def test_successful_workflow(orchestration_service):
    """Test successful natural language workflow end-to-end."""

    # Mock schema service
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": True,
        "recommendations": [
            {"full_name": "sales.customers", "confidence": 0.9, "table_name": "customers", "schema_name": "sales"}
        ]
    }

    # Mock LLM service
    orchestration_service.llm_service.generate_sql.return_value = {
        "success": True,
        "sql": "SELECT * FROM sales.customers LIMIT 10",
        "confidence": 0.95,
        "reasoning": "Query for customer data"
    }

    # Mock Trino execution
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

    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data",
        ["Previous query about sales"]
    )

    assert result["success"] is True
    assert result["nl_query"] == "Show me customer data"
    assert "SELECT" in result["generated_sql"]
    assert result["retry_attempts"] == 0


@pytest.mark.asyncio
async def test_schema_service_failure(orchestration_service):
    """Test workflow when schema service fails — should still proceed to LLM."""

    # Schema service fails
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": False,
        "error": "Schema service unavailable"
    }

    # LLM still works (orchestration continues despite schema failure)
    orchestration_service.llm_service.generate_sql.return_value = {
        "success": False,
        "error": "No tables available",
        "error_type": "NO_SCHEMA_MATCH"
    }

    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )

    # The workflow should complete (possibly with error) but not crash
    assert result["success"] is False
    assert "error" in result


@pytest.mark.asyncio
async def test_sql_generation_failure(orchestration_service):
    """Test workflow when LLM SQL generation fails."""

    # Schema service succeeds
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": True,
        "recommendations": []
    }

    # LLM fails
    orchestration_service.llm_service.generate_sql.return_value = {
        "success": False,
        "error": "LLM service unavailable",
        "error_type": "SERVICE_ERROR"
    }

    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )

    assert result["success"] is False
    assert "error" in result


@pytest.mark.asyncio
async def test_cached_sql_generation(orchestration_service):
    """Test that cached SQL generation skips LLM call."""

    # Schema service succeeds
    orchestration_service.schema_service.get_recommendations.return_value = {
        "success": True,
        "recommendations": [{"full_name": "sales.customers", "confidence": 0.9}],
    }

    # SQL generation is cached
    orchestration_service.cache_service.get_generated_sql.return_value = {
        "success": True,
        "nl_query": "Show me customer data",
        "generated_sql": "SELECT * FROM sales.customers",
        "model_confidence": 0.95,
        "schema_recommendations": [{"full_name": "sales.customers", "confidence": 0.9}],
    }

    # Trino execution for the cached SQL
    orchestration_service.trino_service.execute_with_retry.return_value = {
        "success": True,
        "query_results": {"columns": ["id"], "rows": [[1]], "row_count": 1},
        "execution_time": 100.0,
        "retry_attempts": 0,
        "error_history": [],
        "final_sql": "SELECT * FROM sales.customers"
    }

    result = await orchestration_service.process_natural_language_workflow(
        "Show me customer data"
    )

    # LLM should NOT have been called (SQL came from cache)
    orchestration_service.llm_service.generate_sql.assert_not_called()

    assert result["success"] is True


@pytest.mark.asyncio
async def test_direct_sql_execution(orchestration_service):
    """Test direct SQL execution."""

    orchestration_service.trino_service.execute_query.return_value = {
        "success": True,
        "query_results": {
            "columns": ["count"],
            "rows": [[42]],
            "row_count": 1
        },
        "execution_time": 200.0
    }

    orchestration_service.cache_service.get_query_result.return_value = None

    result = await orchestration_service.execute_sql_directly(
        "SELECT COUNT(*) FROM sales.customers"
    )

    assert result["success"] is True
    assert result["original_sql"] == "SELECT COUNT(*) FROM sales.customers"
    assert result["execution_time"] == 200.0
    assert result["query_results"]["row_count"] == 1


@pytest.mark.asyncio
async def test_health_check(orchestration_service):
    """Test health check functionality."""

    orchestration_service.schema_service.health_check.return_value = {
        "name": "schema-service", "healthy": True, "response_time": 0.1
    }
    orchestration_service.llm_service.health_check.return_value = {
        "name": "llm-service", "healthy": True, "response_time": 0.2
    }
    orchestration_service.trino_service.health_check.return_value = {
        "name": "trino-service", "healthy": False, "error": "Connection refused"
    }
    orchestration_service.cache_service.get_stats.return_value = {
        "connected": True, "used_memory": "1MB"
    }

    result = await orchestration_service.get_health_status()

    assert result["status"] == "unhealthy"
    assert len(result["services"]) == 4

    trino_health = next(s for s in result["services"] if s["name"] == "trino-service")
    assert trino_health["healthy"] is False
    assert trino_health["error"] == "Connection refused"
