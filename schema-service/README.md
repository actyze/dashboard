# FAISS Schema Service

Intelligent database schema recommendation service using FAISS vector search and sentence transformers. This service connects to Trino databases, creates vector embeddings of all table schemas, and provides intelligent table recommendations for natural language queries.

## Features

- **Automatic Schema Discovery**: Connects to Trino and loads all catalogs, schemas, tables, and column metadata
- **Vector Embeddings**: Uses sentence transformers to create semantic embeddings of database schemas
- **FAISS Search**: Fast similarity search using Facebook's FAISS library
- **Auto-Refresh**: Refreshes schema embeddings every 3 hours (configurable)
- **RESTful API**: FastAPI-based service with comprehensive endpoints
- **Docker Support**: Containerized deployment with health checks
- **Configurable Catalogs**: Include/exclude TPC-H for dev vs production

## Architecture

```
Natural Language Query → Sentence Transformer → FAISS Search → Schema Recommendations
                                ↑
                        Trino Database Schemas (Auto-refreshed every 3 hours)
```

## API Endpoints

### POST `/recommend`
Get schema recommendations for a natural language query.

**Request:**
```json
{
  "natural_language_query": "Show me customer sales data",
  "top_k": 5,
  "confidence_threshold": 0.3
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "rank": 1,
      "catalog": "sales_db",
      "schema": "public",
      "table": "customer_orders",
      "full_name": "sales_db.public.customer_orders",
      "confidence_score": 0.85,
      "column_count": 12,
      "columns": ["customer_id", "order_date", "total_amount", "..."],
      "column_types": ["bigint", "date", "decimal", "varchar"],
      "sample_columns": [
        {"name": "customer_id", "type": "bigint", "nullable": false},
        {"name": "order_date", "type": "date", "nullable": false}
      ]
    }
  ],
  "query_embedding_time": 0.023,
  "search_time": 0.001,
  "total_schemas": 1247
}
```

### GET `/health`
Health check endpoint.

### POST `/refresh`
Manually trigger schema refresh.

### GET `/schemas`
List all loaded schemas.

## Configuration

Environment variables (see `.env.example`):

- `TRINO_HOST`: Trino server hostname (default: localhost)
- `TRINO_PORT`: Trino server port (default: 8080)
- `TRINO_USER`: Trino username (default: admin)
- `TRINO_CATALOG`: Optional default catalog
- `SCHEMA_REFRESH_HOURS`: Hours between automatic refreshes (default: 3)
- `INCLUDE_TPCH`: Include TPC-H in schema loading (default: false)
  - Set to `true` for local/dev to test with TPC-H sample data
  - Set to `false` for production to exclude sample data
- `SENTENCE_TRANSFORMER_MODEL`: Model name (default: all-MiniLM-L6-v2)

## Installation

### Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your Trino connection details
```

3. Run the service:
```bash
python schema_service.py
```

### Docker Deployment

1. Build the image:
```bash
docker build -t faiss-schema-service .
```

2. Run the container:
```bash
docker run -d \
  --name schema-service \
  -p 8001:8001 \
  -e TRINO_HOST=your-trino-host \
  -e TRINO_PORT=8080 \
  -e TRINO_USER=admin \
  faiss-schema-service
```

## Integration with Dashboard

The schema service integrates with the dashboard's OrchestrationService to provide intelligent table recommendations:

1. **Natural Language Query** → Schema Service recommends relevant tables
2. **Table Context** → Passed to CodeT5+ model for better SQL generation
3. **Enhanced SQL** → More accurate queries with proper table references

### Integration Example

```python
# In OrchestrationService.java
import requests

def getSchemaRecommendations(String nlQuery) {
    Map<String, Object> request = new HashMap<>();
    request.put("natural_language_query", nlQuery);
    request.put("top_k", 3);
    request.put("confidence_threshold", 0.4);
    
    ResponseEntity<Map> response = restTemplate.postForEntity(
        "http://schema-service:8001/recommend",
        request,
        Map.class
    );
    
    return response.getBody();
}
```

## Performance

- **Startup Time**: ~30-60 seconds (model download + schema loading)
- **Query Time**: ~25ms average (embedding + search)
- **Memory Usage**: ~500MB-1GB (depends on schema count and model)
- **Refresh Time**: ~2-5 minutes (depends on database size)

## Model Details

- **Sentence Transformer**: `all-MiniLM-L6-v2` (384 dimensions)
- **FAISS Index**: IndexFlatIP (Inner Product for cosine similarity)
- **Embedding Strategy**: Combines table names, column names, types, and comments
- **Search Method**: Cosine similarity with configurable confidence threshold

## Monitoring

The service provides comprehensive logging and metrics:

- Schema loading progress and errors
- Embedding generation time
- Search performance metrics
- Automatic refresh status
- API request/response logging

## Troubleshooting

### Common Issues

1. **Trino Connection Failed**
   - Check TRINO_HOST, TRINO_PORT, TRINO_USER
   - Verify network connectivity
   - Check Trino server status

2. **Model Download Slow**
   - First startup downloads sentence transformer model
   - Use persistent volume for model cache in production

3. **High Memory Usage**
   - Reduce schema count by filtering catalogs/schemas
   - Use smaller sentence transformer model
   - Increase container memory limits

4. **Search Results Poor**
   - Adjust confidence_threshold (lower = more results)
   - Increase top_k for more recommendations
   - Check if schemas have descriptive column names/comments
