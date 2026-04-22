"""Configuration management for Nexus service."""

from pydantic import Field
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
    schema_service_key: str = ""  # Service-to-service authentication key
    schema_service_timeout: int = 30
    schema_service_retries: int = 3
    schema_service_retry_delay: float = 1.0
    schema_service_max_recommendations: int = 15  # Top K table recommendations from FAISS (increased for conversation continuity)
    schema_service_confidence_threshold: float = 0.0  # No filtering - let LLM decide
    
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
    
    # External LLM Configuration (OpenAI, Perplexity, Anthropic, etc.)
    external_llm_enabled: bool = False
    external_llm_provider: str = ""  # Deprecated: use external_llm_mode instead
    external_llm_api_key: str = ""
    external_llm_model: str = ""
    external_llm_base_url: str = ""
    external_llm_max_tokens: int = 4096
    external_llm_temperature: float = 0.1
    external_llm_timeout: int = 120  # LLM API call timeout (enterprise models can be slow)
    
    # LLM Integration Mode (New: Explicit configuration for enterprises)
    # Options:
    #   "auto" (default): Use LiteLLM if available, fallback to openai-compatible
    #   "standard": Use LiteLLM (100+ providers: OpenAI, Claude, Gemini, Bedrock, etc.)
    #   "openai-compatible": For enterprise gateways (expects OpenAI request/response format)
    #   "custom": Reserved for future custom template engine
    external_llm_mode: str = "auto"
    
    # Authentication configuration (flexible for any provider)
    # Options: "bearer" (OpenAI/Perplexity), "x-api-key" (Anthropic), "api-key" (Azure)
    external_llm_auth_type: str = "bearer"
    
    # Optional: Additional headers as JSON string
    # Example: '{"anthropic-version": "2023-06-01", "X-Enterprise-ID": "dept-123"}'
    external_llm_extra_headers: str = ""
    
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
    trino_ssl_verify: bool = True  # Verify SSL certificates (set to False for self-signed)
    trino_max_rows: int = 1000
    trino_query_timeout_seconds: int = 300
    
    # =============================================================================
    # Query Processing Configuration
    # =============================================================================
    default_max_results: int = 500
    default_timeout_seconds: int = 120       # Overall NL→SQL pipeline timeout
    trino_execute_timeout_seconds: int = 120  # Trino SQL execution timeout (configurable via TRINO_EXECUTE_TIMEOUT_SECONDS)
    max_query_length: int = 10000
    max_result_rows: int = 1000
    conversation_history_size: int = 5
    
    # Preferred Tables Configuration (User-specific table prioritization)
    max_preferred_tables: int = 25  # Maximum number of tables a user can mark as preferred (editable default)
    
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
    # Tile Cache & Refresh Scheduler
    # =============================================================================
    tile_cache_scheduler_enabled: bool = True   # TILE_CACHE_SCHEDULER_ENABLED

    # How often (seconds) the enqueue sweep scans for stale/uncached tiles.
    # Should be SHORTER than tile_cache_default_ttl so tiles are picked up
    # as they expire rather than all bunching into one sweep.
    # Default = 1800 (30 min) with a 2h TTL → max 30min delay before stale
    # tiles are detected and enqueued.
    tile_cache_refresh_interval_seconds: int = 1800   # TILE_CACHE_REFRESH_INTERVAL_SECONDS

    # How often (seconds) each Nexus pod polls for pending jobs.
    tile_cache_poll_interval_seconds: int = 30        # TILE_CACHE_POLL_INTERVAL_SECONDS

    # Default TTL (seconds) for a cached tile entry.
    # Individual tiles can override this via refresh_interval_seconds column.
    # ±15% jitter is automatically applied on write to spread expiry times.
    tile_cache_default_ttl: int = 7200                # TILE_CACHE_DEFAULT_TTL_SECONDS

    # Max rows fetched per tile during scheduled refresh.
    tile_cache_max_rows: int = 1000                   # TILE_CACHE_MAX_ROWS

    # =============================================================================
    # Scheduled KPI Collection
    # =============================================================================
    # How often (seconds) the KPI collection sweep checks for due KPIs.
    # Default 300 (5 min) — actual per-KPI interval is defined in kpi_definitions.
    kpi_collection_interval_seconds: int = 300        # KPI_COLLECTION_INTERVAL_SECONDS

    # =============================================================================
    # Telemetry (opt-out anonymous usage stats)
    # =============================================================================
    telemetry_enabled: bool = Field(default=True, alias="TELEMETRY_ENABLED")
    telemetry_url: str = Field(default="https://telemetry.actyze.ai/api/telemetry/ping", alias="TELEMETRY_URL")

    # =============================================================================
    # Predictive Intelligence
    # =============================================================================
    prediction_enabled: bool = True                           # PREDICTION_ENABLED
    prediction_worker_xgboost_url: str = "http://prediction-worker-xgboost:8400"
    prediction_worker_lightgbm_url: str = "http://prediction-worker-lightgbm:8400"
    prediction_worker_autogluon_url: str = "http://prediction-worker-autogluon:8400"
    prediction_worker_timeout: int = 600                      # seconds — training can take minutes
    prediction_worker_health_timeout: int = 5                 # seconds — health check timeout
    prediction_worker_secret: str = ""                        # shared secret for worker auth (X-Worker-Secret header)
    prediction_sweep_interval_seconds: int = 300              # how often to check for due pipelines

    # =============================================================================
    # Feature Flags
    # =============================================================================
    feature_user_management: bool = True
    feature_conversation_history: bool = True
    feature_query_caching: bool = True
    feature_schema_recommendations: bool = True
    feature_sql_correction: bool = True
    feature_use_litellm: bool = True  # Use LiteLLM for multi-provider support (set to False to use legacy code)
    relationship_graph_enabled: bool = False  # Enable graph-backed relationships in prompts (safe: falls back to inference when off)
    
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
        populate_by_name = True


# Global settings instance
settings = Settings()
