# Query Management API Documentation

Complete API reference for Query History and Saved Queries management with two tabs.

## Overview

### Two-Tab Structure

1. **Tab 1: Recent Queries** (`/api/query-history`)
   - Automatic audit log of ALL query executions
   - Limited editing (rename, delete)
   - Shows execution details, timings, status

2. **Tab 2: Saved Queries** (`/api/saved-queries`)
   - User's bookmarked queries for reuse
   - Full CRUD operations
   - Tags, favorites, execution tracking

---

## Tab 1: Recent Queries (Query History)

### GET /api/query-history
Get recent query execution history

**Query Parameters:**
- `limit` (int, optional): Number of records (default: 50)
- `offset` (int, optional): Pagination offset (default: 0)
- `query_type` (string, optional): Filter by type (`natural_language` or `manual`)

**Example Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/query-history?limit=20&query_type=natural_language"
```

**Response:**
```json
{
  "success": true,
  "queries": [
    {
      "id": 123,
      "query_name": "Top Customers Analysis",
      "query_type": "natural_language",
      "natural_language_query": "show me top 10 customers by sales",
      "generated_sql": "SELECT c.name, SUM(o.amount) ...",
      "execution_status": "success",
      "execution_time_ms": 250,
      "llm_response_time_ms": 1500,
      "row_count": 10,
      "chart_recommendation": {
        "chart_type": "bar",
        "x_column": "customer_name",
        "y_column": "total_sales",
        "title": "Top 10 Customers"
      },
      "generated_at": "2025-12-06T18:30:00Z",
      "executed_at": "2025-12-06T18:30:01Z",
      "created_at": "2025-12-06T18:30:01Z"
    }
  ]
}
```

### PATCH /api/query-history/{query_id}/name
Update query name (rename)

**Request Body:**
```json
{
  "query_name": "Updated Query Name"
}
```

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query_name": "Customer Revenue Analysis"}' \
  "http://localhost:8000/api/query-history/123/name"
```

**Response:**
```json
{
  "success": true
}
```

### DELETE /api/query-history/{query_id}
Delete a query from history

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/query-history/123"
```

**Response:**
```json
{
  "success": true
}
```

### POST /api/query-history/manual
Execute and save manual SQL query

**Request Body:**
```json
{
  "sql": "SELECT * FROM customers WHERE region = 'US' LIMIT 100",
  "max_results": 500,
  "timeout_seconds": 30
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT COUNT(*) FROM orders WHERE status = '\''pending'\''",
    "max_results": 100
  }' \
  "http://localhost:8000/api/query-history/manual"
```

---

## Tab 2: Saved Queries (Bookmarks)

### GET /api/saved-queries
Get saved queries list

**Query Parameters:**
- `limit` (int, optional): Number of records (default: 50)
- `offset` (int, optional): Pagination offset (default: 0)
- `favorites_only` (bool, optional): Show only favorites (default: false)

**Example Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/saved-queries?limit=20&favorites_only=true"
```

**Response:**
```json
{
  "success": true,
  "queries": [
    {
      "id": 456,
      "query_name": "Customer Sales Analysis",
      "description": "Top customers by revenue with order metrics",
      "natural_language_query": "show me top 50 customers by sales",
      "generated_sql": "SELECT ...",
      "is_favorite": true,
      "tags": ["sales", "customers", "revenue"],
      "chart_recommendation": {
        "chart_type": "bar",
        "x_column": "customer_name",
        "y_column": "total_sales"
      },
      "execution_count": 15,
      "last_executed_at": "2025-12-06T15:20:00Z",
      "created_at": "2025-12-01T10:00:00Z",
      "updated_at": "2025-12-06T15:20:00Z"
    }
  ]
}
```

### GET /api/saved-queries/{query_id}
Get a specific saved query

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/saved-queries/456"
```

**Response:**
```json
{
  "success": true,
  "query": {
    "id": 456,
    "query_name": "Customer Sales Analysis",
    "description": "Top customers by revenue with order metrics",
    "natural_language_query": "show me top 50 customers by sales",
    "generated_sql": "SELECT c.name, SUM(o.amount) as total_sales ...",
    "is_favorite": true,
    "tags": ["sales", "customers"],
    "chart_recommendation": {...},
    "execution_count": 15,
    "last_executed_at": "2025-12-06T15:20:00Z",
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-06T15:20:00Z"
  }
}
```

### POST /api/saved-queries
Create a new saved query

**Request Body:**
```json
{
  "query_name": "Regional Sales Breakdown",
  "description": "Sales performance by geographic regions",
  "natural_language_query": "show me sales by region",
  "generated_sql": "SELECT region, SUM(amount) FROM orders GROUP BY region",
  "tags": ["sales", "regions"],
  "chart_recommendation": {
    "chart_type": "pie",
    "x_column": "region",
    "y_column": "total_sales"
  }
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query_name": "Monthly Revenue Trends",
    "description": "Revenue analysis by month for current year",
    "natural_language_query": "monthly revenue for 2025",
    "generated_sql": "SELECT MONTH(order_date), SUM(amount) ...",
    "tags": ["revenue", "trends", "monthly"]
  }' \
  "http://localhost:8000/api/saved-queries"
