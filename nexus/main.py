"""Main FastAPI application with GraphQL endpoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
import structlog

from app.config import settings
from app.logging import configure_logging
from app.graphql.schema import schema, orchestration_service
from app.database import db_manager
from app.api import router as api_router

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
    # Create tables automatically on startup
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
    description="Python-based GraphQL API service - Central hub for natural language to SQL workflows",
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

# Create GraphQL router
graphql_app = GraphQLRouter(
    schema,
    graphiql=settings.debug,  # Enable GraphiQL in debug mode
    path="/graphql"
)

# Include GraphQL router
app.include_router(graphql_app, prefix="")

# Include REST API router
app.include_router(api_router)


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Nexus",
        "version": "1.0.0",
        "description": "Python-based GraphQL API service - Central hub for natural language to SQL workflows",
        "graphql_endpoint": "/graphql",
        "graphql_playground": "/graphql" if settings.debug else None,
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
