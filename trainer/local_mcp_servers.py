#!/usr/bin/env python3
"""
Local MCP server implementations for Trino connectivity and chart generation.
Provides the functionality of tuannvm/mcp-trino and antvis/mcp-server-chart locally.
"""

import json
import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import pandas as pd
import requests
from urllib.parse import quote

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TrinoConfig:
    host: str = "localhost"
    port: int = 8080
    catalog: str = "memory"
    schema: str = "default"
    user: str = "admin"
    auth_token: Optional[str] = None

class LocalTrinoMCP:
    """
    Local implementation of Trino MCP server functionality.
    Provides database connectivity and query execution capabilities.
    """
    
    def __init__(self, config: TrinoConfig):
        self.config = config
        self.base_url = f"http://{config.host}:{config.port}"
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Trino requests."""
        headers = {
            'X-Trino-User': self.config.user,
            'X-Trino-Catalog': self.config.catalog,
            'X-Trino-Schema': self.config.schema,
            'Content-Type': 'application/json'
        }
        
        if self.config.auth_token:
            headers['Authorization'] = f'Bearer {self.config.auth_token}'
        
        return headers
    
    async def execute_query(self, sql: str) -> Dict[str, Any]:
        """Execute SQL query via Trino."""
        try:
            if not self.session:
                raise RuntimeError("Session not initialized. Use async context manager.")
            
            headers = self._get_headers()
            
            # Submit query
            async with self.session.post(
                f"{self.base_url}/v1/statement",
                headers=headers,
                data=sql
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Query submission failed: {error_text}")
                    return {"error": f"Query failed: {error_text}"}
                
                result = await response.json()
                next_uri = result.get('nextUri')
                
                # If query completed immediately
                if not next_uri:
                    return {
                        "data": result.get('data', []),
                        "columns": [col['name'] for col in result.get('columns', [])],
                        "row_count": len(result.get('data', []))
                    }
                
                # Poll for results
                return await self._poll_results(next_uri, headers)
        
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            return {"error": str(e)}
    
    async def _poll_results(self, next_uri: str, headers: Dict[str, str]) -> Dict[str, Any]:
        """Poll for query results."""
        all_data = []
        columns = []
        
        while next_uri:
            try:
                async with self.session.get(next_uri, headers=headers) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        return {"error": f"Polling failed: {error_text}"}
                    
                    result = await response.json()
                    
                    # Get columns from first response
                    if not columns and 'columns' in result:
                        columns = [col['name'] for col in result['columns']]
                    
                    # Accumulate data
                    if 'data' in result:
                        all_data.extend(result['data'])
                    
                    next_uri = result.get('nextUri')
                    
                    # Small delay to avoid overwhelming the server
                    await asyncio.sleep(0.1)
            
            except Exception as e:
                logger.error(f"Polling error: {e}")
                return {"error": str(e)}
        
        return {
            "data": all_data,
            "columns": columns,
            "row_count": len(all_data)
        }
    
    async def list_catalogs(self) -> List[str]:
        """List available catalogs."""
        try:
            result = await self.execute_query("SHOW CATALOGS")
            if "error" in result:
                return []
            return [row[0] for row in result.get('data', [])]
        except Exception as e:
            logger.error(f"Failed to list catalogs: {e}")
            return []
    
    async def list_schemas(self, catalog: str = None) -> List[str]:
        """List schemas in a catalog."""
        try:
            catalog = catalog or self.config.catalog
            result = await self.execute_query(f"SHOW SCHEMAS FROM {catalog}")
            if "error" in result:
                return []
            return [row[0] for row in result.get('data', [])]
        except Exception as e:
            logger.error(f"Failed to list schemas: {e}")
            return []
    
    async def list_tables(self, catalog: str = None, schema: str = None) -> List[str]:
        """List tables in a schema."""
        try:
            catalog = catalog or self.config.catalog
            schema = schema or self.config.schema
            result = await self.execute_query(f"SHOW TABLES FROM {catalog}.{schema}")
            if "error" in result:
                return []
            return [row[0] for row in result.get('data', [])]
        except Exception as e:
            logger.error(f"Failed to list tables: {e}")
            return []
    
    async def get_table_schema(self, table: str, catalog: str = None, schema: str = None) -> Dict[str, Any]:
        """Get table schema information."""
        try:
            catalog = catalog or self.config.catalog
            schema = schema or self.config.schema
            result = await self.execute_query(f"DESCRIBE {catalog}.{schema}.{table}")
            if "error" in result:
                return {"error": result["error"]}
            
            columns = []
            for row in result.get('data', []):
                columns.append({
                    "name": row[0],
                    "type": row[1],
                    "nullable": row[2] if len(row) > 2 else True
                })
            
            return {
                "table": table,
                "catalog": catalog,
                "schema": schema,
                "columns": columns
            }
        except Exception as e:
            logger.error(f"Failed to get table schema: {e}")
            return {"error": str(e)}

class LocalChartMCP:
    """
    Local implementation of chart MCP server functionality.
    Provides chart generation capabilities using various libraries.
    """
    
    def __init__(self):
        self.supported_types = [
            'line', 'bar', 'column', 'pie', 'scatter', 'area',
            'heatmap', 'treemap', 'funnel', 'gauge', 'histogram',
            'box', 'violin', 'radar', 'sankey'
        ]
    
    def generate_chart_url(self, config: Dict[str, Any]) -> str:
        """Generate chart using QuickChart.io service."""
        try:
            chart_config = self._convert_to_chartjs(config)
            chart_json = json.dumps(chart_config)
            encoded_config = quote(chart_json)
            
            return f"https://quickchart.io/chart?c={encoded_config}"
        
        except Exception as e:
            logger.error(f"Chart generation failed: {e}")
            return None
    
    def _convert_to_chartjs(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Convert generic chart config to Chart.js format."""
        chart_type = config.get('type', 'bar')
        data = config.get('data', [])
        
        if not data:
            return {"type": "bar", "data": {"labels": [], "datasets": []}}
        
        # Convert data to Chart.js format
        if chart_type in ['line', 'bar', 'column']:
            return self._create_xy_chart(config)
        elif chart_type == 'pie':
            return self._create_pie_chart(config)
        elif chart_type == 'scatter':
            return self._create_scatter_chart(config)
        else:
            # Default to bar chart
            return self._create_xy_chart({**config, 'type': 'bar'})
    
    def _create_xy_chart(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create line/bar/column chart configuration."""
        data = config.get('data', [])
        x_field = config.get('xField', list(data[0].keys())[0] if data else 'x')
        y_field = config.get('yField', list(data[0].keys())[1] if len(data[0]) > 1 else 'y')
        
        labels = [str(row.get(x_field, '')) for row in data]
        values = [float(row.get(y_field, 0)) for row in data]
        
        chart_type = 'line' if config.get('type') == 'line' else 'bar'
        
        return {
            "type": chart_type,
            "data": {
                "labels": labels,
                "datasets": [{
                    "label": y_field.title(),
                    "data": values,
                    "backgroundColor": "rgba(54, 162, 235, 0.6)",
                    "borderColor": "rgba(54, 162, 235, 1)",
                    "borderWidth": 1
                }]
            },
            "options": {
                "responsive": True,
                "plugins": {
                    "title": {
                        "display": True,
                        "text": config.get('title', f'{chart_type.title()} Chart')
                    }
                }
            }
        }
    
    def _create_pie_chart(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create pie chart configuration."""
        data = config.get('data', [])
        color_field = config.get('colorField', list(data[0].keys())[0] if data else 'category')
        angle_field = config.get('angleField', list(data[0].keys())[1] if len(data[0]) > 1 else 'value')
        
        labels = [str(row.get(color_field, '')) for row in data]
        values = [float(row.get(angle_field, 0)) for row in data]
        
        return {
            "type": "pie",
            "data": {
                "labels": labels,
                "datasets": [{
                    "data": values,
                    "backgroundColor": [
                        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0",
                        "#9966FF", "#FF9F40", "#FF6384", "#C9CBCF"
                    ]
                }]
            },
            "options": {
                "responsive": True,
                "plugins": {
                    "title": {
                        "display": True,
                        "text": config.get('title', 'Pie Chart')
                    }
                }
            }
        }
    
    def _create_scatter_chart(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create scatter chart configuration."""
        data = config.get('data', [])
        x_field = config.get('xField', list(data[0].keys())[0] if data else 'x')
        y_field = config.get('yField', list(data[0].keys())[1] if len(data[0]) > 1 else 'y')
        
        scatter_data = [
            {"x": float(row.get(x_field, 0)), "y": float(row.get(y_field, 0))}
            for row in data
        ]
        
        return {
            "type": "scatter",
            "data": {
                "datasets": [{
                    "label": f'{x_field} vs {y_field}',
                    "data": scatter_data,
                    "backgroundColor": "rgba(255, 99, 132, 0.6)"
                }]
            },
            "options": {
                "responsive": True,
                "plugins": {
                    "title": {
                        "display": True,
                        "text": config.get('title', 'Scatter Chart')
                    }
                },
                "scales": {
                    "x": {"title": {"display": True, "text": x_field.title()}},
                    "y": {"title": {"display": True, "text": y_field.title()}}
                }
            }
        }

# Factory functions for easy usage
def create_trino_client(config: TrinoConfig = None) -> LocalTrinoMCP:
    """Create a Trino MCP client."""
    config = config or TrinoConfig()
    return LocalTrinoMCP(config)

def create_chart_client() -> LocalChartMCP:
    """Create a Chart MCP client."""
    return LocalChartMCP()

if __name__ == "__main__":
    # Test the implementations
    async def test_trino():
        config = TrinoConfig()
        async with create_trino_client(config) as trino:
            # Test with a simple query
            result = await trino.execute_query("SELECT 1 as test")
            print("Trino test result:", result)
    
    def test_chart():
        chart_client = create_chart_client()
        test_data = [
            {"category": "A", "value": 100},
            {"category": "B", "value": 150},
            {"category": "C", "value": 80}
        ]
        
        config = {
            "type": "bar",
            "data": test_data,
            "xField": "category",
            "yField": "value",
            "title": "Test Chart"
        }
        
        chart_url = chart_client.generate_chart_url(config)
        print("Chart URL:", chart_url)
    
    # Run tests
    print("Testing Chart MCP...")
    test_chart()
    
    print("\nTesting Trino MCP...")
    asyncio.run(test_trino())
