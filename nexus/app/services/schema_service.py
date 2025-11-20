"""Schema recommendation service client."""

from typing import List, Dict, Any, Optional
from app.services.base import BaseService
from app.config import settings


class SchemaService(BaseService):
    """Client for FAISS-based schema recommendation service."""
    
    def __init__(self):
        super().__init__(settings.schema_service_url, "schema-service")
    
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
            "conversation_history": conversation_history or [],
            "max_recommendations": max_recommendations,
            "confidence_threshold": confidence_threshold
        }
        
        self.logger.info(
            "Getting schema recommendations",
            query=natural_language_query,
            history_size=len(conversation_history) if conversation_history else 0
        )
        
        try:
            result = await self._make_request("POST", "/recommend", data=request_data)
            
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
            result = await self._make_request("POST", "/refresh")
            self.logger.info("Schema refresh triggered")
            return result
        except Exception as e:
            self.logger.error("Failed to refresh schemas", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_all_schemas(self) -> Dict[str, Any]:
        """Get all loaded schemas."""
        try:
            result = await self._make_request("GET", "/schemas")
            return result
        except Exception as e:
            self.logger.error("Failed to get schemas", error=str(e))
            return {"success": False, "error": str(e)}
