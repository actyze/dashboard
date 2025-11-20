"""Cache service factory - Choose between Redis and Memory cache."""

from typing import Union
import structlog
from app.config import settings

logger = structlog.get_logger()


def create_cache_service() -> Union['CacheService', 'MemoryCacheService']:
    """
    Factory function to create appropriate cache service.
    
    Returns:
        CacheService (Redis) or MemoryCacheService (In-Memory)
    """
    
    if settings.cache_type.lower() == "redis":
        try:
            from app.services.cache_service import CacheService
            logger.info("Using Redis cache service")
            return CacheService()
        except ImportError as e:
            logger.warning(
                "Redis dependencies not available, falling back to memory cache",
                error=str(e)
            )
            from app.services.memory_cache_service import MemoryCacheService
            return MemoryCacheService()
    
    elif settings.cache_type.lower() == "memory":
        from app.services.memory_cache_service import MemoryCacheService
        logger.info("Using in-memory cache service")
        return MemoryCacheService()
    
    else:
        logger.warning(
            f"Unknown cache type '{settings.cache_type}', defaulting to memory cache"
        )
        from app.services.memory_cache_service import MemoryCacheService
        return MemoryCacheService()


# Global cache service instance
cache_service = create_cache_service()
