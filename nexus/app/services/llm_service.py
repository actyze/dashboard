"""LLM service client for SQL generation using external APIs."""

import json
import httpx
import structlog
from typing import List, Dict, Any, Optional
from app.config import settings


class LLMService:
    """Client for external LLM-based SQL generation."""
    
    def __init__(self):
        self.logger = structlog.get_logger().bind(service="llm-service")
        self.client = httpx.AsyncClient(timeout=settings.external_llm_timeout)
    
    async def generate_sql(
        self,
        natural_language_query: str,
        conversation_history: Optional[List[str]] = None,
        schema_recommendations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate SQL from natural language query using external LLM API."""
        
        if not settings.external_llm_enabled:
            return {
                "success": False,
                "error": "External LLM is not enabled",
                "error_type": "CONFIGURATION_ERROR"
            }
        
        self.logger.info(
            "Generating SQL with external LLM",
            query=natural_language_query,
            provider=settings.external_llm_provider,
            model=settings.external_llm_model,
            history_size=len(conversation_history) if conversation_history else 0,
            schema_count=len(schema_recommendations.get("recommendations", [])) if schema_recommendations else 0
        )
        
        try:
            # Build the prompt with schema context
            prompt = self._build_sql_prompt(natural_language_query, schema_recommendations, conversation_history)
            
            # Call external LLM API
            response = await self._call_external_llm(prompt)
            
            if not response.get("success"):
                return response
            
            # Extract SQL from response
            generated_text = response.get("content", "").strip()
            sql = self._extract_sql_from_response(generated_text)
            
            if not sql:
                self.logger.error("No SQL found in LLM response", response_text=generated_text[:200])
                return {
                    "success": False,
                    "error": "No valid SQL found in LLM response",
                    "error_type": "PARSING_ERROR"
                }
            
            # Extract chart recommendations from response
            chart_recommendation = self._extract_chart_recommendation(generated_text)
            
            self.logger.info(
                "SQL generated successfully",
                sql_length=len(sql),
                provider=settings.external_llm_provider,
                has_chart_recommendation=chart_recommendation is not None
            )
            
            result = {
                "success": True,
                "sql": sql,
                "confidence": 0.85,  # Default confidence for external LLM
                "reasoning": "Generated using external LLM API",
                "model_info": {
                    "provider": settings.external_llm_provider,
                    "model": settings.external_llm_model
                }
            }
            
            # Add chart recommendation if found
            if chart_recommendation:
                result["chart_recommendation"] = chart_recommendation
            
            return result
            
        except Exception as e:
            self.logger.error("Failed to generate SQL with external LLM", error=str(e))
            return {
                "success": False,
                "error": f"External LLM error: {str(e)}",
                "error_type": "API_ERROR"
            }
    
    async def generate_corrected_sql(
        self,
        original_query: str,
        failed_sql: str,
        sql_error: str,
        error_type: str,
        schema_recommendations: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[str]] = None,
        error_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generate corrected SQL based on previous error."""
        
        # Build enhanced prompt with error context
        enhanced_prompt = f"""
CORRECTION NEEDED: The previous SQL query failed.

Original request: {original_query}
Failed SQL: {failed_sql}
Error: {sql_error}
Error type: {error_type}

Please generate a corrected SQL query that fixes this error.
Focus on proper Trino SQL syntax and table/column names.
"""
        
        self.logger.info(
            "Generating corrected SQL",
            original_query=original_query,
            error_type=error_type,
            retry_attempt=len(error_history) if error_history else 1
        )
        
        return await self.generate_sql(
            enhanced_prompt,
            conversation_history,
            schema_recommendations
        )
    
    async def generate_chart_sql(
        self,
        natural_language_query: str,
        main_sql: str,
        schema_recommendations: Optional[Dict[str, Any]] = None,
        row_count: Optional[int] = None,
        is_limited: Optional[bool] = False
    ) -> Dict[str, Any]:
        """Generate chart configuration and SQL."""
        
        messages = self._build_chart_messages(
            natural_language_query, 
            main_sql, 
            schema_recommendations,
            row_count,
            is_limited
        )
        
        try:
            response = await self._call_external_llm(messages=messages)
            
            if not response.get("success"):
                return response
            
            content = response.get("content", "")
            # Try to extract JSON first, otherwise parse the text
            import re
            import json
            
            chart_config = {}
            
            # Look for JSON block
            json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
            if json_match:
                try:
                    chart_config = json.loads(json_match.group(1))
                except:
                    pass
            
            if not chart_config:
                # Try parsing raw JSON if no code block
                try:
                    # Remove non-json text around the first { and last }
                    start = content.find("{")
                    end = content.rfind("}") + 1
                    if start != -1 and end != -1:
                        chart_config = json.loads(content[start:end])
                except:
                    pass
            
            if not chart_config:
                return {
                    "success": False,
                    "error": "Failed to parse chart configuration from LLM",
                    "raw_response": content
                }
                
            # Extract SQL if not in JSON (or if JSON parsing failed but SQL block exists)
            if "sql" not in chart_config:
                sql = self._extract_sql_from_response(content)
                if sql:
                    chart_config["sql"] = sql
            
            return {
                "success": True,
                "chart_config": chart_config
            }
            
        except Exception as e:
            self.logger.error("Chart generation failed", error=str(e))
            return {"success": False, "error": str(e)}

    def _build_chart_messages(
        self,
        query: str,
        main_sql: str,
        schema_recommendations: Optional[Dict[str, Any]] = None,
        row_count: Optional[int] = None,
        is_limited: Optional[bool] = False
    ) -> List[Dict[str, str]]:
        """Build messages for chart generation with system/user roles."""
        
        system_prompt = """You are a data visualization expert using Plotly.js with Trino SQL.

Available chart types:
- Basic: bar, line, area, scatter, pie
- Statistical: histogram, box, violin, histogram2d
- Scientific: heatmap, contour, scatter3d, surface
- Financial: candlestick, ohlc, waterfall, funnel
- Hierarchical: treemap, sunburst
- Flow: sankey
- Other: radar, parcoords (parallel coordinates), scatterpolar

CRITICAL SQL RULES:
- ALWAYS use fully qualified table names: catalog.schema.table (e.g., postgres.demo_ecommerce.customers)
- Copy the exact table paths from the main SQL provided - do NOT shorten them
- Use Trino SQL syntax (not PostgreSQL or MySQL specific syntax)

Task:
1. Analyze the user's request and data to suggest the BEST chart type.
2. Write a NEW SQL query specifically optimized for this chart.
   - MUST use fully qualified table names (catalog.schema.table) exactly as shown in the main SQL
   - MUST aggregate data (GROUP BY) if the main SQL does not
   - Limit results appropriately (e.g. 20-50 for bar/pie, 100-500 for line/scatter)
   - Use correct Trino SQL syntax
3. Identify axis/dimension columns based on chart type.

Return ONLY a JSON object:
{
  "type": "bar",
  "sql": "SELECT category, SUM(value) as total FROM postgres.schema.table GROUP BY category ORDER BY total DESC LIMIT 20",
  "title": "Descriptive Chart Title",
  "x_axis": "column_name",
  "y_axis": "column_name",
  "series": "optional_grouping_column",
  "orientation": "v or h (for bar charts)",
  "mode": "lines, markers, lines+markers (for scatter/line)"
}
"""
        user_content = f"""User Request: "{query}"
Generated SQL (Main Data):
```sql
{main_sql}
```
"""
        
        if row_count is not None:
            if is_limited:
                user_content += f"\nNote: The main query returned {row_count} rows (TRUNCATED at limit). The actual dataset is likely larger. Ensure your chart SQL includes proper aggregation and grouping.\n"
            else:
                user_content += f"\nNote: The main query returned {row_count} rows (complete result set). Consider appropriate aggregation for visualization.\n"
        
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

    def _build_chart_prompt(
        self,
        query: str,
        main_sql: str,
        schema_recommendations: Optional[Dict[str, Any]] = None
    ) -> str:
        # Deprecated in favor of _build_chart_messages
        return ""

    async def aclose(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    def _build_sql_prompt(
        self, 
        query: str, 
        schema_recommendations: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[str]] = None
    ) -> str:
        """Build SQL generation prompt with schema context and chart recommendations."""
        
        prompt_parts = [
            "You are an expert SQL developer and data visualization specialist.",
            "Generate a Trino SQL query for the following request, AND recommend the best chart configuration.",
            "\nRules for SQL:",
            "- Use Trino SQL syntax",
            "- Include proper table aliases",
            "- Use appropriate JOINs when needed",
            "- Format the query cleanly",
            "\nRules for Chart Recommendation:",
            "- Identify which column should be the X-axis (usually a category/dimension like name, date, category)",
            "- Identify which column should be the Y-axis (usually a measure/metric like sales, count, amount)",
            "- Recommend the best chart type: bar, line, pie, scatter, area, histogram",
            "- Consider: bar for comparisons, line for trends over time, pie for parts of whole, scatter for correlations",
            "\nRequest: " + query
        ]
        
        # Add schema context if available
        if schema_recommendations and schema_recommendations.get("recommendations"):
            prompt_parts.append("\nAvailable tables and schemas:")
            for rec in schema_recommendations["recommendations"][:5]:  # Top 5 recommendations
                table_info = f"- {rec.get('full_name', 'unknown')} (confidence: {rec.get('confidence', 0):.2f})"
                if rec.get('columns'):
                    table_info += f" - Columns: {rec['columns'][:100]}..."
                prompt_parts.append(table_info)
        
        # Add conversation context if available
        if conversation_history:
            prompt_parts.append("\nPrevious conversation:")
            for msg in conversation_history[-3:]:  # Last 3 messages
                prompt_parts.append(f"- {msg}")
        
        prompt_parts.append("\nRespond in this EXACT format:")
        prompt_parts.append("```sql")
        prompt_parts.append("YOUR SQL QUERY HERE")
        prompt_parts.append("```")
        prompt_parts.append("```json")
        prompt_parts.append('{"chart_type": "bar", "x_column": "column_name", "y_column": "column_name", "title": "Chart Title"}')
        prompt_parts.append("```")
        
        return "\n".join(prompt_parts)
    
    async def _call_external_llm(self, prompt: str = None, messages: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Call external LLM API using OpenAI-compatible format (works with all providers)."""
        
        try:
            return await self._call_openai_compatible_api(prompt, messages)
        except Exception as e:
            self.logger.error("External LLM API call failed", error=str(e))
            return {
                "success": False,
                "error": f"API call failed: {str(e)}",
                "error_type": "NETWORK_ERROR"
            }
    
    async def _call_openai_compatible_api(self, prompt: str = None, messages: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Call OpenAI-compatible API (works with OpenAI, Perplexity, Claude, etc.)."""
        
        headers = {
            "Authorization": f"Bearer {settings.external_llm_api_key}",
            "Content-Type": "application/json"
        }
        
        # Construct messages if not provided
        if not messages:
            if not prompt:
                raise ValueError("Either 'prompt' or 'messages' must be provided")
            messages = [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        
        payload = {
            "model": settings.external_llm_model,
            "messages": messages,
            "max_tokens": settings.external_llm_max_tokens,
            "temperature": settings.external_llm_temperature
        }
        
        # Use complete endpoint URL (includes provider-specific path)
        endpoint = settings.external_llm_base_url
        
        self.logger.debug("=== EXTERNAL LLM API CALL ===")
        self.logger.debug("Endpoint", url=endpoint)
        self.logger.debug("Making API call to External LLM...")
        self.logger.debug(
            "LLM Configuration", 
            provider=settings.external_llm_provider,
            model=settings.external_llm_model,
            max_tokens=settings.external_llm_max_tokens,
            temperature=settings.external_llm_temperature
        )
        
        response = await self.client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        
        self.logger.debug("=== EXTERNAL LLM API RESPONSE ===")
        self.logger.debug("Response Status", status_code=response.status_code)
        self.logger.debug("Response Headers", headers=dict(response.headers))
        
        result = response.json()
        
        if result:
            self.logger.debug("Response Body Keys", keys=list(result.keys()))
            self.logger.debug("Raw Response Body", body=str(result)[:500] + "..." if len(str(result)) > 500 else str(result))
        
        if "choices" not in result or not result["choices"]:
            return {
                "success": False,
                "error": f"No response from {settings.external_llm_provider} API",
                "error_type": "API_ERROR"
            }
        
        content = result["choices"][0]["message"]["content"]
        
        return {
            "success": True,
            "content": content
        }
    
    def _extract_sql_from_response(self, response_text: str) -> str:
        """Extract SQL query from LLM response."""
        
        # Remove markdown code blocks
        text = response_text.strip()
        
        # Look for SQL code blocks
        if "```sql" in text.lower():
            start = text.lower().find("```sql") + 6
            end = text.find("```", start)
            if end != -1:
                sql = text[start:end].strip()
                return sql
        
        # Look for generic code blocks
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                sql = text[start:end].strip()
                # Check if it looks like SQL
                if any(keyword in sql.upper() for keyword in ["SELECT", "INSERT", "UPDATE", "DELETE", "WITH"]):
                    return sql
        
        # Look for SQL keywords at the start of lines
        lines = text.split("\n")
        sql_lines = []
        in_sql = False
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Start of SQL
            if any(line.upper().startswith(keyword) for keyword in ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE"]):
                in_sql = True
                sql_lines = [line]
            elif in_sql:
                # Continue SQL if line looks like SQL
                if any(keyword in line.upper() for keyword in ["FROM", "WHERE", "JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", ";"]):
                    sql_lines.append(line)
                elif line.endswith(";"):
                    sql_lines.append(line)
                    break
                else:
                    # End of SQL block
                    break
        
        if sql_lines:
            return "\n".join(sql_lines)
    
    def _extract_chart_recommendation(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Extract chart recommendation JSON from LLM response."""
        import re
        
        try:
            # Look for JSON code block
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL | re.IGNORECASE)
            if json_match:
                json_str = json_match.group(1).strip()
                chart_rec = json.loads(json_str)
                
                # Validate required fields
                if chart_rec.get('x_column') and chart_rec.get('y_column'):
                    return {
                        "chart_type": chart_rec.get('chart_type', 'bar'),
                        "x_column": chart_rec.get('x_column'),
                        "y_column": chart_rec.get('y_column'),
                        "title": chart_rec.get('title', ''),
                        "series_column": chart_rec.get('series_column')
                    }
            
            # Fallback: Look for JSON object anywhere in text
            json_pattern = r'\{[^{}]*"(?:x_column|y_column|chart_type)"[^{}]*\}'
            json_match = re.search(json_pattern, response_text, re.IGNORECASE)
            if json_match:
                try:
                    chart_rec = json.loads(json_match.group(0))
                    if chart_rec.get('x_column') and chart_rec.get('y_column'):
                        return {
                            "chart_type": chart_rec.get('chart_type', 'bar'),
                            "x_column": chart_rec.get('x_column'),
                            "y_column": chart_rec.get('y_column'),
                            "title": chart_rec.get('title', ''),
                            "series_column": chart_rec.get('series_column')
                        }
                except:
                    pass
            
            self.logger.debug("No chart recommendation found in LLM response")
            return None
            
        except Exception as e:
            self.logger.warning("Failed to parse chart recommendation", error=str(e))
            return None
        
        # Fallback: return the whole response if it contains SQL keywords
        if any(keyword in text.upper() for keyword in ["SELECT", "FROM", "WHERE"]):
            return text
        
        return ""