```

**Response:**
```json
{
  "success": true,
  "query_id": 789
}
```

### PUT /api/saved-queries/{query_id}
Update a saved query (full CRUD)

**Request Body:**
```json
{
  "query_name": "Updated Name",
  "description": "Updated description",
  "is_favorite": true,
  "tags": ["updated", "tags"]
}
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query_name": "Top 100 Customers by Revenue",
    "description": "Best customers ranked by total purchase amount",
    "is_favorite": true,
    "tags": ["customers", "revenue", "top-performers"]
  }' \
  "http://localhost:8000/api/saved-queries/456"
```

**Response:**
```json
{
  "success": true
}
```

### DELETE /api/saved-queries/{query_id}
Delete a saved query

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/saved-queries/456"
```

**Response:**
```json
{
  "success": true
}
```

### POST /api/saved-queries/from-history/{history_id}
Save a query from history to bookmarks

**Request Body:**
```json
{
  "query_name": "Saved from History",
  "description": "This query was useful, saving it for later"
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query_name": "Customer Sales Analysis",
    "description": "Top customers by revenue with order metrics"
  }' \
  "http://localhost:8000/api/saved-queries/from-history/123"
```

**Response:**
```json
{
  "success": true,
  "query_id": 456
}
```

---

## UI Integration Examples

### Frontend Component Structure

```typescript
// QueryManagement.tsx
interface QueryManagementProps {
  initialTab?: 'history' | 'saved';
}

function QueryManagement({ initialTab = 'history' }: QueryManagementProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  return (
    <div>
      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="history">Recent Queries</Tab>
        <Tab value="saved">Saved Queries</Tab>
      </Tabs>
      
      {/* Content */}
      {activeTab === 'history' && <QueryHistory />}
      {activeTab === 'saved' && <SavedQueries />}
    </div>
  );
}
```

### Tab 1: Recent Queries Component

```typescript
function QueryHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['query-history'],
    queryFn: () => fetch('/api/query-history?limit=50').then(r => r.json())
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/query-history/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(['query-history'])
  });
  
  const saveToBookmarks = useMutation({
    mutationFn: ({ historyId, name }: { historyId: number, name: string }) =>
      fetch(`/api/saved-queries/from-history/${historyId}`, {
        method: 'POST',
        body: JSON.stringify({ query_name: name })
      })
  });
  
  return (
    <div>
      {data?.queries.map(query => (
        <QueryCard
          key={query.id}
          query={query}
          onDelete={() => deleteMutation.mutate(query.id)}
          onSave={() => saveToBookmarks.mutate({ 
            historyId: query.id, 
            name: query.query_name || 'Saved Query'
          })}
          onRename={(newName) => updateQueryName(query.id, newName)}
        />
      ))}
    </div>
  );
}
```

### Tab 2: Saved Queries Component

```typescript
function SavedQueries() {
  const { data, isLoading } = useQuery({
    queryKey: ['saved-queries'],
    queryFn: () => fetch('/api/saved-queries?limit=50').then(r => r.json())
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/saved-queries/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(['saved-queries'])
  });
  
  const toggleFavorite = useMutation({
    mutationFn: ({ id, isFavorite }: { id: number, isFavorite: boolean }) =>
      fetch(`/api/saved-queries/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_favorite: isFavorite })
      })
  });
  
  return (
    <div>
      {data?.queries.map(query => (
        <SavedQueryCard
          key={query.id}
          query={query}
          onDelete={() => deleteMutation.mutate(query.id)}
          onToggleFavorite={() => toggleFavorite.mutate({ 
            id: query.id, 
            isFavorite: !query.is_favorite 
          })}
          onExecute={() => executeQuery(query)}
        />
      ))}
    </div>
  );
}
```

---

## Migration Steps

1. **Run Migration Scripts:**
   ```bash
   # Start db-init service
   docker compose -f docker/docker-compose.yml up db-init
   ```

2. **Rebuild Backend:**
   ```bash
   docker compose -f docker/docker-compose.yml build nexus
   docker compose -f docker/docker-compose.yml restart nexus
   ```

3. **Test Endpoints:**
   ```bash
   # Test history endpoint
   curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/query-history
   
   # Test saved queries endpoint
   curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/saved-queries
   ```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Query not found or access denied"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (no token)
- `403` - Forbidden (no permission)
- `404` - Not Found (query doesn't exist or no access)
- `500` - Internal Server Error

---

## Security

- All endpoints require authentication (`Bearer token`)
- User can only access their own queries
- Group-shared queries (future): Use `owner_group_id`

---

## Database Schema

### `nexus.query_history` (Tab 1)
- Automatic audit log
- Limited user editing (name only)
- Tracks all executions

### `nexus.saved_queries` (Tab 2)
- User bookmarks
- Full CRUD
- Tags, favorites, execution tracking
- Reference to history via `created_from_history_id`

