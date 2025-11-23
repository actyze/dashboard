"""Configuration management for Nexus service."""

from pydantic_settings import BaseSettings
from typing import Optional, List
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # =============================================================================
    # Service Configuration
    # =============================================================================
    nexus_host: str = "0.0.0.0"
    nexus_port: int = 8002
    debug: bool = False
    
    # =============================================================================
    # Database Configuration - PostgreSQL (User Data Persistence)
    # =============================================================================
    postgres_host: str = "dashboard-postgres"
    postgres_port: int = 5432
    postgres_database: str = "dashboard"
    postgres_user: str = "dashboard_user"
    postgres_password: str = "dashboard_password"
    postgres_ssl_mode: str = "prefer"
    postgres_pool_size: int = 20
    postgres_max_overflow: int = 30
    postgres_pool_timeout: int = 30
    
    # =============================================================================
    # Cache Configuration - In-Memory (Enterprise-Grade)
    # =============================================================================
    cache_enabled: bool = True
    cache_ttl: int = 300  # Default TTL for query cache (5 minutes)
    cache_key_prefix: str = "nexus:"
    cache_stats_log_interval: int = 300
    
    # Memory Cache Sizes (Different cache types for different use cases)
    cache_query_max_size: int = 1000      # SQL query results
    cache_metadata_max_size: int = 200    # Schema metadata
    cache_longterm_max_size: int = 100    # Expensive operations
    cache_schema_max_size: int = 500      # FAISS recommendations
    cache_llm_max_size: int = 200         # ML model responses
    
    # Memory Cache TTL (Time-To-Live in seconds)
    cache_metadata_ttl: int = 600         # 10 minutes
    cache_longterm_ttl: int = 3600        # 1 hour
    cache_schema_ttl: int = 1800          # 30 minutes
    cache_llm_ttl: int = 7200             # 2 hours
    
    # =============================================================================
    # External Services Configuration
    # =============================================================================
    
    # FAISS Schema Service Configuration
    schema_service_url: str = "http://dashboard-schema-service:8001"
    schema_service_timeout: int = 30
    schema_service_retries: int = 3
    schema_service_retry_delay: float = 1.0
    
    # ML/LLM Service Configuration
    llm_service_url: str = "http://dashboard-fastapi:8000"
    llm_service_timeout: int = 30
    llm_service_retries: int = 2
    llm_service_read_timeout: int = 15
    
    # LLM Model Parameters
    llm_max_tokens: int = 1000
    llm_temperature: float = 0.1
    llm_max_length: int = 4096
    llm_do_sample: bool = False
    llm_num_beams: int = 1
    
    # External LLM Configuration (OpenAI, Perplexity, etc.)
    external_llm_enabled: bool = False
    external_llm_provider: str = ""
    external_llm_api_key: str = ""
    external_llm_model: str = ""
    external_llm_base_url: str = ""
    external_llm_max_tokens: int = 4096
    external_llm_temperature: float = 0.1
    external_llm_timeout: int = 30
    
    # =============================================================================
    # Trino Database Configuration
    # =============================================================================
    trino_host: str = "dashboard-trino"
    trino_port: int = 8080
    trino_user: str = "admin"
    trino_password: str = ""
    trino_catalog: str = "postgres"
    trino_schema: str = "public"
    trino_ssl: bool = False
    trino_max_rows: int = 1000
    trino_query_timeout_seconds: int = 300
    
    # =============================================================================
    # Query Processing Configuration
    # =============================================================================
    default_max_results: int = 100
    default_timeout_seconds: int = 30
    max_query_length: int = 10000
    max_result_rows: int = 1000
    conversation_history_size: int = 5
    
    # =============================================================================
    # Retry and Resilience Configuration
    # =============================================================================
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_backoff: float = 2.0
    circuit_breaker_enabled: bool = True
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_timeout: int = 60
    
    # =============================================================================
    # Health Check Configuration
    # =============================================================================
    health_check_timeout: float = 5.0
    health_check_interval: int = 30
    health_check_enabled: bool = True
    
    # =============================================================================
    # Logging Configuration
    # =============================================================================
    log_level: str = "INFO"
    log_format: str = "json"
    log_file: str = ""
    log_max_size: str = "100MB"
    log_backup_count: int = 5
    
    # Specific logger levels
    log_level_nexus: str = "INFO"
    log_level_orchestration: str = "INFO"
    log_level_database: str = "WARN"
    log_level_cache: str = "WARN"
    log_level_http: str = "WARN"
    
    # =============================================================================
    # Security Configuration
    # =============================================================================
    secret_key: str = ""
    jwt_secret: str = ""
    jwt_expiration: int = 3600
    cors_origins: str = "*"
    cors_credentials: bool = True
    rate_limit_enabled: bool = False
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    # =============================================================================
    # Monitoring and Observability
    # =============================================================================
    metrics_enabled: bool = True
    metrics_port: int = 9090
    prometheus_enabled: bool = False
    jaeger_enabled: bool = False
    jaeger_endpoint: str = ""
    
    # =============================================================================
    # Development and Testing Configuration
    # =============================================================================
    testing_mode: bool = False
    mock_external_services: bool = False
    enable_graphql_playground: bool = True
    enable_swagger_ui: bool = True
    
    # =============================================================================
    # Feature Flags
    # =============================================================================
    feature_user_management: bool = True
    feature_conversation_history: bool = True
    feature_query_caching: bool = True
    feature_schema_recommendations: bool = True
    feature_sql_correction: bool = True
    
    # =============================================================================
    # Backward Compatibility Properties
    # =============================================================================
    @property
    def host(self) -> str:
        """Backward compatibility for host."""
        return self.nexus_host
    
    @property
    def port(self) -> int:
        """Backward compatibility for port."""
        return self.nexus_port
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
