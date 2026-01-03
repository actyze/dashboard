"""Schema recommendation service client."""

from typing import List, Dict, Any, Optional
import os
from app.services.base import BaseService
from app.config import settings

class SchemaService(BaseService):
    """Client for FAISS-based schema recommendation service."""
    
    def __init__(self):
        super().__init__(settings.schema_service_url, "schema-service")
        # Simple service key for internal authentication
        self._service_key = os.getenv("SCHEMA_SERVICE_KEY", "")
        
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers with simple service key."""
        if self._service_key:
            return {"X-Service-Key": self._service_key}
        return {}
    
    async def get_recommendations(
        self, 
        natural_language_query: str, 
        conversation_history: Optional[List[str]] = None,
        max_recommendations: int = 5,
        confidence_threshold: float = 0.3
    ) -> Dict[str, Any]:
        """Get schema recommendations for a natural language query."""
        
        request_data = {
            "natural_language_query": natural_language_query,
            "prior_context": conversation_history or [],  # Fixed: schema service expects prior_context
            "top_k": max_recommendations,
            "confidence_threshold": confidence_threshold
        }
        
        self.logger.info(
            "Getting schema recommendations",
            query=natural_language_query,
            history_size=len(conversation_history) if conversation_history else 0
        )
        
        try:
            headers = self._get_auth_headers()
            result = await self._make_request("POST", "/recommend", data=request_data, headers=headers)
            
            # Validate response structure
            if "recommendations" not in result:
                self.logger.warning("Invalid response structure", response=result)
                return {
                    "success": False,
                    "error": "Invalid response from schema service",
                    "recommendations": []
                }
            
            recommendations = result.get("recommendations", [])
            self.logger.info(
                "Schema recommendations received",
                count=len(recommendations)
            )
            
            return {
                "success": True,
                "recommendations": recommendations,
                "query": natural_language_query
            }
            
        except Exception as e:
            self.logger.error("Failed to get schema recommendations", error=str(e))
            return {
                "success": False,
                "error": f"Schema service error: {str(e)}",
                "recommendations": []
            }
    
    async def refresh_schemas(self) -> Dict[str, Any]:
        """Trigger schema refresh."""
        try:
            headers = self._get_auth_headers()
            result = await self._make_request("POST", "/refresh", headers=headers)
            self.logger.info("Schema refresh triggered")
            return result
        except Exception as e:
            self.logger.error("Failed to refresh schemas", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_all_schemas(self) -> Dict[str, Any]:
        """Get all loaded schemas."""
        try:
            headers = self._get_auth_headers()
            result = await self._make_request("GET", "/schemas", headers=headers)
            return result
        except Exception as e:
            self.logger.error("Failed to get schemas", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def detect_intent(self, user_text: str) -> Dict[str, Any]:
        """
        Detect user intent using MPNet-based classification.
        
        Returns:
            {
                "intent": str,  # NEW_QUERY, REFINE_RESULT, REJECT_RESULT, etc.
                "confidence": float,
                "all_scores": dict
            }
        """
        request_data = {"text": user_text}
        
        self.logger.info("Detecting user intent", text=user_text[:100])
        
        try:
            headers = self._get_auth_headers()
            result = await self._make_request("POST", "/intent/detect", data=request_data, headers=headers)
            
            intent = result.get("intent", "AMBIGUOUS")
            confidence = result.get("confidence", 0.0)
            
            self.logger.info(
                "Intent detected",
                intent=intent,
                confidence=f"{confidence:.3f}"
            )
            
            return {
                "success": True,
                "intent": intent,
                "confidence": confidence,
                "all_scores": result.get("all_scores", {})
            }
            
        except Exception as e:
            self.logger.error("Failed to detect intent", error=str(e))
            # Fallback to AMBIGUOUS on error
            return {
                "success": False,
                "intent": "AMBIGUOUS",
                "confidence": 0.0,
                "error": str(e)
            }

    # ============================================================================
    # Explorer Endpoints
    # ============================================================================

    async def get_databases(self) -> List[str]:
        """Get list of all databases."""
        try:
            headers = self._get_auth_headers()
            return await self._make_request("GET", "/explorer/databases", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get databases", error=str(e))
            return []

    async def get_database_schemas(self, database: str) -> List[str]:
        """Get schemas for a database."""
        try:
            headers = self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get schemas for database", database=database, error=str(e))
            return []

    async def get_schema_objects(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """Get objects (tables/views) for a schema."""
        try:
            headers = self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas/{schema}/objects", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get objects for schema", database=database, schema=schema, error=str(e))
            return []

    async def get_table_details(self, database: str, schema: str, table: str) -> Dict[str, Any]:
        """Get details for a specific table."""
        try:
            headers = self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas/{schema}/tables/{table}", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get table details", database=database, schema=schema, table=table, error=str(e))
            return {}

    async def search_database_objects(self, query: str, database: str = None, schema: str = None, object_type: str = None) -> List[Dict[str, Any]]:
        """Search for database objects."""
        try:
            headers = self._get_auth_headers()
            params = {"query": query}
            if database:
                params["database"] = database
            if schema:
                params["schema"] = schema
            if object_type:
                params["object_type"] = object_type
                
            return await self._make_request("GET", "/explorer/search", params=params, headers=headers)
        except Exception as e:
            self.logger.error("Failed to search objects", query=query, error=str(e))
            return []
