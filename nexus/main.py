"""Main FastAPI application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import structlog
import time
import uuid

from app.config import settings
from app.logging import configure_logging, set_request_id, get_request_id
from app.services.orchestration_service import orchestration_service
from app.database import db_manager
from app.migrations import run_migrations
from app.api import router as api_router, auth_router, explorer_router, dashboard_router, public_router
from app.admin_api import admin_router
from app.api_preferences import router as preferences_router
from app.api_file_upload import router as file_upload_router
from app.api_metadata import router as metadata_router
from app.api_exclusions import router as exclusions_router
from app.api_refresh import router as refresh_router
from app.api_kpi import router as kpi_router
from app.api_relationships import router as relationships_router
from app.api_predictions import router as predictions_router
from app.services.scheduler_service import start_scheduler, stop_scheduler
from app.services.refresh_service import refresh_service
from app.services.telemetry_service import telemetry_service
from app.metrics import (
    MetricsContext, http_requests_in_progress, http_request_duration_seconds,
    http_requests_total, service_health_status
)
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

# Configure logging
configure_logging()
logger = structlog.get_logger()

# Track app startup state
app_started = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global app_started
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

    # Start anonymous telemetry (opt-out via TELEMETRY_ENABLED=false)
    await telemetry_service.start()

    # Recover any jobs stuck in 'running' state from a previous pod crash
    await refresh_service.recover_stuck_jobs()

    # Start tile cache refresh scheduler (APScheduler + SQLAlchemyJobStore)
    start_scheduler()

    # Mark as started for readiness checks
    app_started = True

    logger.info("Service initialized successfully")

    yield

    # Shutdown
    logger.info("Shutting down Nexus service")
    app_started = False
    await telemetry_service.stop()
    stop_scheduler()
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


# Request tracking middleware
@app.middleware("http")
async def request_tracking_middleware(request: Request, call_next):
    """Track HTTP requests and record metrics."""
    # Generate or get request ID
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    set_request_id(request_id)

    # Normalize endpoint path
    endpoint = request.url.path

    # Track metrics
    http_requests_in_progress.inc()
    start_time = time.time()

    try:
        response = await call_next(request)
        duration = time.time() - start_time

        # Record metrics
        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=endpoint
        ).observe(duration)
        http_requests_total.labels(
            method=request.method,
            endpoint=endpoint,
            status=response.status_code
        ).inc()

        # Add request ID to response headers
        response.headers["x-request-id"] = request_id

        logger.info(
            "http_request",
            method=request.method,
            endpoint=endpoint,
            status_code=response.status_code,
            duration_ms=duration * 1000
        )

        return response
    finally:
        http_requests_in_progress.dec()


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
app.include_router(exclusions_router)  # Schema exclusions (org-level, admin only)
app.include_router(public_router)  # No authentication required
app.include_router(refresh_router)  # Tile cache & refresh scheduler
app.include_router(kpi_router)     # Scheduled KPI definitions & metrics
app.include_router(relationships_router)  # Semantic relationship graph
app.include_router(predictions_router)   # Predictive Intelligence pipelines


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


@app.get("/healthz")
async def liveness_probe():
    """Kubernetes liveness probe - indicates if service is alive."""
    return {
        "status": "alive",
        "service": "nexus",
        "version": "1.0.0"
    }


@app.get("/readyz")
async def readiness_probe():
    """Kubernetes readiness probe - indicates if service is ready to serve traffic."""
    global app_started
    if not app_started:
        return Response(
            status_code=503,
            content='{"status": "not_ready", "message": "Service not fully initialized"}',
            media_type="application/json"
        )

    # Check critical dependencies
    try:
        health_status = await orchestration_service.get_health_status()
        if health_status.get("status") == "healthy":
            return {
                "status": "ready",
                "service": "nexus",
                "version": "1.0.0"
            }
        else:
            return Response(
                status_code=503,
                content='{"status": "not_ready", "message": "External services unhealthy"}',
                media_type="application/json"
            )
    except Exception as e:
        logger.error("readiness_check_failed", error=str(e))
        return Response(
            status_code=503,
            content=f'{{"status": "not_ready", "message": "{str(e)}"}}',
            media_type="application/json"
        )


@app.get("/health")
async def health_check():
    """Deprecated: Use /healthz and /readyz instead."""
    try:
        health_status = await orchestration_service.get_health_status()
        return {
            "status": "healthy" if health_status.get("status") == "healthy" else "unhealthy",
            "service": "nexus",
            "version": "1.0.0",
            "details": health_status
        }
    except Exception as e:
        logger.error("health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "service": "nexus",
            "error": str(e)
        }


@app.get("/metrics", tags=["observability"])
async def prometheus_metrics():
    """Prometheus metrics endpoint in OpenMetrics format."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@app.get("/api/health/predictions", tags=["observability"])
async def predictions_health():
    """Aggregate prediction worker health status."""
    try:
        # Get health status for prediction workers
        health_status = await orchestration_service.get_health_status()

        prediction_services = {
            "xgboost": health_status.get("services", {}).get("prediction_worker_xgboost", {}).get("status") == "healthy",
            "lightgbm": health_status.get("services", {}).get("prediction_worker_lightgbm", {}).get("status") == "healthy",
            "autogluon": health_status.get("services", {}).get("prediction_worker_autogluon", {}).get("status") == "healthy",
        }

        # Determine overall status
        all_healthy = all(prediction_services.values())
        any_healthy = any(prediction_services.values())

        return {
            "status": "healthy" if all_healthy else "degraded" if any_healthy else "unhealthy",
            "services": prediction_services,
            "message": "All prediction workers healthy" if all_healthy else "Some prediction workers unavailable"
        }
    except Exception as e:
        logger.error("predictions_health_check_failed", error=str(e))
        return Response(
            status_code=503,
            content=f'{{"status": "unhealthy", "error": "{str(e)}"}}',
            media_type="application/json"
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
