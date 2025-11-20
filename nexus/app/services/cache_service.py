"""Redis-based caching service."""

import json
import hashlib
from typing import Any, Optional, Dict
import redis.asyncio as redis
import structlog
from app.config import settings

logger = structlog.get_logger()


class CacheService:
    """Redis-based caching service for query results and schema recommendations."""
    
    def __init__(self):
        self.redis_client = None
        self.ttl = settings.cache_ttl
        self.logger = logger.bind(service="cache-service")
    
    async def connect(self):
        """Connect to Redis."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            self.logger.info("Connected to Redis", url=settings.redis_url)
        except Exception as e:
            self.logger.warning("Failed to connect to Redis", error=str(e))
            self.redis_client = None
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis_client:
            await self.redis_client.close()
            self.logger.info("Disconnected from Redis")
    
    def _generate_key(self, prefix: str, data: Dict[str, Any]) -> str:
        """Generate cache key from data."""
        # Create a deterministic hash of the data
        data_str = json.dumps(data, sort_keys=True)
        hash_obj = hashlib.sha256(data_str.encode())
        return f"{prefix}:{hash_obj.hexdigest()[:16]}"
    
    async def get_query_result(self, sql: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached query result."""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("query", {"sql": sql, "params": params})
            cached_data = await self.redis_client.get(key)
            
            if cached_data:
                self.logger.debug("Cache hit for query", key=key)
                return json.loads(cached_data)
            else:
                self.logger.debug("Cache miss for query", key=key)
                return None
                
        except Exception as e:
            self.logger.error("Error getting cached query result", error=str(e))
            return None
    
    async def set_query_result(
        self, 
        sql: str, 
        params: Dict[str, Any], 
        result: Dict[str, Any]
    ) -> bool:
        """Cache query result."""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("query", {"sql": sql, "params": params})
            cached_data = json.dumps(result)
            
            await self.redis_client.setex(key, self.ttl, cached_data)
            self.logger.debug("Cached query result", key=key, ttl=self.ttl)
            return True
            
        except Exception as e:
            self.logger.error("Error caching query result", error=str(e))
            return False
    
    async def get_schema_recommendations(
        self, 
        query: str, 
        history: Optional[list] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached schema recommendations."""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("schema", {
                "query": query, 
                "history": history or []
            })
            cached_data = await self.redis_client.get(key)
            
            if cached_data:
                self.logger.debug("Cache hit for schema recommendations", key=key)
                return json.loads(cached_data)
            else:
                self.logger.debug("Cache miss for schema recommendations", key=key)
                return None
                
        except Exception as e:
            self.logger.error("Error getting cached schema recommendations", error=str(e))
            return None
    
    async def set_schema_recommendations(
        self, 
        query: str, 
        history: Optional[list], 
        recommendations: Dict[str, Any]
    ) -> bool:
        """Cache schema recommendations."""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("schema", {
                "query": query, 
                "history": history or []
            })
            cached_data = json.dumps(recommendations)
            
            await self.redis_client.setex(key, self.ttl, cached_data)
            self.logger.debug("Cached schema recommendations", key=key, ttl=self.ttl)
            return True
            
        except Exception as e:
            self.logger.error("Error caching schema recommendations", error=str(e))
            return False
    
    async def get_sql_generation(
        self, 
        query: str, 
        history: Optional[list], 
        schema_context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Get cached SQL generation result."""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("sql_gen", {
                "query": query,
                "history": history or [],
                "schema": schema_context or {}
            })
            cached_data = await self.redis_client.get(key)
            
            if cached_data:
                self.logger.debug("Cache hit for SQL generation", key=key)
                return json.loads(cached_data)
            else:
                self.logger.debug("Cache miss for SQL generation", key=key)
                return None
                
        except Exception as e:
            self.logger.error("Error getting cached SQL generation", error=str(e))
            return None
    
    async def set_sql_generation(
        self, 
        query: str, 
        history: Optional[list], 
        schema_context: Optional[Dict[str, Any]], 
        result: Dict[str, Any]
    ) -> bool:
        """Cache SQL generation result."""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("sql_gen", {
                "query": query,
                "history": history or [],
                "schema": schema_context or {}
            })
            cached_data = json.dumps(result)
            
            await self.redis_client.setex(key, self.ttl, cached_data)
            self.logger.debug("Cached SQL generation", key=key, ttl=self.ttl)
            return True
            
        except Exception as e:
            self.logger.error("Error caching SQL generation", error=str(e))
            return False
    
    async def clear_all(self) -> bool:
        """Clear all cached data."""
        if not self.redis_client:
            return False
        
        try:
            await self.redis_client.flushdb()
            self.logger.info("Cleared all cached data")
            return True
        except Exception as e:
            self.logger.error("Error clearing cache", error=str(e))
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.redis_client:
            return {"connected": False}
        
        try:
            info = await self.redis_client.info()
            return {
                "connected": True,
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses")
            }
        except Exception as e:
            self.logger.error("Error getting cache stats", error=str(e))
            return {"connected": False, "error": str(e)}
