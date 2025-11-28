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
            # Step 1: Get schema recommendations from FAISS service
            self.logger.info("=== STEP 1: FAISS SCHEMA SERVICE ===")
            self.logger.info("Input NL Query", query=nl_query)
            self.logger.info("Input Query History", history=conversation_history if conversation_history else "None")
            self.logger.debug("=== ORCHESTRATION DEBUG - STEP 1 ===")
            self.logger.debug("Request timestamp", timestamp=int(start_time * 1000))
            self.logger.debug("Query length", characters=len(nl_query))
            self.logger.debug("History entries", count=len(conversation_history))
            
            # Check cache first
            cached_schema = await self.cache_service.get_schema_recommendations(
                nl_query, conversation_history
            )
            
            if cached_schema:
                self.logger.info("Using cached schema recommendations")
                schema_recommendations = cached_schema
            else:
                schema_recommendations = await self.schema_service.get_recommendations(
                    nl_query, conversation_history
                )
                
                # Cache the result if successful
                if schema_recommendations.get("success"):
                    await self.cache_service.cache_schema_recommendations(
                        nl_query, conversation_history, schema_recommendations
                    )
            
            if not schema_recommendations.get("success"):
                error_msg = schema_recommendations.get("error", "Schema service failed")
                self.logger.error("Schema recommendations failed", error=error_msg)
                return self._create_error_response(
                    error_msg, "SCHEMA_SERVICE_ERROR", start_time
                )
            
            recommendations = schema_recommendations.get("recommendations", []) or []
            
            # Detailed schema recommendations logging (matching Java backend)
            self.logger.info("FAISS Output - Success", success=schema_recommendations.get("success"))
            if recommendations:
                self.logger.info("FAISS Output - Found schema recommendations", count=len(recommendations))
                # Log top 3 recommendations with details
                for i, rec in enumerate(recommendations[:3]):
                    self.logger.info(
                        f"  Schema {i+1}",
                        full_name=rec.get("full_name", "unknown"),
                        confidence=rec.get("confidence", 0.0)
                    )
            else:
                self.logger.warning("FAISS Output - No schema recommendations found")
            
            # Step 2: Generate SQL using LLM with schema context
            self.logger.info("=== STEP 2: SQL GENERATION (LLM) ===")
            self.logger.info("LLM Input - NL Query", query=nl_query)
            self.logger.info("LLM Input - Schema Context", recommendation_count=len(recommendations))
            
            # Check cache first (using LLM cache for SQL generation)
            cache_key = f"{nl_query}_{len(conversation_history)}_{len(recommendations)}"
            cached_sql = await self.cache_service.get_llm_response(
                cache_key, {"type": "sql_generation"}
            )
            
            if cached_sql and isinstance(cached_sql, str):
                self.logger.info("Using cached SQL generation")
                # Parse cached string back to dict format
                sql_generation = {
                    "success": True,
                    "sql": cached_sql,
                    "confidence": 0.85,
                    "reasoning": "Retrieved from cache"
                }
            else:
                sql_generation = await self.llm_service.generate_sql(
                    nl_query, conversation_history, schema_recommendations
                )
                
                # Cache the result if successful - cache only the SQL, not the entire dict
                if sql_generation.get("success") and sql_generation.get("sql"):
                    await self.cache_service.cache_llm_response(
                        cache_key, {"type": "sql_generation"}, sql_generation.get("sql")
                    )
            
            # Detailed LLM output logging (matching Java backend)
            self.logger.info("LLM Output - Success", success=sql_generation.get("success") if sql_generation else "null response")
            if sql_generation:
                generated_sql = sql_generation.get("sql", "")
                self.logger.info("LLM Output - SQL", sql=generated_sql[:200] + "..." if len(generated_sql) > 200 else generated_sql)
                self.logger.info("LLM Output - Confidence", confidence=sql_generation.get("confidence"))
                self.logger.info("LLM Output - Reasoning", reasoning=sql_generation.get("reasoning", ""))
            
            if not sql_generation.get("success"):
                error_msg = sql_generation.get("error", "SQL generation failed")
                error_type = sql_generation.get("error_type", "SQL_GENERATION_ERROR")
                
                # Get user-friendly error message
                user_friendly_error = self.error_analysis_service.get_user_friendly_error(error_type, error_msg)
                
                self.logger.error("SQL generation failed", error=error_msg, error_type=error_type, user_friendly=user_friendly_error)
                return self._create_error_response(user_friendly_error, error_type, start_time)
            
            generated_sql = sql_generation.get("sql", "").strip()
            if not generated_sql:
                self.logger.error("Generated SQL is empty")
                return self._create_error_response(
                    "Generated SQL is empty", "EMPTY_SQL_ERROR", start_time
                )
            
            self.logger.info("SQL generated successfully", sql=generated_sql[:100])
            
            # Step 3: Execute SQL with retry logic
            self.logger.info("=== STEP 3: SQL EXECUTION WITH RETRY ===")
            self.logger.info("Initial SQL to execute", sql=generated_sql)
            self.logger.info("Max retry attempts", max_retries=settings.max_retries)
            
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
                    self._create_correction_callback(schema_recommendations, conversation_history)
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
                "model_confidence": sql_generation.get("confidence"),
                "model_reasoning": sql_generation.get("reasoning"),
                "processing_time": processing_time,
                "execution_time": sql_result.get("execution_time"),
                "retry_attempts": sql_result.get("retry_attempts", 0),
                "error_history": sql_result.get("error_history", [])
            }
            
            if not sql_result.get("success"):
                response.update({
                    "error": sql_result.get("error"),
                    "error_type": sql_result.get("error_type")
                })
            else:
                # Log successful completion (matching Java backend)
                final_sql = sql_result.get("final_sql", generated_sql)
                retry_attempts = sql_result.get("retry_attempts", 0)
                self.logger.info(
                    "Natural language workflow completed successfully",
                    attempts=retry_attempts,
                    nl_query=nl_query,
                    final_sql=final_sql[:100] + "..." if len(final_sql) > 100 else final_sql
                )
            
            # Step 5: Save to user history if user_id and session_id provided
            if user_id and session_id:
                try:
                    # Save conversation messages
                    await self.user_service.save_conversation_message(
                        user_id=user_id,
                        session_id=session_id,
                        message_type="user",
                        message_content=nl_query,
                        metadata={"schema_recommendations_count": len(recommendations)}
                    )
                    
                    # Save assistant response
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
                    
                    # Save query execution history
                    await self.user_service.save_query_execution(
                        user_id=user_id,
                        session_id=session_id,
                        natural_language_query=nl_query,
                        generated_sql=response.get("generated_sql"),
                        execution_status="success" if response["success"] else "error",
                        execution_time_ms=int(response.get("execution_time", 0)),
                        row_count=response.get("query_results", {}).get("row_count") if response.get("query_results") else None,
                        error_message=response.get("error"),
                        schema_recommendations={"recommendations": recommendations},
                        model_confidence=response.get("model_confidence"),
                        retry_attempts=response.get("retry_attempts", 0)
                    )
                    
                except Exception as e:
                    self.logger.warning("Failed to save user history", error=str(e))
            
            self.logger.info(
                "Natural language workflow completed",
                success=response["success"],
                processing_time=processing_time,
                retry_attempts=response["retry_attempts"]
            )
            
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
    
    async def execute_sql_directly(
        self,
        sql: str,
        max_results: int = 100,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """Execute SQL directly without natural language processing."""
        
        self.logger.info("Executing SQL directly", sql=sql[:100])
        
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
