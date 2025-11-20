"""GraphQL schema definition using Strawberry."""

import strawberry
from typing import List, Optional
from datetime import datetime
from app.models import (
    ConversationInputGQL, SQLInputGQL, WorkflowResponseGQL, 
    SQLResponseGQL, HealthCheckResponseGQL
)
from app.models_extended import (
    UserCreateGQL, UserResponseGQL, UserPreferenceInputGQL,
    ConversationMessageInputGQL, ConversationMessageGQL,
    SavedQueryInputGQL, SavedQueryGQL, QueryHistoryItemGQL,
    DashboardStatsGQL
)
from app.services.orchestration_service import OrchestrationService

# Global orchestration service instance
orchestration_service = OrchestrationService()


@strawberry.type
class Query:
    """GraphQL Query type."""
    
    @strawberry.field(description="Check service health")
    async def health_check(self) -> HealthCheckResponseGQL:
        """Check the health of all services."""
        health_status = await orchestration_service.get_health_status()
        
        services = []
        for service in health_status.get("services", []):
            services.append(
                strawberry.type(
                    name="ServiceHealthGQL",
                    fields={
                        "name": service.get("name", "unknown"),
                        "healthy": service.get("healthy", False),
                        "response_time": service.get("response_time"),
                        "error": service.get("error")
                    }
                )()
            )
        
        return strawberry.type(
            name="HealthCheckResponseGQL",
            fields={
                "status": health_status.get("status", "unknown"),
                "services": services,
                "timestamp": datetime.utcnow()
            }
        )()
    
    @strawberry.field(description="Get cache statistics")
    async def cache_stats(self) -> strawberry.scalars.JSON:
        """Get cache statistics."""
        return await orchestration_service.cache_service.get_stats()
    
    @strawberry.field(description="Get user by ID")
    async def user(self, user_id: int) -> strawberry.scalars.JSON:
        """Get user by ID."""
        return await orchestration_service.user_service.get_user(user_id)
    
    @strawberry.field(description="Get user by username")
    async def user_by_username(self, username: str) -> strawberry.scalars.JSON:
        """Get user by username."""
        return await orchestration_service.user_service.get_user_by_username(username)
    
    @strawberry.field(description="Get user preferences")
    async def user_preferences(self, user_id: int) -> strawberry.scalars.JSON:
        """Get user preferences."""
        return await orchestration_service.user_service.get_user_preferences(user_id)
    
    @strawberry.field(description="Get conversation history")
    async def conversation_history(
        self, 
        user_id: int, 
        session_id: str, 
        limit: Optional[int] = 20
    ) -> strawberry.scalars.JSON:
        """Get conversation history for a session."""
        return await orchestration_service.user_service.get_conversation_history(
            user_id, session_id, limit or 20
        )
    
    @strawberry.field(description="Get query history")
    async def query_history(
        self, 
        user_id: int, 
        limit: Optional[int] = 50
    ) -> strawberry.scalars.JSON:
        """Get user's query history."""
        return await orchestration_service.user_service.get_query_history(
            user_id, limit or 50
        )
    
    @strawberry.field(description="Get saved queries")
    async def saved_queries(self, user_id: int) -> strawberry.scalars.JSON:
        """Get user's saved queries."""
        return await orchestration_service.user_service.get_saved_queries(user_id)
    
    @strawberry.field(description="Generate session ID")
    async def generate_session_id(self) -> str:
        """Generate a new session ID."""
        return orchestration_service.user_service.generate_session_id()


