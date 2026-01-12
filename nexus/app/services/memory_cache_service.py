"""In-memory caching service - Enterprise-friendly alternative to Redis."""

import json
import hashlib
import threading
from typing import Any, Optional, Dict, List
from datetime import datetime, timedelta
import structlog
from cachetools import TTLCache, LRUCache
from async_lru import alru_cache
from app.config import settings

logger = structlog.get_logger()


class MemoryCacheService:
    """
    Enterprise-grade in-memory caching service.
    Similar to Java's Caffeine cache - no external dependencies.
    """
    
    def __init__(self):
        self.logger = logger.bind(service="memory-cache-service")
        
        # Initialize different cache types (like Java backend's multiple cache managers)
        self._init_caches()
        
        # Thread-safe access
        self._lock = threading.RLock()
        
        # Cache statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "total_requests": 0
        }
    
    def _init_caches(self):
        """Initialize different cache types for different use cases."""
        
        # Primary cache for SQL query results (like Java's primary cache)
        self.query_cache = TTLCache(
            maxsize=settings.cache_query_max_size,  # Default: 1000
            ttl=settings.cache_ttl  # Default: 300 seconds (5 minutes)
        )
        
        # Fast cache for metadata queries (like Java's metadataCache)
        self.metadata_cache = TTLCache(
            maxsize=settings.cache_metadata_max_size,  # Default: 200
            ttl=settings.cache_metadata_ttl  # Default: 600 seconds (10 minutes)
        )
        
        # Long-term cache for expensive operations (like Java's longTermCache)
        self.longterm_cache = TTLCache(
            maxsize=settings.cache_longterm_max_size,  # Default: 100
            ttl=settings.cache_longterm_ttl  # Default: 3600 seconds (1 hour)
        )
        
        # Schema recommendations cache
        self.schema_cache = TTLCache(
            maxsize=settings.cache_schema_max_size,  # Default: 500
            ttl=settings.cache_schema_ttl  # Default: 1800 seconds (30 minutes)
        )
        
        # LLM response cache (most expensive operations)
        self.llm_cache = TTLCache(
            maxsize=settings.cache_llm_max_size,  # Default: 200
            ttl=settings.cache_llm_ttl  # Default: 7200 seconds (2 hours)
        )
        
        self.logger.info(
            "Memory caches initialized",
            query_cache_size=self.query_cache.maxsize,
            metadata_cache_size=self.metadata_cache.maxsize,
            longterm_cache_size=self.longterm_cache.maxsize
        )
    
    async def connect(self):
        """Initialize cache service (for compatibility with Redis interface)."""
        self.logger.info("Memory cache service initialized - no external dependencies")
    
    async def disconnect(self):
        """Cleanup cache service."""
        with self._lock:
            self.query_cache.clear()
            self.metadata_cache.clear()
            self.longterm_cache.clear()
            self.schema_cache.clear()
            self.llm_cache.clear()
        self.logger.info("Memory caches cleared")
    
    def _generate_key(self, prefix: str, data: Dict[str, Any]) -> str:
        """Generate cache key from data."""
        data_str = json.dumps(data, sort_keys=True)
        hash_obj = hashlib.sha256(data_str.encode())
        return f"{prefix}:{hash_obj.hexdigest()[:16]}"
    
    def _update_stats(self, hit: bool):
        """Update cache statistics."""
        with self._lock:
            self._stats["total_requests"] += 1
            if hit:
                self._stats["hits"] += 1
            else:
                self._stats["misses"] += 1
    
    # =============================================================================
    # Query Result Caching (Primary Use Case)
    # =============================================================================
    
    async def get_query_result(self, sql: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached query result."""
        if not settings.cache_enabled:
            return None
            
        cache_key = self._generate_key("query", {"sql": sql, "params": params})
        
        with self._lock:
            result = self.query_cache.get(cache_key)
            
        if result:
            self._update_stats(hit=True)
            self.logger.debug("Cache hit for query", key=cache_key[:20])
            return result
        else:
            self._update_stats(hit=False)
            self.logger.debug("Cache miss for query", key=cache_key[:20])
            return None
    
    async def cache_query_result(self, sql: str, params: Dict[str, Any], result: Dict[str, Any]):
        """Cache query result."""
        if not settings.cache_enabled:
            return
            
        cache_key = self._generate_key("query", {"sql": sql, "params": params})
        
        with self._lock:
            self.query_cache[cache_key] = result
            
        self.logger.debug(
            "Cached query result",
            key=cache_key[:20],
            row_count=result.get("row_count", 0)
        )
    
    # =============================================================================
    # Schema Recommendations Caching
    # =============================================================================
    
    async def get_schema_recommendations(self, query: str, conversation_history: List[str]) -> Optional[Dict[str, Any]]:
        """Get cached schema recommendations."""
        if not settings.cache_enabled:
            return None
            
        cache_key = self._generate_key("schema", {
            "query": query,
            "history": conversation_history[-3:] if conversation_history else []  # Last 3 for context
        })
        
        with self._lock:
            result = self.schema_cache.get(cache_key)
            
        if result:
            self._update_stats(hit=True)
            self.logger.debug("Cache hit for schema recommendations", key=cache_key[:20])
            return result
        else:
            self._update_stats(hit=False)
            return None
    
    async def cache_schema_recommendations(self, query: str, conversation_history: List[str], recommendations: Dict[str, Any]):
        """Cache schema recommendations."""
        if not settings.cache_enabled:
            return
            
        cache_key = self._generate_key("schema", {
            "query": query,
            "history": conversation_history[-3:] if conversation_history else []
        })
        
        with self._lock:
            self.schema_cache[cache_key] = recommendations
            
        self.logger.debug(
            "Cached schema recommendations",
            key=cache_key[:20],
            recommendation_count=len(recommendations.get("recommendations", []))
        )
    
    # =============================================================================
    # LLM Response Caching (Most Expensive)
    # =============================================================================
    
    async def get_llm_response(self, prompt: str, model_params: Dict[str, Any]) -> Optional[str]:
        """Get cached LLM response."""
        if not settings.cache_enabled:
            return None
            
        cache_key = self._generate_key("llm", {"prompt": prompt, "params": model_params})
        
        with self._lock:
            result = self.llm_cache.get(cache_key)
            
        if result:
            self._update_stats(hit=True)
            self.logger.debug("Cache hit for LLM response", key=cache_key[:20])
            return result
        else:
            self._update_stats(hit=False)
            return None
    
    async def cache_llm_response(self, prompt: str, model_params: Dict[str, Any], response: str):
        """Cache LLM response."""
        if not settings.cache_enabled:
            return
            
        cache_key = self._generate_key("llm", {"prompt": prompt, "params": model_params})
        
        with self._lock:
            self.llm_cache[cache_key] = response
            
        self.logger.debug("Cached LLM response", key=cache_key[:20])
    
    # =============================================================================
    # SQL Generation Caching (Natural Language → SQL)
    # =============================================================================
    
    async def get_generated_sql(self, nl_query: str, intent: str = "NEW_QUERY") -> Optional[Dict[str, Any]]:
        """Get cached SQL generation result for a natural language query."""
        if not settings.cache_enabled:
            return None
            
        cache_key = self._generate_key("sql_gen", {"query": nl_query.lower().strip(), "intent": intent})
        
        with self._lock:
            result = self.llm_cache.get(cache_key)
            
        if result:
            self._update_stats(hit=True)
            self.logger.info("Cache hit for SQL generation", nl_query=nl_query[:50])
            return result
        else:
            self._update_stats(hit=False)
            return None
    
    async def cache_generated_sql(self, nl_query: str, intent: str, result: Dict[str, Any]):
        """Cache SQL generation result."""
        if not settings.cache_enabled:
            return
            
        cache_key = self._generate_key("sql_gen", {"query": nl_query.lower().strip(), "intent": intent})
        
        with self._lock:
            self.llm_cache[cache_key] = result
            
        self.logger.info("Cached SQL generation", nl_query=nl_query[:50], key=cache_key[:20])
    
    # =============================================================================
    # Metadata Caching (Fast Access)
    # =============================================================================
    
    async def get_metadata(self, metadata_type: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached metadata (catalogs, schemas, tables)."""
        if not settings.cache_enabled:
            return None
            
        cache_key = self._generate_key("metadata", {"type": metadata_type, "params": params})
        
        with self._lock:
            result = self.metadata_cache.get(cache_key)
            
        if result:
            self._update_stats(hit=True)
            return result
        else:
            self._update_stats(hit=False)
            return None
    
    async def cache_metadata(self, metadata_type: str, params: Dict[str, Any], result: Dict[str, Any]):
        """Cache metadata."""
        if not settings.cache_enabled:
            return
            
        cache_key = self._generate_key("metadata", {"type": metadata_type, "params": params})
        
        with self._lock:
            self.metadata_cache[cache_key] = result
    
    # =============================================================================
    # Cache Management
    # =============================================================================
    
    async def clear_all_caches(self):
        """Clear all caches."""
        with self._lock:
            self.query_cache.clear()
            self.metadata_cache.clear()
            self.longterm_cache.clear()
            self.schema_cache.clear()
            self.llm_cache.clear()
            
            # Reset stats
            self._stats = {
                "hits": 0,
                "misses": 0,
                "evictions": 0,
                "total_requests": 0
            }
            
        self.logger.info("All memory caches cleared")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            hit_rate = (self._stats["hits"] / max(self._stats["total_requests"], 1)) * 100
            
            return {
                "cache_type": "memory",
                "enabled": settings.cache_enabled,
                "statistics": {
                    "hits": self._stats["hits"],
                    "misses": self._stats["misses"],
                    "total_requests": self._stats["total_requests"],
                    "hit_rate_percent": round(hit_rate, 2)
                },
                "cache_sizes": {
                    "query_cache": len(self.query_cache),
                    "metadata_cache": len(self.metadata_cache),
                    "longterm_cache": len(self.longterm_cache),
                    "schema_cache": len(self.schema_cache),
                    "llm_cache": len(self.llm_cache)
                },
                "cache_limits": {
                    "query_cache_max": self.query_cache.maxsize,
                    "metadata_cache_max": self.metadata_cache.maxsize,
                    "longterm_cache_max": self.longterm_cache.maxsize,
                    "schema_cache_max": self.schema_cache.maxsize,
                    "llm_cache_max": self.llm_cache.maxsize
                }
            }
    
    async def get_cache_info(self, cache_name: str) -> Dict[str, Any]:
        """Get information about a specific cache."""
        cache_map = {
            "query": self.query_cache,
            "metadata": self.metadata_cache,
            "longterm": self.longterm_cache,
            "schema": self.schema_cache,
            "llm": self.llm_cache
        }
        
        cache = cache_map.get(cache_name)
        if not cache:
            return {"error": f"Cache '{cache_name}' not found"}
        
        with self._lock:
            return {
                "name": cache_name,
                "current_size": len(cache),
                "max_size": cache.maxsize,
                "ttl_seconds": getattr(cache, 'ttl', 'N/A')
            }


# =============================================================================
# Async LRU Cache Decorators (Function-level caching)
# =============================================================================

@alru_cache(maxsize=128)
async def cached_health_check(service_name: str, url: str):
    """Cached health check for external services."""
    # This would contain the actual health check logic
    pass

@alru_cache(maxsize=256)
async def cached_schema_lookup(table_name: str, catalog: str, schema: str):
    """Cached schema lookup for table metadata."""
    # This would contain the actual schema lookup logic
    pass
