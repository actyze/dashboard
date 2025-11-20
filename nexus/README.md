# Nexus Service

A Python-based GraphQL API service that serves as the central hub for natural language to SQL workflows. This service replicates and enhances the functionality of the Java backend with modern Python frameworks.

## Architecture

Nexus follows a clean, loosely-coupled architecture:

```
Natural Language Query → Schema Service → LLM Service → SQL Execution → Results
```

### Core Components

1. **GraphQL API Layer** - Strawberry GraphQL for modern, type-safe APIs
2. **Orchestration Engine** - Coordinates workflow between services
3. **Service Clients** - HTTP clients for external services (Schema, LLM, Trino)
4. **Error Handling** - Comprehensive retry logic and error analysis
5. **Caching Layer** - Redis-based caching for performance
6. **Health Monitoring** - Service health checks and metrics

## Technology Stack

- **FastAPI** - High-performance async web framework
- **Strawberry GraphQL** - Modern GraphQL library with type safety
- **Pydantic** - Data validation and serialization
- **httpx** - Async HTTP client
- **Redis** - Caching and session storage
- **Tenacity** - Retry logic with exponential backoff
- **Structlog** - Structured logging
- **Prometheus** - Metrics and monitoring

## Features

- ✅ **GraphQL API** - Type-safe, introspectable API
- ✅ **Async/Await** - High-performance async operations
- ✅ **User Management** - User accounts, preferences, and settings
- ✅ **Conversation History** - Context-aware query processing with persistence
- ✅ **Query History** - Complete audit trail of all queries
- ✅ **Saved Queries** - Save and reuse favorite queries
- ✅ **Retry Logic** - Intelligent error recovery
- ✅ **Caching** - Redis-based result caching
- ✅ **PostgreSQL Integration** - Persistent user data storage
- ✅ **Health Checks** - Service monitoring and diagnostics
- ✅ **Structured Logging** - Comprehensive observability
- ✅ **Type Safety** - Full type hints and validation

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start with Docker Compose (recommended)
docker-compose up -d

# Or start manually:
# Start Redis (for caching)
docker run -d -p 6379:6379 redis:alpine
# Start PostgreSQL (for user data)
docker run -d -p 5432:5432 -e POSTGRES_DB=dashboard -e POSTGRES_USER=dashboard_user -e POSTGRES_PASSWORD=dashboard_password postgres:15

# Run the service
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

## API Documentation

### GraphQL (Primary API)
- **Interactive Playground**: `http://localhost:8002/graphql` 
- **Schema Export**: Run `python generate_schema.py` to create `schema.graphql`
- **Complete Documentation**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### REST Endpoints (Utility)
- **Swagger UI**: `http://localhost:8002/docs`
- **ReDoc**: `http://localhost:8002/redoc`
- **OpenAPI Schema**: `http://localhost:8002/openapi.json`

## Configuration

### Helm-Driven Configuration Pattern

Nexus follows the same configuration pattern as the Java backend, where all values are provided via Helm charts in production environments. The configuration uses the `${VARIABLE_NAME:default_value}` pattern for environment variable substitution.

### Environment Variables

Copy `env.example` to `.env` for local development:

```bash
cp env.example .env
```

**Key Configuration Sections:**

#### Service Configuration
```bash
NEXUS_HOST=${NEXUS_HOST:0.0.0.0}
NEXUS_PORT=${NEXUS_PORT:8002}
DEBUG=${DEBUG:false}
```

#### Database Configuration
```bash
# PostgreSQL (User Data Persistence)
POSTGRES_HOST=${POSTGRES_HOST:dashboard-postgres}
POSTGRES_PORT=${POSTGRES_PORT:5432}
POSTGRES_DATABASE=${POSTGRES_DATABASE:dashboard}
POSTGRES_USER=${POSTGRES_USER:dashboard_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:dashboard_password}

# Trino (Query Execution)
TRINO_HOST=${TRINO_HOST:dashboard-trino}
TRINO_PORT=${TRINO_PORT:8080}
TRINO_CATALOG=${TRINO_CATALOG:postgres}
TRINO_SCHEMA=${TRINO_SCHEMA:public}
```

