# Nexus API Documentation

## Overview

Nexus is a GraphQL-first API service that serves as the central hub for natural language to SQL workflows. It provides a modern, type-safe interface for processing natural language queries and managing user data.

## API Endpoints

### GraphQL API (Primary)
- **Endpoint**: `http://localhost:8002/graphql`
- **Interactive Playground**: `http://localhost:8002/graphql` (development mode)
- **Protocol**: GraphQL over HTTP POST

### REST Endpoints (Utility)
- **Service Info**: `GET http://localhost:8002/`
- **Health Check**: `GET http://localhost:8002/health`
- **Metrics**: `GET http://localhost:8002/metrics`
- **OpenAPI Docs**: `http://localhost:8002/docs` (Swagger UI)
- **ReDoc**: `http://localhost:8002/redoc` (Alternative docs)

## GraphQL Schema

### Core Types

#### User Management
```graphql
type User {
  id: Int!
  username: String!
  email: String!
  fullName: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type UserPreferences {
  userId: Int!
  preferences: JSON!
  updatedAt: DateTime!
}

type ConversationMessage {
  id: Int!
  userId: Int!
  sessionId: String!
  messageType: String!  # "user" | "assistant" | "system"
  messageContent: String!
  metadata: JSON
  createdAt: DateTime!
}

type QueryHistoryItem {
  id: Int!
  userId: Int!
  naturalLanguageQuery: String!
  generatedSql: String
  executionStatus: String!  # "success" | "error" | "timeout"
  executionTime: Float
  rowCount: Int
  errorMessage: String
  createdAt: DateTime!
}

type SavedQuery {
  id: Int!
  userId: Int!
  queryName: String!
  naturalLanguageQuery: String!
  generatedSql: String!
  description: String
  tags: [String!]
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

#### Workflow Types
```graphql
type WorkflowResponse {
  success: Boolean!
  naturalLanguageQuery: String!
  generatedSql: String
  queryResults: QueryResults
  schemaRecommendations: [SchemaRecommendation!]
  executionTime: Float!
  error: String
}

type QueryResults {
  columns: [String!]!
  rows: [[JSON!]!]!
  rowCount: Int!
}

type SchemaRecommendation {
  tableName: String!
  confidence: Float!
  relevantColumns: [String!]!
  reason: String
}
```

### Queries

#### User Queries
```graphql
# Get user by ID
query GetUser($userId: Int!) {
  user(userId: $userId) {
    success
    user {
      id
      username
      email
      fullName
    }
  }
}

# Get user by username
query GetUserByUsername($username: String!) {
  userByUsername(username: $username) {
    success
    user {
      id
      username
      email
    }
  }
}

# Get user preferences
query GetUserPreferences($userId: Int!) {
  userPreferences(userId: $userId) {
    success
    preferences
  }
}

# Get conversation history
query GetConversationHistory($userId: Int!, $sessionId: String!, $limit: Int) {
  conversationHistory(userId: $userId, sessionId: $sessionId, limit: $limit) {
    success
    conversationHistory {
      messageType
      messageContent
      createdAt
      metadata
    }
  }
}

# Get query history
query GetQueryHistory($userId: Int!, $limit: Int) {
  queryHistory(userId: $userId, limit: $limit) {
    success
    queryHistory {
      naturalLanguageQuery
      generatedSql
      executionStatus
      executionTime
      rowCount
      createdAt
    }
  }
}

# Get saved queries
query GetSavedQueries($userId: Int!) {
  savedQueries(userId: $userId) {
    success
    savedQueries {
      id
      queryName
      naturalLanguageQuery
      generatedSql
      description
      tags
    }
  }
}

# Generate session ID
query GenerateSessionId {
  generateSessionId
}
```

#### System Queries
```graphql
# Health check
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

# Cache statistics
query CacheStats {
  cacheStats {
    hits
    misses
    hitRate
    totalKeys
  }
}
```

### Mutations

#### Natural Language Processing
```graphql
# Process natural language query
mutation ProcessNaturalLanguage(
  $input: ConversationInputGQL!
  $userId: Int
  $sessionId: String
) {
  processNaturalLanguage(
    input: $input
    userId: $userId
    sessionId: $sessionId
  ) {
    success
    naturalLanguageQuery
    generatedSql
    queryResults {
      columns
      rows
      rowCount
    }
    schemaRecommendations {
      tableName
      confidence
      relevantColumns
      reason
    }
    executionTime
    error
  }
}

# Execute SQL directly
mutation ExecuteSQL($input: SQLInputGQL!) {
  executeSql(input: $input) {
    success
    sql
    queryResults {
      columns
      rows
      rowCount
    }
    executionTime
    error
  }
}
```

#### User Management
```graphql
# Create user
mutation CreateUser($input: UserCreateGQL!) {
  createUser(input: $input) {
    success
    user {
      id
      username
      email
      fullName
    }
    error
  }
}

# Set user preference
mutation SetUserPreference($userId: Int!, $input: UserPreferenceInputGQL!) {
  setUserPreference(userId: $userId, input: $input) {
    success
    error
  }
}

# Save conversation message
mutation SaveConversationMessage($userId: Int!, $input: ConversationMessageInputGQL!) {
  saveConversationMessage(userId: $userId, input: $input) {
    success
    message {
      id
      messageType
      messageContent
      createdAt
    }
    error
  }
}

