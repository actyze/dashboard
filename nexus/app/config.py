"""Configuration management for Nexus service."""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Service Configuration
    host: str = "0.0.0.0"
    port: int = 8002
    debug: bool = False
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379"
    cache_ttl: int = 300  # 5 minutes
    
    # External Services
    schema_service_url: str = "http://dashboard-schema-service:8001"
    llm_service_url: str = "http://dashboard-fastapi:8000"
    trino_host: str = "dashboard-trino"
    trino_port: int = 8080
    trino_catalog: str = "postgres"
    trino_schema: str = "public"
    trino_user: str = "admin"
    trino_password: str = ""
    
    # Retry Configuration
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_backoff: float = 2.0
    
    # Query Configuration
    default_max_results: int = 100
    default_timeout_seconds: int = 30
    conversation_history_size: int = 5
    
    # PostgreSQL Configuration (for user data)
    postgres_host: str = "dashboard-postgres"
    postgres_port: int = 5432
    postgres_database: str = "dashboard"
    postgres_user: str = "dashboard_user"
    postgres_password: str = "dashboard_password"
    
    # Health Check Configuration
    health_check_timeout: float = 5.0
    
    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
