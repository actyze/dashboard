# Model Servers

## Overview
FastAPI servers that host and serve the ML models for the dashboard application.

## Files
- **`dual_model_server.py`**: Main FastAPI server hosting both SQL generation and chart selection models
- **`local_mcp_servers.py`**: Local MCP (Model Context Protocol) server implementations
- **`requirements.txt`**: Python dependencies for model servers

## Dual Model Server
Hosts both models in a single FastAPI application:

### Endpoints
- `POST /predict`: SQL generation from natural language using CodeT5+
- `POST /chart`: Chart type recommendation using Enhanced Chart Selector
- `POST /query`: Execute SQL queries (mock implementation)
- `GET /health`: Health check endpoint

### Usage
```bash
cd models/servers
pip install -r requirements.txt
python dual_model_server.py
```

Server runs on `http://localhost:8000`

## Local MCP Servers
Mock implementations of MCP protocol for development:
- **Trino MCP**: Simulates Trino database connectivity
- **Chart MCP**: Provides chart generation via QuickChart.io

## Integration
- Used by Kubernetes FastAPI deployment
- Integrated with Spring Boot backend via HTTP calls
- Supports both local development and production deployment

## Configuration
Model paths are configurable via environment variables:
- `SQL_MODEL_PATH`: Path to CodeT5+ model
- `CHART_MODEL_PATH`: Path to chart selection model