#### External Services
```bash
# Schema Service (FAISS)
SCHEMA_SERVICE_URL=${SCHEMA_SERVICE_URL:http://dashboard-schema-service:8001}
SCHEMA_SERVICE_TIMEOUT=${SCHEMA_SERVICE_TIMEOUT:30}
SCHEMA_SERVICE_RETRIES=${SCHEMA_SERVICE_RETRIES:3}

# LLM Service
LLM_SERVICE_URL=${LLM_SERVICE_URL:http://dashboard-fastapi:8000}
LLM_SERVICE_TIMEOUT=${LLM_SERVICE_TIMEOUT:30}

# External LLM (OpenAI, Perplexity, etc.)
EXTERNAL_LLM_ENABLED=${EXTERNAL_LLM_ENABLED:false}
EXTERNAL_LLM_PROVIDER=${EXTERNAL_LLM_PROVIDER:}
EXTERNAL_LLM_API_KEY=${EXTERNAL_LLM_API_KEY:}
```

#### Feature Flags
```bash
FEATURE_USER_MANAGEMENT=${FEATURE_USER_MANAGEMENT:true}
FEATURE_CONVERSATION_HISTORY=${FEATURE_CONVERSATION_HISTORY:true}
FEATURE_QUERY_CACHING=${FEATURE_QUERY_CACHING:true}
FEATURE_SCHEMA_RECOMMENDATIONS=${FEATURE_SCHEMA_RECOMMENDATIONS:true}
```

### Production Deployment

In production, all environment variables are provided via Helm charts, following the same pattern as the Java backend:

```yaml
# values.yaml
nexus:
  config:
    nexusHost: "0.0.0.0"
    nexusPort: 8002
    debug: false
    
    postgres:
      host: "dashboard-postgres"
      port: 5432
      database: "dashboard"
      
    redis:
      url: "redis://dashboard-redis:6379"
      
    external:
      schemaServiceUrl: "http://dashboard-schema-service:8001"
      llmServiceUrl: "http://dashboard-fastapi:8000"
```

## API Examples

### Natural Language Query
```graphql
mutation ProcessQuery {
  processNaturalLanguage(
    input: {
      message: "Show me top 10 customers by revenue"
      conversationHistory: ["Previous query about sales data"]
    }
  ) {
    success
    generatedSQL
    queryResults {
      columns
      rows
    }
    modelConfidence
    processingTime
    error
  }
}
```

### Direct SQL Execution
```graphql
mutation ExecuteSQL {
  executeSQL(
    input: {
      sql: "SELECT * FROM sales.customers LIMIT 10"
    }
  ) {
    success
    queryResults {
      columns
      rows
    }
    executionTime
    error
  }
}
```

### User Management
```graphql
# Create a new user
mutation CreateUser {
  createUser(
    input: {
      username: "john_doe"
      email: "john@example.com"
      fullName: "John Doe"
    }
  ) {
    success
    user {
      id
      username
      email
    }
  }
}

# Get conversation history
query ConversationHistory {
  conversationHistory(
    userId: 1
    sessionId: "session-123"
    limit: 10
  ) {
    success
    conversationHistory {
      messageType
      messageContent
      createdAt
    }
  }
}

# Save a query for reuse
mutation SaveQuery {
  saveQuery(
    userId: 1
    input: {
      queryName: "Top Customers"
      naturalLanguageQuery: "Show me top 10 customers by revenue"
      generatedSql: "SELECT customer_name, SUM(revenue) FROM sales GROUP BY customer_name ORDER BY SUM(revenue) DESC LIMIT 10"
      description: "Get the highest revenue customers"
      tags: ["customers", "revenue", "top10"]
    }
  ) {
    success
    savedQuery {
      id
      queryName
    }
  }
}
```

### Health Check
```graphql
query HealthCheck {
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
```
