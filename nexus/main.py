"""Main FastAPI application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.config import settings
from app.logging import configure_logging
from app.services.orchestration_service import orchestration_service
from app.database import db_manager
from app.migrations import run_migrations
from app.api import router as api_router, auth_router, explorer_router, dashboard_router, public_router
from app.admin_api import admin_router
from app.api_preferences import router as preferences_router
from app.api_file_upload import router as file_upload_router
from app.api_metadata import router as metadata_router

# Configure logging
configure_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Nexus service", version="1.0.0")
    
    # Initialize database
    await db_manager.initialize()
    
    # Run database migrations
    logger.info("Running database migrations...")
    async with db_manager.engine.connect() as conn:
        migration_success = await run_migrations(conn)
        if not migration_success:
            logger.error("Database migrations failed!")
            raise RuntimeError("Database migrations failed")
    logger.info("Database migrations completed successfully")
    
    # Create tables automatically on startup (for any tables not in migrations)
    await db_manager.create_tables()
    
    # Initialize orchestration service
    await orchestration_service.initialize()
    logger.info("Service initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Nexus service")
    await orchestration_service.shutdown()
    await db_manager.close()
    logger.info("Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Nexus",
    description="Python-based REST API service - Central hub for natural language to SQL workflows",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc
    openapi_url="/openapi.json"  # OpenAPI schema
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST API routers
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(explorer_router)
app.include_router(dashboard_router)
app.include_router(admin_router)  # Admin endpoints (requires ADMIN role)
app.include_router(preferences_router)  # Prefix already in router definition
app.include_router(file_upload_router)  # File upload endpoints
app.include_router(metadata_router)  # Metadata catalog descriptions (org-level)
app.include_router(public_router)  # No authentication required


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Nexus",
        "version": "1.0.0",
        "description": "Python-based REST API service - Central hub for natural language to SQL workflows",
        "api_docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {
        "status": "healthy",
        "service": "nexus",
        "version": "1.0.0"
    }


@app.get("/metrics")
async def metrics():
    """Metrics endpoint for monitoring."""
    # Get cache stats
    cache_stats = await orchestration_service.cache_service.get_stats()
    
    # Get service health
    health_status = await orchestration_service.get_health_status()
    
    return {
        "service": "nexus",
        "cache": cache_stats,
        "services": health_status.get("services", []),
        "overall_status": health_status.get("status", "unknown")
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
