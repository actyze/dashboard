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
            
            # Extract chart recommendations and reasoning from response
            chart_recommendation = self._extract_chart_recommendation(generated_text)
            reasoning = self._extract_reasoning(generated_text, chart_recommendation)
            
            self.logger.info(
                "SQL generated successfully",
                sql_length=len(sql),
                provider=settings.external_llm_provider,
                has_chart_recommendation=chart_recommendation is not None,
                has_reasoning=bool(reasoning)
            )
            
            result = {
                "success": True,
                "sql": sql,
                "confidence": 0.85,  # Default confidence for external LLM
                "reasoning": reasoning,
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
            
            # Strip thinking tags before JSON extraction
            clean_content = content
            clean_content = re.sub(r'<think>.*?</think>', '', clean_content, flags=re.DOTALL | re.IGNORECASE)
            clean_content = re.sub(r'<thinking>.*?</thinking>', '', clean_content, flags=re.DOTALL | re.IGNORECASE)
            clean_content = re.sub(r'<reasoning>.*?</reasoning>', '', clean_content, flags=re.DOTALL | re.IGNORECASE)
            clean_content = clean_content.strip()
            
            chart_config = {}
            
            # Look for JSON block in cleaned content
            json_match = re.search(r"```json\s*(.*?)\s*```", clean_content, re.DOTALL)
            if json_match:
                try:
                    chart_config = json.loads(json_match.group(1))
                except:
                    pass
            
            if not chart_config:
                # Try parsing raw JSON if no code block
                try:
                    # Remove non-json text around the first { and last }
                    start = clean_content.find("{")
                    end = clean_content.rfind("}") + 1
                    if start != -1 and end != -1:
                        chart_config = json.loads(clean_content[start:end])
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
        
        # Build strict prompt that enforces using ONLY provided tables
        prompt_parts = [
            "You are an expert SQL developer and data visualization specialist.",
            "Generate a Trino SQL query for the following request, AND recommend the best chart configuration."
        ]
        
        # Add schema context FIRST (before rules) to make it prominent
        if schema_recommendations and schema_recommendations.get("recommendations"):
            prompt_parts.append("\n=== AVAILABLE TABLES (USE ONLY THESE) ===")
            
            # Build table list with columns
            tables_info = []
            for rec in schema_recommendations["recommendations"][:7]:  # Top 7 recommendations
                table_info = f"- {rec.get('full_name', 'unknown')}"
                if rec.get('columns'):
                    columns_str = ", ".join(rec['columns'][:10])  # Show first 10 columns
                    table_info += f"\n  Columns: {columns_str}"
                tables_info.append(table_info)
                prompt_parts.append(table_info)
            
            # Infer and add relationships hint
            relationships = self._infer_table_relationships(schema_recommendations["recommendations"][:7])
            if relationships:
                prompt_parts.append("\n=== INFERRED TABLE RELATIONSHIPS ===")
                for rel in relationships:
                    prompt_parts.append(f"- {rel}")
            
            prompt_parts.append("===========================================\n")
        
        prompt_parts.extend([
            "CRITICAL RULES FOR SQL:",
            "1. YOU MUST ONLY USE TABLES FROM THE 'AVAILABLE TABLES' LIST ABOVE",
            "2. DO NOT use tables from your training data (tpch, tpcds, etc.) - ONLY use the provided tables",
            "3. Use the EXACT full table names as shown (catalog.schema.table)",
            "4. Use Trino SQL syntax",
            "5. Include proper table aliases",
            "6. Use appropriate JOINs when needed",
            "7. Format the query cleanly",
            "",
            "CRITICAL RULES FOR CHART RECOMMENDATIONS:",
            "- The x_column and y_column MUST BE ACTUAL COLUMN ALIASES FROM YOUR SQL SELECT LIST",
            "- If you need customer name, create it in SQL: CONCAT(first_name, ' ', last_name) AS customer_name",
            "- DO NOT recommend column names that don't exist in your SELECT clause",
            "- X-axis: category/dimension (name, date, category, product, etc.)",
            "- Y-axis: measure/metric (sales, count, amount, quantity, etc.)",
            "- Chart types: bar (comparisons), line (trends), pie (parts of whole), scatter (correlations)",
            "",
            f"User Request: {query}"
        ])
        
        # Add conversation context if available
        if conversation_history:
            prompt_parts.append("\nPrevious conversation:")
            for msg in conversation_history[-3:]:  # Last 3 messages
                prompt_parts.append(f"- {msg}")
        
        prompt_parts.append("\nEXAMPLE - Correct way to handle column names:")
        prompt_parts.append("If you SELECT first_name, last_name separately, you have TWO options:")
        prompt_parts.append("Option 1: Concatenate in SQL and use the alias:")
        prompt_parts.append("```sql")
        prompt_parts.append("SELECT CONCAT(first_name, ' ', last_name) AS customer_name, SUM(amount) AS total")
        prompt_parts.append("```")
        prompt_parts.append('```json\n{"x_column": "customer_name", "y_column": "total"}\n```')
        prompt_parts.append("")
        prompt_parts.append("Option 2: Use an existing column:")
        prompt_parts.append("```sql")
        prompt_parts.append("SELECT first_name, SUM(amount) AS total")
        prompt_parts.append("```")
        prompt_parts.append('```json\n{"x_column": "first_name", "y_column": "total"}\n```')
        prompt_parts.append("")
        prompt_parts.append("\nRespond in this EXACT format:")
        prompt_parts.append("```sql")
        prompt_parts.append("YOUR SQL QUERY HERE")
        prompt_parts.append("```")
        prompt_parts.append("```json")
        prompt_parts.append('{')
        prompt_parts.append('  "reasoning": "Brief explanation of table selection, joins, filters used (max 2 sentences)",')
        prompt_parts.append('  "chart_type": "bar",')
        prompt_parts.append('  "x_column": "actual_column_from_your_SELECT_clause",')
        prompt_parts.append('  "y_column": "actual_column_from_your_SELECT_clause",')
        prompt_parts.append('  "title": "Chart Title"')
        prompt_parts.append('}')
        prompt_parts.append("```")
        prompt_parts.append("\nREMINDER: x_column and y_column must EXACTLY match column names/aliases in your SELECT clause!")
        
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
        import re
        
        # Original text for fallback
        text = response_text.strip()
        
        # STRATEGY 1: Try to extract SQL from inside thinking tags FIRST (before stripping)
        # This handles LLMs that put SQL inside <think> tags
        thinking_patterns = [
            r'<think>(.*?)</think>',
            r'<thinking>(.*?)</thinking>',
            r'<reasoning>(.*?)</reasoning>'
        ]
        
        for pattern in thinking_patterns:
            match = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
            if match:
                thinking_content = match.group(1)
                # Try to extract SQL from thinking content
                sql_from_thinking = self._try_extract_sql(thinking_content)
                if sql_from_thinking:
                    self.logger.debug("SQL found inside thinking tags", sql_length=len(sql_from_thinking))
                    return sql_from_thinking
        
        # STRATEGY 2: Strip thinking tags and extract from remaining text
        # This handles LLMs that put SQL outside thinking tags
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = text.strip()
        
        # Try to extract SQL from stripped text
        return self._try_extract_sql(text)
    
    def _infer_table_relationships(self, tables: List[Dict[str, Any]]) -> List[str]:
        """
        Infer foreign key relationships between tables based on column names.
        LLM-agnostic approach: Use naming conventions to suggest likely JOINs.
        """
        relationships = []
        
        # Build a map of table -> columns
        table_columns = {}
        for table in tables:
            full_name = table.get('full_name', '')
            table_name = table.get('table', '')
            columns = []
            for col in table.get('columns', []):
                # Column format is "name|type"
                col_name = col.split('|')[0] if '|' in col else col
                columns.append(col_name.lower())
            table_columns[full_name] = {
                'table_name': table_name,
                'columns': columns,
                'schema': table.get('schema', '')
            }
        
        # Pattern matching for common foreign key relationships
        for table1_full, table1_data in table_columns.items():
            for table2_full, table2_data in table_columns.items():
                if table1_full == table2_full:
                    continue
                
                # Strategy 1: Look for table_name_id pattern
                # e.g., "customer_id" in orders table -> customers table
                for col in table1_data['columns']:
                    # Match patterns like: customer_id, product_id, order_id
                    if col.endswith('_id'):
                        base_name = col[:-3]  # Remove '_id'
                        # Check if there's a table matching this base name
                        table2_name_lower = table2_data['table_name'].lower()
                        
                        # Handle both singular and plural
                        if (base_name == table2_name_lower or 
                            base_name + 's' == table2_name_lower or
                            base_name == table2_name_lower.rstrip('s')):
                            
                            # Check if table2 has a matching primary key
                            if col in table2_data['columns'] or base_name + '_id' in table2_data['columns']:
                                relationships.append(
                                    f"{table1_full} → {table2_full} via {col}"
                                )
        
        # Strategy 2: Look for junction tables (many-to-many)
        # e.g., order_items connects orders and products
        for table_full, table_data in table_columns.items():
            table_name = table_data['table_name'].lower()
            # Check if this might be a junction table
            if '_' in table_name:
                parts = table_name.split('_')
                if len(parts) == 2:
                    # Check if both parts match other tables
                    part1_matches = [t for t, d in table_columns.items() if parts[0] in d['table_name'].lower()]
                    part2_matches = [t for t, d in table_columns.items() if parts[1].rstrip('s') in d['table_name'].lower()]
                    
                    if part1_matches and part2_matches:
                        for t1 in part1_matches[:1]:  # Only first match
                            for t2 in part2_matches[:1]:
                                if t1 != table_full and t2 != table_full:
                                    relationships.append(
                                        f"{table_full} bridges {t1} ↔ {t2}"
                                    )
        
        return relationships[:5]  # Limit to top 5 most relevant relationships
    
    def _try_extract_sql(self, text: str) -> str:
        """Helper method to try extracting SQL from text using multiple strategies."""
        if not text:
            return ""
        
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
        
        # No SQL found
        return ""
    
    def _extract_chart_recommendation(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Extract chart recommendation JSON from LLM response."""
        import re
        import json
        
        try:
            # STRATEGY 1: Try extracting from inside thinking tags first
            thinking_patterns = [
                r'<think>(.*?)</think>',
                r'<thinking>(.*?)</thinking>',
                r'<reasoning>(.*?)</reasoning>'
            ]
            
            for pattern in thinking_patterns:
                match = re.search(pattern, response_text, flags=re.DOTALL | re.IGNORECASE)
                if match:
                    thinking_content = match.group(1)
                    chart_rec = self._try_extract_chart_json(thinking_content)
                    if chart_rec:
                        self.logger.debug("Chart recommendation found inside thinking tags")
                        return chart_rec
            
            # STRATEGY 2: Strip thinking tags and extract from remaining text
            text = response_text
            text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = text.strip()
            
            return self._try_extract_chart_json(text)
            
        except Exception as e:
            self.logger.warning("Failed to parse chart recommendation", error=str(e))
            return None
    
    def _try_extract_chart_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Helper method to extract chart JSON from text."""
        import re
        import json
        
        try:
            # Look for JSON code block
            json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
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
            json_match = re.search(json_pattern, text, re.IGNORECASE)
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
            
            return None
            
        except Exception as e:
            self.logger.debug("Could not extract chart JSON from text segment")
            return None
    
    def _extract_reasoning(self, response_text: str, chart_rec: Optional[Dict[str, Any]] = None) -> str:
        """Extract reasoning from LLM response or chart recommendation JSON."""
        import re
        
        try:
            # First, try to extract reasoning from the JSON block (where chart recommendation is)
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL | re.IGNORECASE)
            if json_match:
                json_str = json_match.group(1).strip()
                data = json.loads(json_str)
                reasoning = data.get('reasoning', '').strip()
                if reasoning:
                    return reasoning
            
            # If chart_rec was already parsed, it might have reasoning
            if chart_rec and isinstance(chart_rec, dict):
                reasoning = chart_rec.get('reasoning', '').strip()
                if reasoning:
                    return reasoning
            
            # Fallback: return generic message
            return "Query generated based on schema analysis"
            
        except Exception as e:
            self.logger.warning("Failed to extract reasoning", error=str(e))
            return "Query generated using AI"
        
        # Fallback: return the whole response if it contains SQL keywords
        if any(keyword in text.upper() for keyword in ["SELECT", "FROM", "WHERE"]):
            return text
        
        return ""
