"""Tests for GraphQL API."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from main import app


@pytest.fixture
async def client():
    """Create test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Query Orchestrator"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "query-orchestrator"


@pytest.mark.asyncio
@patch('app.graphql.schema.orchestration_service')
async def test_graphql_health_query(mock_orchestration, client):
    """Test GraphQL health check query."""
    
    # Mock orchestration service
    mock_orchestration.get_health_status.return_value = {
        "status": "healthy",
        "services": [
            {
                "name": "schema-service",
                "healthy": True,
                "response_time": 0.1
            },
            {
                "name": "llm-service", 
                "healthy": True,
                "response_time": 0.2
            }
        ]
    }
    
    query = """
    query {
        healthCheck {
            status
            services {
                name
                healthy
                responseTime
            }
            timestamp
        }
    }
    """
    
    response = await client.post("/graphql", json={"query": query})
    assert response.status_code == 200
    
    data = response.json()
    assert "data" in data
    assert data["data"]["healthCheck"]["status"] == "healthy"
    assert len(data["data"]["healthCheck"]["services"]) == 2


@pytest.mark.asyncio
@patch('app.graphql.schema.orchestration_service')
async def test_graphql_process_natural_language(mock_orchestration, client):
    """Test GraphQL natural language processing mutation."""
    
    # Mock orchestration service
    mock_orchestration.process_natural_language_workflow.return_value = {
        "success": True,
        "nl_query": "Show me customers",
        "generated_sql": "SELECT * FROM customers",
        "query_results": {
            "columns": ["id", "name"],
            "rows": [[1, "John"], [2, "Jane"]],
            "row_count": 2
        },
        "schema_recommendations": [
            {
                "full_name": "sales.customers",
                "confidence": 0.9,
                "table_name": "customers",
                "schema_name": "sales"
            }
        ],
        "model_confidence": 0.95,
        "model_reasoning": "Query for customer data",
        "processing_time": 1500.0,
        "execution_time": 200.0,
        "retry_attempts": 0,
        "error_history": []
    }
    
    mutation = """
    mutation {
        processNaturalLanguage(
            input: {
                message: "Show me customers"
                conversationHistory: ["Previous query"]
            }
        ) {
            success
            nlQuery
            generatedSql
            queryResults {
                columns
                rows
                rowCount
            }
            schemaRecommendations {
                fullName
                confidence
                tableName
                schemaName
            }
            modelConfidence
            modelReasoning
            processingTime
            executionTime
            retryAttempts
        }
    }
    """
    
    response = await client.post("/graphql", json={"query": mutation})
    assert response.status_code == 200
    
    data = response.json()
    assert "data" in data
    result = data["data"]["processNaturalLanguage"]
    assert result["success"] is True
    assert result["nlQuery"] == "Show me customers"
    assert result["generatedSql"] == "SELECT * FROM customers"
    assert result["queryResults"]["rowCount"] == 2
    assert len(result["schemaRecommendations"]) == 1
    assert result["modelConfidence"] == 0.95


@pytest.mark.asyncio
@patch('app.graphql.schema.orchestration_service')
async def test_graphql_execute_sql(mock_orchestration, client):
    """Test GraphQL SQL execution mutation."""
    
    # Mock orchestration service
    mock_orchestration.execute_sql_directly.return_value = {
        "success": True,
        "original_sql": "SELECT COUNT(*) FROM customers",
        "query_results": {
            "columns": ["count"],
            "rows": [[42]],
            "row_count": 1
        },
        "execution_time": 150.0
    }
    
    mutation = """
    mutation {
        executeSql(
            input: {
                sql: "SELECT COUNT(*) FROM customers"
                maxResults: 100
                timeoutSeconds: 30
            }
        ) {
            success
            originalSql
            queryResults {
                columns
                rows
                rowCount
            }
            executionTime
        }
    }
    """
    
    response = await client.post("/graphql", json={"query": mutation})
    assert response.status_code == 200
    
    data = response.json()
    assert "data" in data
    result = data["data"]["executeSql"]
    assert result["success"] is True
    assert result["originalSql"] == "SELECT COUNT(*) FROM customers"
    assert result["queryResults"]["rowCount"] == 1
    assert result["executionTime"] == 150.0


@pytest.mark.asyncio
@patch('app.graphql.schema.orchestration_service')
async def test_graphql_clear_cache(mock_orchestration, client):
    """Test GraphQL cache clearing mutation."""
    
    # Mock orchestration service
    mock_orchestration.clear_cache.return_value = {
        "success": True,
        "message": "Cache cleared successfully"
    }
    
    mutation = """
    mutation {
        clearCache
    }
    """
    
    response = await client.post("/graphql", json={"query": mutation})
    assert response.status_code == 200
    
    data = response.json()
    assert "data" in data
    result = data["data"]["clearCache"]
    assert result["success"] is True
    assert result["message"] == "Cache cleared successfully"


@pytest.mark.asyncio
async def test_graphql_introspection(client):
    """Test GraphQL introspection query."""
    
    query = """
    query {
        __schema {
            types {
                name
                kind
            }
        }
    }
    """
    
    response = await client.post("/graphql", json={"query": query})
    assert response.status_code == 200
    
    data = response.json()
    assert "data" in data
    assert "__schema" in data["data"]
    assert "types" in data["data"]["__schema"]
    
    # Check that our custom types are present
    type_names = [t["name"] for t in data["data"]["__schema"]["types"]]
    assert "Query" in type_names
    assert "Mutation" in type_names
