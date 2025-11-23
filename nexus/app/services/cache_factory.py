"""Enterprise-grade in-memory cache service - No external dependencies."""

import structlog
from app.services.memory_cache_service import MemoryCacheService

logger = structlog.get_logger()


def create_cache_service() -> MemoryCacheService:
    """
    Create in-memory cache service - Enterprise-friendly with no external dependencies.
    
    Returns:
        MemoryCacheService: High-performance in-memory cache
    """
    logger.info("Using enterprise-grade in-memory cache service - no external dependencies")
    return MemoryCacheService()


# Global cache service instance
cache_service = create_cache_service()
