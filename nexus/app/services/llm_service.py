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
        schema_recommendations: Optional[Dict[str, Any]] = None,
        last_sql: Optional[str] = None,
        intent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate SQL from natural language query using external LLM API.
        
        Args:
            natural_language_query: User's query
            conversation_history: Previous conversation messages
            schema_recommendations: Recommended tables/schemas
            last_sql: Previous SQL (for REFINE/REJECT intents)
            intent: Detected user intent (for context-aware prompting)
        """
        
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
            # Build the prompt with schema context and previous SQL (for refinement intents)
            prompt = self._build_sql_prompt(
                natural_language_query, 
                schema_recommendations, 
                conversation_history,
                last_sql,
                intent
            )
            
            # Call external LLM API
            response = await self._call_external_llm(prompt)
            
            if not response.get("success"):
                return response
            
            # Extract SQL from response
            generated_text = response.get("content", "").strip()
            sql = self._extract_sql_from_response(generated_text)
            
            # Defensive: If no SQL, try to extract reasoning/guidance JSON
            if not sql:
                self.logger.info("No SQL found - checking for guidance/reasoning response")
                # Try to extract JSON with reasoning and suggestions
                import json
                import re
                
                # Try multiple JSON extraction strategies
                guidance = None
                
                # Strategy 1: JSON code block
                json_match = re.search(r'```json\s*(.*?)\s*```', generated_text, re.DOTALL)
                if json_match:
                    try:
                        guidance = json.loads(json_match.group(1).strip())
                    except json.JSONDecodeError:
                        pass
                
                # Strategy 2: Generic code block containing JSON
                if not guidance:
                    code_match = re.search(r'```\s*(json\s*)?\s*(\{.*?\})\s*```', generated_text, re.DOTALL)
                    if code_match:
                        try:
                            guidance = json.loads(code_match.group(2).strip())
                        except json.JSONDecodeError:
                            pass
                
                # Strategy 3: Look for raw JSON in text (no code block)
                if not guidance:
                    try:
                        start = generated_text.find('{')
                        end = generated_text.rfind('}') + 1
                        if start != -1 and end > start:
                            guidance = json.loads(generated_text[start:end])
                    except json.JSONDecodeError:
                        pass
                
                # If we found guidance JSON with reasoning/suggestions
                if guidance and ("reasoning" in guidance or "suggestions" in guidance):
                    self.logger.info("LLM provided guidance instead of SQL", 
                                   reasoning=guidance.get("reasoning", "")[:100] if guidance.get("reasoning") else "")
                    return {
                        "success": False,  # Mark as failure since no SQL was generated
                        "sql": None,  # No SQL generated
                        "reasoning": guidance.get("reasoning", "Unable to generate SQL for this request"),
                        "suggestions": guidance.get("suggestions", []),
                        "no_sql_reason": "invalid_or_unclear_request",
                        "error": "Unable to generate valid SQL from your request"
                    }
                
                # Fallback: No SQL and no valid guidance JSON
                self.logger.warning("No SQL or guidance found in LLM response", response_text=generated_text[:200])
                return {
                    "success": False,  # Mark as failure
                    "sql": None,
                    "reasoning": "I couldn't understand your request or find relevant tables in the database. Please try rephrasing your query or asking about specific data you need.",
                    "suggestions": [
                        "Try using clearer language with specific table or column names",
                        "Ask about available data: 'What tables are available?'",
                        "Provide a concrete example: 'Show me sales data for last month'"
                    ],
                    "no_sql_reason": "parsing_failed",
                    "error": "Unable to generate SQL from your request"
                }
            
            # Extract chart recommendations and reasoning from response
            chart_recommendation = self._extract_chart_recommendation(generated_text)
            
            # SAFETY NET: Fix malformed column names (e.g., "ccity" → "city")
            if chart_recommendation:
                chart_recommendation = self._fix_chart_column_names(sql, chart_recommendation)
            
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
        conversation_history: Optional[List[str]] = None,
        last_sql: Optional[str] = None,
        intent: Optional[str] = None
    ) -> str:
        """Build SQL generation prompt with schema context, previous SQL, and chart recommendations."""
        
        # Build strict prompt that enforces using ONLY provided tables
        prompt_parts = [
            "Expert Trino SQL developer. Generate query + chart recommendation."
        ]
        
        # Add previous SQL context for refinement/rejection/ambiguous intents
        if last_sql and intent in ["REJECT_RESULT", "REFINE_RESULT", "EXPLAIN_RESULT", "FOLLOW_UP_SAME_DOMAIN", "AMBIGUOUS"]:
            prompt_parts.append(f"\n=== PREVIOUS SQL ({intent}) ===")
            prompt_parts.append(f"```sql\n{last_sql}\n```")
            
            if intent == "REJECT_RESULT":
                prompt_parts.append("Previous result incorrect. Analyze and correct.")
            elif intent == "REFINE_RESULT":
                prompt_parts.append("Refine/optimize above query. Apply requested changes.")
                prompt_parts.append("If optimizing: analyze inefficiencies, optimize JOINs/predicates/CTEs, explain in reasoning.")
            elif intent == "FOLLOW_UP_SAME_DOMAIN":
                prompt_parts.append("Related analysis on same data. Build upon above query.")
            elif intent == "EXPLAIN_RESULT":
                prompt_parts.append("Explain above query's logic and results.")
            elif intent == "AMBIGUOUS":
                prompt_parts.append("Intent unclear. If request relates to above query, refine it. Otherwise, generate fresh query using available tables.")
            
            prompt_parts.append("="*40 + "\n")
        
        # Add schema context FIRST (before rules) to make it prominent
        recommendations = schema_recommendations.get("recommendations", []) if schema_recommendations else []
        
        if recommendations:
            prompt_parts.append("\n=== AVAILABLE TABLES (by relevance) ===")
            
            # Build table list with connector type, columns and confidence scores
            for rec in recommendations:
                confidence = rec.get('confidence', 0.0)
                connector_type = rec.get('connector_type', 'unknown')
                table_info = f"- {rec.get('full_name', 'unknown')} [connector: {connector_type}] ({confidence:.2f})"
                if rec.get('columns'):
                    columns_str = ", ".join(rec['columns'][:10])
                    table_info += f"\n  Cols: {columns_str}"
                prompt_parts.append(table_info)
            
            # Infer and add relationships hint
            relationships = self._infer_table_relationships(recommendations)
            if relationships:
                prompt_parts.append("\n=== TABLE RELATIONSHIPS ===")
                for rel in relationships:
                    prompt_parts.append(f"- {rel}")
            
            prompt_parts.append("="*40 + "\n")
        else:
            # Defensive: No schema recommendations available
            prompt_parts.append("\n=== NO TABLES FOUND ===")
            prompt_parts.append("No relevant tables found. DO NOT generate SQL.")
            prompt_parts.append("Provide reasoning + suggestions for rephrasing or alternative queries.")
            prompt_parts.append("="*40 + "\n")
        
        prompt_parts.extend([
            "SQL RULES:",
            "1. ONLY use tables from AVAILABLE TABLES list above",
            "2. No tables = no SQL (provide guidance instead)",
            "3. Use exact qualified names (catalog.schema.table)",
            "4. Trino SQL syntax (default), adapt for connector-specific features when needed",
            "5. Respect connector types: PostgreSQL, MySQL, MongoDB, Iceberg, Hive, etc.",
            "6. Text filters: use LOWER() for case-insensitive match",
            "",
            "CHART RULES:",
            "- Result columns drop prefixes: 'c.city' → 'city' NOT 'ccity'",
            "- With AS: 'c.city AS loc' → 'loc'",
            "- x_column/y_column must match exact result names",
            "",
            f"REQUEST: {query}"
        ])
        
        # Add conversation context if available (last 5 for better reasoning)
        if conversation_history:
            prompt_parts.append("\nHistory:")
            for msg in conversation_history[-5:]:  # LLM benefits from more context than FAISS
                prompt_parts.append(f"- {msg}")
        
        prompt_parts.append("\nEXAMPLES:")
        prompt_parts.append('Columns: SELECT c.city, SUM(o.amt) AS total → ["city", "total"] (NOT "ccity")')
        prompt_parts.append('Text filter: WHERE LOWER(city) = LOWER(\'Delhi\') (NOT city = \'Delhi\')')
        prompt_parts.append("")
        prompt_parts.append("FORMAT:")
        prompt_parts.append("With tables: ```sql\\nQUERY\\n```\\n```json\\n{\"reasoning\":\"...\",\"chart_type\":\"bar\",\"x_column\":\"...\",\"y_column\":\"...\",\"title\":\"...\"}\\n```")
        prompt_parts.append("No tables: ```json\\n{\"reasoning\":\"...\",\"suggestions\":[...]}\\n```")
        
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
    
    def _fix_chart_column_names(self, sql: str, chart_rec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Safety net: Fix malformed column names in chart recommendations.
        LLMs sometimes incorrectly concatenate table aliases with column names (e.g., 'ccity' instead of 'city').
        This function extracts actual column names from SQL and corrects the chart recommendation.
        """
        import re
        
        try:
            # Extract column names from SELECT clause
            select_match = re.search(r'SELECT\s+(.*?)\s+FROM', sql, re.IGNORECASE | re.DOTALL)
            if not select_match:
                self.logger.info("Safety net: No SELECT...FROM found in SQL")
                return chart_rec
            
            select_clause = select_match.group(1)
            
            # Extract column names (handling aliases)
            actual_columns = []
            # Pattern: capture either "col AS alias" or just "col"
            for part in select_clause.split(','):
                part = part.strip()
                # Check for AS alias
                if ' AS ' in part.upper():
                    alias = re.search(r'\sAS\s+(\w+)', part, re.IGNORECASE)
                    if alias:
                        actual_columns.append(alias.group(1))
                else:
                    # No alias - extract the column name (after the dot if qualified)
                    # Handle: "table.column" or "function(table.column)" or just "column"
                    col_match = re.search(r'\.(\w+)|\b(\w+)\s*$', part)
                    if col_match:
                        col_name = col_match.group(1) or col_match.group(2)
                        if col_name and col_name.upper() not in ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON']:
                            actual_columns.append(col_name)
            
            self.logger.info(f"Safety net: Extracted columns from SQL: {actual_columns}")
            
            if not actual_columns:
                self.logger.info("Safety net: No columns extracted")
                return chart_rec
            
            # Check and fix x_column
            x_col = chart_rec.get('x_column') or chart_rec.get('x_axis')
            self.logger.info(f"Safety net: Checking x_column='{x_col}' against {actual_columns}")
            if x_col and x_col not in actual_columns:
                # Try stripping first character (common pattern: ccity → city)
                if len(x_col) > 1 and x_col[1:] in actual_columns:
                    self.logger.warning(f"Safety net: Fixed malformed x_column: '{x_col}' → '{x_col[1:]}'")
                    chart_rec['x_column'] = x_col[1:]
                else:
                    self.logger.warning(f"Safety net: x_column '{x_col}' not found in SQL columns and can't auto-fix")
            
            # Check and fix y_column
            y_col = chart_rec.get('y_column') or chart_rec.get('y_axis')
            if y_col and y_col not in actual_columns:
                # Try stripping first character
                if len(y_col) > 1 and y_col[1:] in actual_columns:
                    self.logger.warning(f"Safety net: Fixed malformed y_column: '{y_col}' → '{y_col[1:]}'")
                    chart_rec['y_column'] = y_col[1:]
                else:
                    self.logger.warning(f"Safety net: y_column '{y_col}' not found in SQL columns and can't auto-fix")
            
            return chart_rec
        except Exception as e:
            self.logger.error(f"Safety net: Error in _fix_chart_column_names: {e}")
            return chart_rec  # Return unchanged on error
    
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
                # Validate it's actually SQL, not JSON
                if self._is_valid_sql(sql):
                    return sql
        
        # Look for generic code blocks
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                candidate = text[start:end].strip()
                
                # Skip if it starts with "json" or looks like JSON guidance
                first_line = candidate.split('\n')[0].strip().lower()
                if first_line in ['json', '{', 'javascript', 'js']:
                    # Check if it's a guidance JSON (contains reasoning/suggestions)
                    if any(keyword in candidate.lower() for keyword in ['"reasoning":', '"suggestions":', '"error":']):
                        return ""  # Not SQL, it's guidance
                
                # Check if it looks like SQL
                if self._is_valid_sql(candidate):
                    return candidate
        
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
            sql = "\n".join(sql_lines)
            if self._is_valid_sql(sql):
                return sql
        
        # No SQL found
        return ""
    
    def _is_valid_sql(self, text: str) -> bool:
        """Check if the text looks like valid SQL (not JSON or guidance)."""
        if not text:
            return False
        
        text_upper = text.strip().upper()
        
        # Must start with a SQL keyword
        sql_keywords = ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]
        if not any(text_upper.startswith(keyword) for keyword in sql_keywords):
            return False
        
        # Should NOT contain JSON guidance markers
        text_lower = text.lower()
        guidance_markers = ['"reasoning":', '"suggestions":', '"error":', '"message":']
        if any(marker in text_lower for marker in guidance_markers):
            return False
        
        # Should contain typical SQL keywords
        sql_structure_keywords = ["FROM", "WHERE", "JOIN", "SELECT"]
        if not any(keyword in text_upper for keyword in sql_structure_keywords):
            return False
        
        return True
    
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