@strawberry.type
class Mutation:
    """GraphQL Mutation type."""
    
    @strawberry.mutation(description="Process natural language query")
    async def process_natural_language(
        self, 
        input: ConversationInputGQL,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> WorkflowResponseGQL:
        """Process a natural language query through the full workflow."""
        
        result = await orchestration_service.process_natural_language_workflow(
            nl_query=input.message,
            conversation_history=input.conversation_history,
            include_chart=False,
            chart_type=None,
            user_id=user_id,
            session_id=session_id
        )
        
        # Convert query results if present
        query_results = None
        if result.get("query_results"):
            qr = result["query_results"]
            query_results = strawberry.type(
                name="QueryResultsGQL",
                fields={
                    "columns": qr.get("columns", []),
                    "rows": qr.get("rows", []),
                    "row_count": qr.get("row_count", 0)
                }
            )()
        
        # Convert schema recommendations if present
        schema_recommendations = None
        if result.get("schema_recommendations"):
            schema_recs = []
            for rec in result["schema_recommendations"]:
                schema_recs.append(
                    strawberry.type(
                        name="SchemaRecommendationGQL",
                        fields={
                            "full_name": rec.get("full_name", ""),
                            "confidence": rec.get("confidence", 0.0),
                            "table_name": rec.get("table_name", ""),
                            "schema_name": rec.get("schema_name", ""),
                            "columns": rec.get("columns")
                        }
                    )()
                )
            schema_recommendations = schema_recs
        
        return strawberry.type(
            name="WorkflowResponseGQL",
            fields={
                "success": result.get("success", False),
                "nl_query": result.get("nl_query", ""),
                "generated_sql": result.get("generated_sql"),
                "query_results": query_results,
                "schema_recommendations": schema_recommendations,
                "model_confidence": result.get("model_confidence"),
                "model_reasoning": result.get("model_reasoning"),
                "processing_time": result.get("processing_time", 0.0),
                "execution_time": result.get("execution_time"),
                "retry_attempts": result.get("retry_attempts", 0),
                "error_history": result.get("error_history"),
                "error": result.get("error"),
                "error_type": result.get("error_type")
            }
        )()
    
    @strawberry.mutation(description="Execute SQL query directly")
    async def execute_sql(
        self, 
        input: SQLInputGQL
    ) -> SQLResponseGQL:
        """Execute a SQL query directly."""
        
        result = await orchestration_service.execute_sql_directly(
            sql=input.sql,
            max_results=input.max_results or 100,
            timeout_seconds=input.timeout_seconds or 30
        )
        
        # Convert query results if present
        query_results = None
        if result.get("query_results"):
            qr = result["query_results"]
            query_results = strawberry.type(
                name="QueryResultsGQL",
                fields={
                    "columns": qr.get("columns", []),
                    "rows": qr.get("rows", []),
                    "row_count": qr.get("row_count", 0)
                }
            )()
        
        return strawberry.type(
            name="SQLResponseGQL",
            fields={
                "success": result.get("success", False),
                "original_sql": result.get("original_sql", ""),
                "query_results": query_results,
                "execution_time": result.get("execution_time", 0.0),
                "error": result.get("error")
            }
        )()
    
    @strawberry.mutation(description="Clear all cached data")
    async def clear_cache(self) -> strawberry.scalars.JSON:
        """Clear all cached data."""
        return await orchestration_service.clear_cache()
    
    # User Management Mutations
    @strawberry.mutation(description="Create a new user")
    async def create_user(self, input: UserCreateGQL) -> strawberry.scalars.JSON:
        """Create a new user."""
        return await orchestration_service.user_service.create_user(
            username=input.username,
            email=input.email,
            full_name=input.full_name
        )
    
    @strawberry.mutation(description="Set user preference")
    async def set_user_preference(
        self, 
        user_id: int, 
        input: UserPreferenceInputGQL
    ) -> strawberry.scalars.JSON:
        """Set or update user preference."""
        return await orchestration_service.user_service.set_user_preference(
            user_id=user_id,
            preference_key=input.preference_key,
            preference_value=input.preference_value
        )
    
    @strawberry.mutation(description="Save conversation message")
    async def save_conversation_message(
        self, 
        user_id: int, 
        input: ConversationMessageInputGQL
    ) -> strawberry.scalars.JSON:
        """Save conversation message to history."""
        return await orchestration_service.user_service.save_conversation_message(
            user_id=user_id,
            session_id=input.session_id,
            message_type=input.message_type,
            message_content=input.message_content,
            metadata=input.metadata
        )
    
    @strawberry.mutation(description="Save query for reuse")
    async def save_query(
        self, 
        user_id: int, 
        input: SavedQueryInputGQL
    ) -> strawberry.scalars.JSON:
        """Save a query for reuse."""
        return await orchestration_service.user_service.save_query(
            user_id=user_id,
            query_name=input.query_name,
            natural_language_query=input.natural_language_query,
            generated_sql=input.generated_sql,
            description=input.description,
            tags=input.tags
        )


# Create the GraphQL schema
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    description="Nexus GraphQL API - Central Hub for Natural Language to SQL Workflows"
)