# Save query
mutation SaveQuery($userId: Int!, $input: SavedQueryInputGQL!) {
  saveQuery(userId: $userId, input: $input) {
    success
    savedQuery {
      id
      queryName
      description
    }
    error
  }
}
```

#### System Operations
```graphql
# Clear cache
mutation ClearCache {
  clearCache {
    success
    message
  }
}
```

## Input Types

```graphql
input ConversationInputGQL {
  message: String!
  conversationHistory: [String!]
}

input SQLInputGQL {
  sql: String!
}

input UserCreateGQL {
  username: String!
  email: String!
  fullName: String
}

input UserPreferenceInputGQL {
  preferenceKey: String!
  preferenceValue: JSON!
}

input ConversationMessageInputGQL {
  sessionId: String!
  messageType: String!
  messageContent: String!
  metadata: JSON
}

input SavedQueryInputGQL {
  queryName: String!
  naturalLanguageQuery: String!
  generatedSql: String!
  description: String
  tags: [String!]
}
```

## Scheduled KPI REST API

Endpoints for managing scheduled KPI definitions, collection, and metric values. All endpoints require authentication. Write operations require ADMIN or USER role.

### KPI Definitions

```
GET    /api/kpi                          — List all KPI definitions
POST   /api/kpi                          — Create a new KPI definition
GET    /api/kpi/{kpi_id}                 — Get a single KPI definition
PUT    /api/kpi/{kpi_id}                 — Update a KPI definition (owner only)
DELETE /api/kpi/{kpi_id}                 — Delete a KPI and its materialized table (owner only)
```

### KPI Collection & Metrics

```
POST   /api/kpi/{kpi_id}/collect         — Trigger immediate collection (runs in background)
GET    /api/kpi/{kpi_id}/values          — Get collected metric values (time-series)
GET    /api/kpi/{kpi_id}/summary         — Get aggregation summary over a time range
```

### Create KPI Request

```json
{
  "name": "Daily Active Users",
  "description": "Count of distinct users per day",
  "sql_query": "SELECT COUNT(DISTINCT user_id) AS active_users FROM events WHERE event_date = CURRENT_DATE",
  "interval_hours": 1,
  "is_active": true
}
```

### Materialized Tables

Each KPI creates a real typed Postgres table in the `kpi_data` schema (e.g., `kpi_data.kpi_daily_active_users`) with columns inferred from the first Trino query execution. Tables are automatically registered with the FAISS schema service for AI discovery. On deletion, the table is dropped and deregistered.

Query the materialized table directly via Trino:
```sql
SELECT * FROM postgres.kpi_data.kpi_daily_active_users
WHERE collected_at >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
ORDER BY collected_at DESC
```

## Authentication & Authorization

Currently, the API operates without authentication. For production deployment, consider implementing:

1. **JWT Authentication** - Token-based auth for user sessions
2. **API Keys** - For service-to-service communication
3. **Rate Limiting** - Prevent abuse and ensure fair usage
4. **RBAC** - Role-based access control for different user types

## Error Handling

All GraphQL operations return a consistent response format:

```graphql
type Response {
  success: Boolean!
  data: JSON
  error: String
}
```

Common error types:
- **Validation Errors** - Invalid input parameters
- **Service Errors** - External service failures (Schema, LLM, Trino)
- **Database Errors** - PostgreSQL connection or query issues
- **Timeout Errors** - Long-running operations that exceed limits

## Performance Considerations

1. **Caching** - Redis-based caching for query results and schema recommendations
2. **Connection Pooling** - Async database connections with SQLAlchemy
3. **Retry Logic** - Exponential backoff for external service calls
4. **Query Optimization** - Efficient database queries with proper indexing

## Development Tools

1. **GraphQL Playground** - `http://localhost:8002/graphql`
2. **Swagger UI** - `http://localhost:8002/docs`
3. **ReDoc** - `http://localhost:8002/redoc`
4. **Health Check** - `http://localhost:8002/health`
5. **Metrics** - `http://localhost:8002/metrics`

## Example Usage

### Frontend Integration (React)
```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:8002/graphql',
  cache: new InMemoryCache()
});

// Process natural language query
const PROCESS_QUERY = gql`
  mutation ProcessQuery($input: ConversationInputGQL!, $userId: Int, $sessionId: String) {
    processNaturalLanguage(input: $input, userId: $userId, sessionId: $sessionId) {
      success
      naturalLanguageQuery
      generatedSql
      queryResults {
        columns
        rows
        rowCount
      }
      executionTime
      error
    }
  }
`;

// Usage
const result = await client.mutate({
  mutation: PROCESS_QUERY,
  variables: {
    input: {
      message: "Show me top 10 customers by revenue",
      conversationHistory: []
    },
    userId: 1,
    sessionId: "session-123"
  }
});
```

### cURL Examples
```bash
# Health check
curl http://localhost:8002/health

# GraphQL query
curl -X POST http://localhost:8002/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { healthCheck { status services { name healthy } } }"
  }'

# Process natural language
curl -X POST http://localhost:8002/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation($input: ConversationInputGQL!) { processNaturalLanguage(input: $input) { success generatedSql queryResults { columns rows } } }",
    "variables": {
      "input": {
        "message": "Show me all users",
        "conversationHistory": []
      }
    }
  }'
```

## Deployment

The service is containerized and ready for deployment:

```bash
# Local development
docker-compose up -d

# Production deployment
docker build -t nexus:latest .
docker run -p 8002:8002 nexus:latest
```

For Kubernetes deployment, see the Helm charts in the `helm/` directory.
