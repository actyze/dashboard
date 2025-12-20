"""Schema recommendation service client."""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from jose import jwt
from app.services.base import BaseService
from app.config import settings
from app.services.user_service import UserService

class SchemaService(BaseService):
    """Client for FAISS-based schema recommendation service."""
    
    def __init__(self):
        super().__init__(settings.schema_service_url, "schema-service")
        self.user_service = UserService()
        self._service_token = None
        
    async def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for service requests, refreshing if needed."""
        should_refresh = False
        
        if not self._service_token:
            should_refresh = True
        else:
            try:
                # Decode without verification just to check expiration (verification happens on server)
                # We just want to know if WE think it's expired
                payload = jwt.get_unverified_claims(self._service_token)
                exp = payload.get("exp")
                
                if exp:
                    expiration_time = datetime.utcfromtimestamp(exp)
                    # Refresh if expires in less than 5 minutes
                    if expiration_time - datetime.utcnow() < timedelta(minutes=5):
                        should_refresh = True
                else:
                    should_refresh = True
            except Exception:
                should_refresh = True
        
        if should_refresh:
            self._service_token = await self.user_service.get_service_token("nexus-service")
        
        return {"Authorization": f"Bearer {self._service_token}"}
    
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
            headers = await self._get_auth_headers()
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
            headers = await self._get_auth_headers()
            result = await self._make_request("POST", "/refresh", headers=headers)
            self.logger.info("Schema refresh triggered")
            return result
        except Exception as e:
            self.logger.error("Failed to refresh schemas", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_all_schemas(self) -> Dict[str, Any]:
        """Get all loaded schemas."""
        try:
            headers = await self._get_auth_headers()
            result = await self._make_request("GET", "/schemas", headers=headers)
            return result
        except Exception as e:
            self.logger.error("Failed to get schemas", error=str(e))
            return {"success": False, "error": str(e)}

    # ============================================================================
    # Explorer Endpoints
    # ============================================================================

    async def get_databases(self) -> List[str]:
        """Get list of all databases."""
        try:
            headers = await self._get_auth_headers()
            return await self._make_request("GET", "/explorer/databases", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get databases", error=str(e))
            return []

    async def get_database_schemas(self, database: str) -> List[str]:
        """Get schemas for a database."""
        try:
            headers = await self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get schemas for database", database=database, error=str(e))
            return []

    async def get_schema_objects(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """Get objects (tables/views) for a schema."""
        try:
            headers = await self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas/{schema}/objects", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get objects for schema", database=database, schema=schema, error=str(e))
            return []

    async def get_table_details(self, database: str, schema: str, table: str) -> Dict[str, Any]:
        """Get details for a specific table."""
        try:
            headers = await self._get_auth_headers()
            return await self._make_request("GET", f"/explorer/databases/{database}/schemas/{schema}/tables/{table}", headers=headers)
        except Exception as e:
            self.logger.error("Failed to get table details", database=database, schema=schema, table=table, error=str(e))
            return {}

    async def search_database_objects(self, query: str, database: str = None, schema: str = None, object_type: str = None) -> List[Dict[str, Any]]:
        """Search for database objects."""
        try:
            headers = await self._get_auth_headers()
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
