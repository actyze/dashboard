"""Main orchestration service that coordinates the workflow."""

import asyncio
from typing import List, Dict, Any, Optional
import structlog
from app.config import settings
from app.services.schema_service import SchemaService
from app.services.llm_service import LLMService
from app.services.trino_service import TrinoService
from app.services.cache_factory import cache_service
from app.services.user_service import UserService
from app.services.sql_error_analysis_service import SqlErrorAnalysisService
from app.services.preference_service import preference_service

logger = structlog.get_logger()


class OrchestrationService:
    """Main orchestration service that coordinates the natural language to SQL workflow."""
    
    def __init__(self):
        self.schema_service = SchemaService()
        self.llm_service = LLMService()
        self.trino_service = TrinoService()
        self.cache_service = cache_service
        self.user_service = UserService()
        self.error_analysis_service = SqlErrorAnalysisService()
        self.preference_service = preference_service
        self.logger = logger.bind(service="orchestration-service")
    
    async def initialize(self):
        """Initialize all services."""
        await self.cache_service.connect()
        self.logger.info("Orchestration service initialized")
    
    async def shutdown(self):
        """Shutdown all services."""
        await self.cache_service.disconnect()
        await self.schema_service.client.aclose()
        await self.llm_service.client.aclose()
        self.logger.info("Orchestration service shutdown")

    async def generate_sql_from_nl(
        self,
        nl_query: str,
        conversation_history: Optional[List[str]] = None,
        session_id: Optional[str] = None,
        last_sql: Optional[str] = None,
        last_schema_recommendations: Optional[List[Dict[str, Any]]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Step 1 & 2: Generate SQL from Natural Language using Schema Service and LLM.
        
        NEW: Implements ML-based intent detection to prevent schema hallucination.
        Only calls schema narrowing for NEW_QUERY intent.
        """
        conversation_history = conversation_history or []
        start_time = asyncio.get_event_loop().time()
        
        self.logger.info("Generating SQL from NL", 
            query=nl_query, 
            has_context=bool(last_sql),
            context_source="frontend" if last_sql or last_schema_recommendations else "none"
        )
        
        try:
            # STEP 0: Intent Detection (NEW - prevents hallucination)
            self.logger.info("=== STEP 0: INTENT DETECTION ===")
            
            intent_result = await self.schema_service.detect_intent(nl_query)
            intent = intent_result.get("intent", "AMBIGUOUS")
            intent_confidence = intent_result.get("confidence", 0.0)
            
            self.logger.info(
                "Intent detected",
                intent=intent,
                confidence=f"{intent_confidence:.3f}",
                will_reuse_schema=(intent not in ["NEW_QUERY", "AMBIGUOUS"])
            )
            
            # SPECIAL CASE: ACCEPT_RESULT - User is satisfied, no new SQL needed
            if intent == "ACCEPT_RESULT":
                if last_sql:
                    self.logger.info("Intent is ACCEPT_RESULT - returning previous SQL without LLM call")
                    processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
                    return {
                        "success": True,
                        "nl_query": nl_query,
                        "generated_sql": last_sql,
                        "schema_recommendations": last_schema_recommendations or [],
                        "model_confidence": 1.0,
                        "model_reasoning": "User accepted the previous result. Returning the same SQL.",
                        "processing_time": processing_time,
                        "intent": intent,
                        "intent_confidence": intent_confidence,
                        "no_llm_call": True
                    }
                else:
                    # No previous SQL to return, treat as AMBIGUOUS
                    self.logger.warning("Intent is ACCEPT_RESULT but no previous SQL - treating as AMBIGUOUS")
                    intent = "AMBIGUOUS"
            
            # STEP 1: Schema Recommendations (conditional based on intent)
            self.logger.info("=== STEP 1: SCHEMA RECOMMENDATIONS (CONDITIONAL) ===")
            
            recommendations = []
            schema_recommendations = {"success": False}  # Initialize to avoid NameError
            
            # Only call schema narrowing for NEW_QUERY or AMBIGUOUS
            if intent in ["NEW_QUERY", "AMBIGUOUS"]:
                self.logger.info(f"Intent is {intent} - fetching fresh schema recommendations")
                
                cached_schema = await self.cache_service.get_schema_recommendations(
                    nl_query, conversation_history
                )
                
                if cached_schema:
                    self.logger.info("Using cached schema recommendations")
                    schema_recommendations = cached_schema
                else:
                    # Request top K recommendations from config
                    # Let LLM decide what to do with the results (no confidence filtering)
                    schema_recommendations = await self.schema_service.get_recommendations(
                        nl_query, conversation_history,
                        max_recommendations=settings.schema_service_max_recommendations,
                        confidence_threshold=settings.schema_service_confidence_threshold
                    )
                    if schema_recommendations.get("success"):
                        await self.cache_service.cache_schema_recommendations(
                            nl_query, conversation_history, schema_recommendations
                        )
                
                # Defensive: Even if schema service fails or returns 0 results, continue to LLM
                # LLM can provide helpful guidance to user
                if not schema_recommendations.get("success"):
                    self.logger.warning(f"Schema service failed: {schema_recommendations.get('error')}, continuing to LLM anyway")
                    schema_recommendations = {
                        "success": True,
                        "recommendations": [],
                        "error": schema_recommendations.get("error")
                    }
                
                recommendations = schema_recommendations.get("recommendations", []) or []
                
                # Apply user preference boost if user_id is provided
                if user_id and recommendations:
                    recommendations = await self._apply_preference_boost(user_id, recommendations)
            
            else:
                # REFINE_RESULT, REJECT_RESULT, EXPLAIN_RESULT, FOLLOW_UP_SAME_DOMAIN
                self.logger.info(f"Intent is {intent} - reusing previous schema context from frontend")
                
                # Reuse last schema recommendations passed from frontend
                if last_schema_recommendations:
                    recommendations = last_schema_recommendations
                    self.logger.info(f"Reused schema from frontend (count={len(recommendations)})")
                else:
                    self.logger.warning("No previous schema from frontend, falling back to fresh recommendations")
                    # Fallback to fresh schema recommendations (use config values)
                    schema_recommendations = await self.schema_service.get_recommendations(
                        nl_query, conversation_history,
                        max_recommendations=settings.schema_service_max_recommendations,
                        confidence_threshold=settings.schema_service_confidence_threshold
                    )
                    if schema_recommendations.get("success"):
                        recommendations = schema_recommendations.get("recommendations", []) or []
                    else:
                        # Defensive: Continue even if schema service fails
                        recommendations = []
                
                # Apply user preference boost if user_id is provided
                if user_id and recommendations:
                    recommendations = await self._apply_preference_boost(user_id, recommendations)
                
                # Construct schema_recommendations dict for LLM (CRITICAL FIX)
                # Only construct if we got recommendations from session/params (not from fallback)
                if recommendations:
                    schema_recommendations = {
                        "success": True,
                        "recommendations": recommendations,
                        "query": nl_query
                    }
                    self.logger.info(f"Constructed schema_recommendations dict from reused schema (count={len(recommendations)})")
            
            # Step 2: Generate SQL using LLM
            self.logger.info("=== STEP 2: SQL GENERATION (LLM) ===")
            
            # Check SQL generation cache first (more consistent than LLM response cache)
            cached_sql_result = await self.cache_service.get_generated_sql(nl_query, intent)
            if cached_sql_result:
                self.logger.info("Using cached SQL generation result")
                processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
                cached_sql_result["processing_time"] = processing_time
                cached_sql_result["cache_hit"] = True
                cached_sql_result["intent"] = intent
                cached_sql_result["intent_confidence"] = intent_confidence
                return cached_sql_result
            
            cache_key = f"{nl_query}_{len(conversation_history)}_{len(recommendations)}"
            cached_response = await self.cache_service.get_llm_response(
                cache_key, {"type": "sql_generation"}
            )
            
            if cached_response:
                # Check if cache is old format (string) or new format (dict)
                if isinstance(cached_response, str):
                    self.logger.info("Using cached SQL generation (legacy format)")
                    sql_generation = {
                        "success": True,
                        "sql": cached_response,
                        "confidence": 0.85,
                        "reasoning": "Retrieved from cache"
                    }
                else:
                    self.logger.info("Using cached SQL generation (full response)", 
                        has_chart_rec=bool(cached_response.get("chart_recommendation")),
                        has_reasoning=bool(cached_response.get("reasoning"))
                    )
                    sql_generation = cached_response
            else:
                # Pass intent and last_sql for context-aware prompting
                sql_generation = await self.llm_service.generate_sql(
                    nl_query, 
                    conversation_history, 
                    schema_recommendations,
                    last_sql=last_sql,
                    intent=intent
                )
                # Cache the entire response (SQL + chart_recommendation + reasoning)
                if sql_generation.get("success") and sql_generation.get("sql"):
                    await self.cache_service.cache_llm_response(
                        cache_key, {"type": "sql_generation"}, sql_generation
                    )
            
            if not sql_generation.get("success"):
                # Check if this is a "graceful no-SQL" response with guidance
                reasoning = sql_generation.get("reasoning")
                suggestions = sql_generation.get("suggestions", [])
                
                if reasoning or suggestions:
                    # LLM provided guidance instead of SQL - pass it through
                    processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
                    self.logger.info("LLM provided guidance instead of SQL", 
                                   has_reasoning=bool(reasoning),
                                   suggestions_count=len(suggestions))
                    return {
                        "success": False,
                        "nl_query": nl_query,
                        "generated_sql": None,
                        "schema_recommendations": recommendations,
                        "model_reasoning": reasoning,
                        "suggestions": suggestions,
                        "processing_time": processing_time,
                        "intent": intent,
                        "intent_confidence": intent_confidence,
                        "error": sql_generation.get("error", "Unable to generate SQL"),
                        "error_type": sql_generation.get("error_type", "NO_SQL_GENERATED")
                    }
                
                # Otherwise, it's a real error (API failure, etc.)
                error_msg = sql_generation.get("error", "SQL generation failed")
                error_type = sql_generation.get("error_type", "SQL_GENERATION_ERROR")
                user_friendly_error = self.error_analysis_service.get_user_friendly_error(error_type, error_msg)
                return self._create_error_response(user_friendly_error, error_type, start_time)
            
            generated_sql = sql_generation.get("sql", "").strip() if sql_generation.get("sql") else None
            
            # Defensive: If no SQL was generated (e.g., no relevant tables), return guidance instead
            if not generated_sql:
                reasoning = sql_generation.get("reasoning", "Unable to generate SQL query.")
                suggestions = sql_generation.get("suggestions", [])
                processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
                
                self.logger.info("No SQL generated - returning guidance to user", reasoning=reasoning[:100])
                
                return {
                    "success": False,  # False because no SQL was generated
                    "nl_query": nl_query,
                    "generated_sql": None,
                    "schema_recommendations": recommendations,
                    "model_reasoning": reasoning,
                    "suggestions": suggestions,
                    "processing_time": processing_time,
                    "intent": intent,
                    "intent_confidence": intent_confidence,
                    "error": "No relevant tables found for this query",
                    "error_type": "NO_SCHEMA_MATCH"
                }
            
            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
            
            result = {
                "success": True,
                "nl_query": nl_query,
                "generated_sql": generated_sql,
                "schema_recommendations": recommendations,
                "model_confidence": sql_generation.get("confidence"),
                "model_reasoning": sql_generation.get("reasoning"),
                "processing_time": processing_time
            }
            
            # Include chart recommendation if LLM provided one
            if sql_generation.get("chart_recommendation"):
                chart_rec = sql_generation.get("chart_recommendation")
                
                # Validate and fix column names to match actual SQL columns
                validated_chart = self._validate_chart_columns(chart_rec, generated_sql)
                
                if validated_chart:
                    result["chart_recommendation"] = validated_chart
                    self.logger.info("Chart recommendation validated and included", 
                        chart_type=validated_chart.get("chart_type"),
                        x_column=validated_chart.get("x_column"),
                        y_column=validated_chart.get("y_column"),
                        was_fixed=validated_chart.get("x_column") != chart_rec.get("x_column")
                    )
                else:
                    self.logger.warning("Chart recommendation validation failed - columns don't match SQL",
                        recommended_x=chart_rec.get("x_column"),
                        recommended_y=chart_rec.get("y_column")
                    )
            
            # Include intent in response (frontend will handle state)
            result["intent"] = intent
            result["intent_confidence"] = intent_confidence
            
            # Cache successful SQL generation for deterministic responses
            await self.cache_service.cache_generated_sql(nl_query, intent, result)
            
            return result
            
        except Exception as e:
            self.logger.error("SQL generation error", error=str(e))
            return self._create_error_response(f"Generation error: {str(e)}", "PROCESSING_ERROR", start_time)

    async def process_natural_language_workflow(
        self,
        nl_query: str,
        conversation_history: Optional[List[str]] = None,
        include_chart: bool = False,
        chart_type: Optional[str] = None,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main workflow orchestration - coordinates all services.
        Flow: NL Query → Schema Service → LLM Service → SQL Execution Service
        """
        
        # Ensure conversation_history is always a list
        conversation_history = conversation_history or []
        
        self.logger.info("Processing natural language workflow", query=nl_query)
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Step 1 & 2: Generate SQL (with intent detection)
            # Note: process_natural_language_workflow expects context to be passed from caller
            generation_result = await self.generate_sql_from_nl(
                nl_query, 
                conversation_history,
                session_id=session_id
            )
            
            if not generation_result.get("success"):
                return generation_result
            
            generated_sql = generation_result["generated_sql"]
            recommendations = generation_result.get("schema_recommendations", [])
            
            self.logger.info("SQL generated successfully", sql=generated_sql[:100])
            
            # Step 3: Execute SQL with retry logic
            self.logger.info("=== STEP 3: SQL EXECUTION WITH RETRY ===")
            
            # Re-construct schema_recommendations dict for correction callback
            schema_recs_dict = {"success": True, "recommendations": recommendations}
            
            # Check cache first
            cache_params = {
                "max_results": settings.default_max_results,
                "timeout": settings.default_timeout_seconds
            }
            cached_result = await self.cache_service.get_query_result(generated_sql, cache_params)
            
            if cached_result:
                self.logger.info("Using cached query result")
                sql_result = cached_result
            else:
                sql_result = await self.trino_service.execute_with_retry(
                    nl_query,
                    generated_sql,
                    settings.default_max_results,
                    settings.default_timeout_seconds,
                    settings.max_retries,
                    self._create_correction_callback(schema_recs_dict, conversation_history)
                )
                
                # Cache successful results
                if sql_result.get("success"):
                    await self.cache_service.cache_query_result(
                        generated_sql, cache_params, sql_result
                    )
            
            # Step 4: Build final response
            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
            
            response = {
                "success": sql_result.get("success", False),
                "nl_query": nl_query,
                "generated_sql": sql_result.get("final_sql", generated_sql),
                "query_results": sql_result.get("query_results"),
                "schema_recommendations": recommendations,
                "model_confidence": generation_result.get("model_confidence"),
                "model_reasoning": generation_result.get("model_reasoning"),
                "processing_time": processing_time,
                "execution_time": sql_result.get("execution_time"),
                "retry_attempts": sql_result.get("retry_attempts", 0),
                "error_history": sql_result.get("error_history", [])
            }
            
            # Include chart recommendation if available
            if generation_result.get("chart_recommendation"):
                response["chart_recommendation"] = generation_result["chart_recommendation"]
                self.logger.info("Chart recommendation added to workflow response",
                    chart_type=generation_result["chart_recommendation"].get("chart_type")
                )
            
            if not sql_result.get("success"):
                response.update({
                    "error": sql_result.get("error"),
                    "error_type": sql_result.get("error_type")
                })
            
            # Step 5: Save to user history if user_id and session_id provided
            if user_id and session_id:
                try:
                    await self.user_service.save_conversation_message(
                        user_id=user_id,
                        session_id=session_id,
                        message_type="user",
                        message_content=nl_query,
                        metadata={"schema_recommendations_count": len(recommendations)}
                    )
                    
                    assistant_message = f"Generated SQL: {response['generated_sql']}"
                    if response.get("error"):
                        assistant_message = f"Error: {response['error']}"
                    
                    await self.user_service.save_conversation_message(
                        user_id=user_id,
                        session_id=session_id,
                        message_type="assistant",
                        message_content=assistant_message,
                        metadata={
                            "model_confidence": response.get("model_confidence"),
                            "execution_time": response.get("execution_time"),
                            "retry_attempts": response.get("retry_attempts")
                        }
                    )
                    
                    # Calculate timestamps
                    from datetime import datetime, timedelta
                    execution_end = datetime.utcnow()
                    # Estimate generation time based on processing_time - execution_time
                    llm_time_ms = int((response.get("processing_time", 0) or 0) - (response.get("execution_time", 0) or 0))
                    execution_time_ms = int(response.get("execution_time", 0) or 0)
                    
                    # Calculate generated_at (before execution)
                    generated_at = execution_end - timedelta(milliseconds=execution_time_ms) if execution_time_ms > 0 else execution_end
                    
                    await self.user_service.save_query_execution(
                        user_id=user_id,
                        session_id=session_id,
                        natural_language_query=nl_query,
                        generated_sql=response.get("generated_sql"),
                        execution_status="success" if response["success"] else "error",
                        execution_time_ms=execution_time_ms,
                        row_count=response.get("query_results", {}).get("row_count") if response.get("query_results") else None,
                        error_message=response.get("error"),
                        schema_recommendations={"recommendations": recommendations},
                        model_confidence=response.get("model_confidence"),
                        retry_attempts=response.get("retry_attempts", 0),
                        query_type='natural_language',
                        chart_recommendation=response.get("chart_recommendation"),
                        llm_response_time_ms=llm_time_ms if llm_time_ms > 0 else None,
                        generated_at=generated_at,
                        executed_at=execution_end
                    )
                    
                except Exception as e:
                    self.logger.warning("Failed to save user history", error=str(e))
            
            return response
            
        except Exception as e:
            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self.logger.error("Workflow processing error", error=str(e))
            return self._create_error_response(
                f"Workflow processing error: {str(e)}", "PROCESSING_ERROR", start_time
            )
    
    def _create_correction_callback(self, schema_recommendations, conversation_history):
        """Create callback function for SQL error correction with enhanced analysis."""
        async def correction_callback(
            original_query, failed_sql, sql_error, error_type, error_history
        ):
            # Analyze error type for better correction strategy
            analyzed_error_type = self.error_analysis_service.analyze_error_type(sql_error)
            
            # Check if this error type should be retried
            if not self.error_analysis_service.should_retry_error(analyzed_error_type):
                self.logger.warning("Error type not suitable for retry", error_type=analyzed_error_type)
                return {
                    "success": False,
                    "error": f"Cannot automatically fix {analyzed_error_type.lower().replace('_', ' ')}",
                    "error_type": analyzed_error_type
                }
            
            # Build enhanced error correction prompt
            enhanced_prompt = self.error_analysis_service.build_enhanced_error_prompt(
                original_query, failed_sql, sql_error, analyzed_error_type, error_history
            )
            
            self.logger.debug("Using enhanced error correction", 
                            original_error_type=error_type, 
                            analyzed_error_type=analyzed_error_type)
            
            # Generate corrected SQL using enhanced prompt
            return await self.llm_service.generate_sql(
                enhanced_prompt, conversation_history, schema_recommendations
            )
        return correction_callback
    
    def _create_error_response(self, message: str, error_type: str, start_time: float) -> Dict[str, Any]:
        """Create standardized error response."""
        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        return {
            "success": False,
            "error": message,
            "error_type": error_type,
            "processing_time": processing_time
        }
    
    def _validate_chart_columns(self, chart_rec: Dict[str, Any], sql: str) -> Optional[Dict[str, Any]]:
        """
        Validate that chart x_column and y_column exist in the SQL SELECT clause.
        If they don't match, try to fix them automatically.
        """
        import re
        
        try:
            # Extract column names/aliases from FINAL SELECT clause (handle CTEs)
            # If there are CTEs (WITH clause), we need the LAST SELECT, not the first
            
            # Find all SELECT...FROM patterns
            select_patterns = list(re.finditer(r'SELECT\s+(.*?)\s+FROM', sql, re.IGNORECASE | re.DOTALL))
            if not select_patterns:
                self.logger.warning("Could not parse SELECT clause from SQL")
                return None
            
            # Use the LAST SELECT (the final query, not CTE)
            select_match = select_patterns[-1]
            select_clause = select_match.group(1)
            
            # Extract column aliases (handle AS keyword and implicit aliases)
            # Patterns: "column AS alias", "expression AS alias", "column" (implicit)
            columns = []
            for part in select_clause.split(','):
                part = part.strip()
                # Check for AS alias
                as_match = re.search(r'\s+AS\s+(\w+)', part, re.IGNORECASE)
                if as_match:
                    columns.append(as_match.group(1).lower())
                else:
                    # Handle table-qualified columns (e.g., "c.city" → "city", not "ccity")
                    # Extract column name after the dot if present, otherwise use the word
                    words = part.split()
                    if words:
                        last_word = words[-1]
                        # Check for table.column pattern
                        if '.' in last_word:
                            # Extract just the column name (after the dot)
                            col_name = last_word.split('.')[-1]
                            # Clean up any trailing special chars
                            col_name = re.sub(r'[^\w]', '', col_name)
                            if col_name:
                                columns.append(col_name.lower())
                        else:
                            # No dot - just clean up special chars
                            col_name = re.sub(r'[^\w]', '', last_word)
                            if col_name:
                                columns.append(col_name.lower())
            
            self.logger.info("Extracted SQL columns", columns=columns)
            
            x_col = chart_rec.get("x_column", "").lower()
            y_col = chart_rec.get("y_column", "").lower()
            
            # Check if recommended columns exist
            x_exists = x_col in columns
            y_exists = y_col in columns
            
            if x_exists and y_exists:
                # Perfect - columns match
                return chart_rec
            
            # Try to fix mismatched columns
            fixed_rec = chart_rec.copy()
            
            # Fix X column
            if not x_exists:
                # Try common mappings
                if x_col == "customer_name" and ("first_name" in columns or "last_name" in columns):
                    fixed_rec["x_column"] = "first_name"  # Use first available name field
                    self.logger.info("Fixed x_column", original=x_col, fixed="first_name")
                elif x_col == "product_name" and "product_name" not in columns and "product_id" in columns:
                    fixed_rec["x_column"] = "product_id"
                    self.logger.info("Fixed x_column", original=x_col, fixed="product_id")
                elif columns:
                    # Fallback: use first column
                    fixed_rec["x_column"] = columns[0]
                    self.logger.info("Fixed x_column to first column", original=x_col, fixed=columns[0])
                else:
                    self.logger.warning("Cannot fix x_column", original=x_col, available=columns)
                    return None
            
            # Fix Y column
            if not y_exists:
                # Try to find numeric/aggregate column
                numeric_keywords = ['total', 'sum', 'count', 'avg', 'amount', 'sales', 'revenue', 'price']
                numeric_col = next((col for col in columns if any(kw in col for kw in numeric_keywords)), None)
                if numeric_col:
                    fixed_rec["y_column"] = numeric_col
                    self.logger.info("Fixed y_column", original=y_col, fixed=numeric_col)
                elif len(columns) > 1:
                    # Use second column as fallback
                    fixed_rec["y_column"] = columns[1]
                    self.logger.info("Fixed y_column to second column", original=y_col, fixed=columns[1])
                else:
                    self.logger.warning("Cannot fix y_column", original=y_col, available=columns)
                    return None
            
            return fixed_rec
            
        except Exception as e:
            self.logger.error("Chart validation error", error=str(e))
            return chart_rec  # Return original if validation fails
    
    async def generate_chart_data(
        self,
        nl_query: str,
        main_sql: str,
        schema_context: Optional[Dict[str, Any]] = None,
        row_count: Optional[int] = None,
        is_limited: Optional[bool] = False
    ) -> Dict[str, Any]:
        """Generate aggregated data specifically for charting."""
        
        start_time = asyncio.get_event_loop().time()
        self.logger.info("Generating chart data", query=nl_query, row_count=row_count, is_limited=is_limited)
        
        try:
            # Step 1: Get Chart SQL from LLM
            chart_gen_result = await self.llm_service.generate_chart_sql(
                nl_query, main_sql, schema_context, row_count, is_limited
            )
            
            if not chart_gen_result.get("success"):
                return {
                    "success": False,
                    "error": chart_gen_result.get("error", "Chart generation failed")
                }
            
            config = chart_gen_result.get("chart_config", {})
            chart_sql = config.get("sql")
            
            if not chart_sql:
                return {"success": False, "error": "LLM did not return chart SQL"}
            
            # Step 2: Execute Chart SQL
            self.logger.info("Executing Chart SQL", sql=chart_sql[:100])
            
            # Use simple execution (no retry logic needed for auxiliary chart query usually)
            # Set a tighter limit for charts
            result = await self.trino_service.execute_query(chart_sql, max_results=1000, timeout_seconds=20)
            
            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
            
            if not result.get("success"):
                self.logger.error("Chart SQL execution failed", error=result.get("error"), sql=chart_sql)
                return {
                    "success": False,
                    "error": result.get("error"),
                    "chart_config": config,
                    "chart_sql": chart_sql
                }
            
            # Trino service returns query_results with columns and rows
            query_results = result.get("query_results", {})
            
            return {
                "success": True,
                "chart_config": config,
                "chart_data": {
                    "columns": query_results.get("columns"),
                    "rows": query_results.get("rows")
                },
                "processing_time": processing_time
            }
            
        except Exception as e:
            self.logger.error("Chart data generation error", error=str(e))
            return {"success": False, "error": str(e)}

    async def execute_sql_directly(
        self,
        sql: str,
        max_results: int = 100,
        timeout_seconds: int = 30,
        nl_query: Optional[str] = None,
        conversation_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Execute SQL directly, with optional retry logic if NL query is provided."""
        
        self.logger.info("Executing SQL directly", sql=sql[:100], has_nl_context=bool(nl_query))
        
        # Check cache first
        cache_params = {"max_results": max_results, "timeout": timeout_seconds}
        cached_result = await self.cache_service.get_query_result(sql, cache_params)
        
        if cached_result:
            self.logger.info("Using cached query result")
            return {
                "success": cached_result.get("success", False),
                "original_sql": sql,
                "query_results": cached_result.get("query_results"),
                "execution_time": cached_result.get("execution_time"),
                "error": cached_result.get("error")
            }
        
        # If NL context provided, use retry logic
        if nl_query:
            conversation_history = conversation_history or []
            
            # Get schema recommendations for correction context
            cached_schema = await self.cache_service.get_schema_recommendations(
                nl_query, conversation_history
            )
            schema_recs_dict = cached_schema if cached_schema else {"success": True, "recommendations": []}
            
            result = await self.trino_service.execute_with_retry(
                nl_query,
                sql,
                max_results,
                timeout_seconds,
                settings.max_retries,
                self._create_correction_callback(schema_recs_dict, conversation_history)
            )
        else:
            # Simple execution
            result = await self.trino_service.execute_query(sql, max_results, timeout_seconds)
        
        # Cache successful results
        if result.get("success"):
            await self.cache_service.cache_query_result(sql, cache_params, result)
        
        return {
            "success": result.get("success", False),
            "original_sql": sql,
            "query_results": result.get("query_results"),
            "execution_time": result.get("execution_time"),
            "error": result.get("error")
        }
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get health status of all services."""
        
        self.logger.info("Checking service health")
        
        # Check all services concurrently
        health_checks = await asyncio.gather(
            self.schema_service.health_check(),
            self.llm_service.health_check(),
            self.trino_service.health_check(),
            return_exceptions=True
        )
        
        services = []
        overall_healthy = True
        
        for health_check in health_checks:
            if isinstance(health_check, Exception):
                services.append({
                    "name": "unknown",
                    "healthy": False,
                    "error": str(health_check)
                })
                overall_healthy = False
            else:
                services.append(health_check)
                if not health_check.get("healthy", False):
                    overall_healthy = False
        
        # Add cache service status
        cache_stats = await self.cache_service.get_stats()
        services.append({
            "name": "cache-service",
            "healthy": cache_stats.get("connected", False),
            "details": cache_stats
        })
        
        if not cache_stats.get("connected", False):
            overall_healthy = False
        
        return {
            "status": "healthy" if overall_healthy else "unhealthy",
            "services": services
        }
    
    async def clear_cache(self) -> Dict[str, Any]:
        """Clear all cached data."""
        success = await self.cache_service.clear_all()
        return {
            "success": success,
            "message": "Cache cleared successfully" if success else "Failed to clear cache"
        }
    
    async def _apply_preference_boost(self, user_id: str, recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply user preference boost multipliers to schema recommendations."""
        try:
            # Get user preferences
            preferences = await self.preference_service.get_user_preferences(user_id)
            
            if not preferences:
                self.logger.debug("No user preferences found", user_id=user_id)
                return recommendations
            
            # Convert to boost map
            boost_map = self.preference_service.get_boost_map(preferences)
            
            if not boost_map:
                self.logger.debug("No boost map created", user_id=user_id)
                return recommendations
            
            self.logger.info("Applying preference boost", user_id=user_id, boost_count=len(boost_map))
            
            # Apply boost to each recommendation
            boosted_count = 0
            for rec in recommendations:
                full_name = rec.get("full_name", "")
                catalog = rec.get("catalog", "")
                schema = rec.get("schema", "")
                table = rec.get("table", "")
                
                original_confidence = rec.get("confidence", 0.0)
                boost = 1.0
                matched_key = None
                
                # Try to match in order of specificity: database.schema.table > database.schema > database
                table_key = f"{catalog}.{schema}.{table}"
                schema_key = f"{catalog}.{schema}"
                
                if table_key in boost_map:
                    boost = boost_map[table_key]
                    matched_key = table_key
                elif schema_key in boost_map:
                    boost = boost_map[schema_key]
                    matched_key = schema_key
                elif catalog in boost_map:
                    boost = boost_map[catalog]
                    matched_key = catalog
                
                # Apply boost by multiplying confidence
                if boost > 1.0:
                    boosted_confidence = min(1.0, original_confidence * boost)
                    rec["confidence"] = boosted_confidence
                    rec["preference_boost"] = boost
                    rec["original_confidence"] = original_confidence
                    boosted_count += 1
                    
                    self.logger.debug(
                        "Boost applied",
                        table=full_name,
                        matched_key=matched_key,
                        original=f"{original_confidence:.4f}",
                        boost=f"{boost}x",
                        boosted=f"{boosted_confidence:.4f}"
                    )
            
            # Re-sort by boosted confidence
            recommendations.sort(key=lambda x: x.get("confidence", 0), reverse=True)
            
            # Update ranks
            for i, rec in enumerate(recommendations):
                rec["rank"] = i + 1
            
            self.logger.info(
                "Preference boost complete",
                user_id=user_id,
                total_recommendations=len(recommendations),
                boosted_count=boosted_count
            )
            
            return recommendations
            
        except Exception as e:
            self.logger.error("Failed to apply preference boost", error=str(e), user_id=user_id)
            # Return original recommendations if boost fails
            return recommendations

# Global orchestration service instance
orchestration_service = OrchestrationService()
