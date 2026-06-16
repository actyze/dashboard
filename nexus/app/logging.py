"""Structured logging configuration - wrapper around shared observability library."""

import sys
from typing import Optional
import structlog
from pathlib import Path
import importlib.util

# Add shared observability/python directory to path
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
if str(shared_obs_path) not in sys.path:
    sys.path.insert(0, str(shared_obs_path))

# Import shared logging module explicitly to avoid naming conflicts
logging_spec = importlib.util.spec_from_file_location("obs_logging", shared_obs_path / "logging.py")
obs_logging = importlib.util.module_from_spec(logging_spec)
logging_spec.loader.exec_module(obs_logging)

from app.config import settings


# Re-export context setters/getters from shared library
get_request_id = obs_logging.get_request_id
set_request_id = obs_logging.set_request_id
get_user_id = obs_logging.get_user_id
set_user_id = obs_logging.set_user_id
get_query_id = obs_logging.get_query_id
set_query_id = obs_logging.set_query_id
get_session_id = obs_logging.get_session_id
set_session_id = obs_logging.set_session_id


def configure_logging():
    """Configure structured logging with structlog.

    Uses shared observability library with nexus-specific settings.
    """
    # Configure shared observability logging
    obs_logging.configure_logging(
        service_name="nexus",
        log_level=settings.log_level,
        log_format=settings.log_format
    )

    # Get the logger to verify configuration
    logger = structlog.get_logger()
    logger.info("Logging configured", service="nexus", log_level=settings.log_level)


def get_logger(name: Optional[str] = None) -> structlog.BoundLogger:
    """Get a structured logger instance.

    Args:
        name: Optional logger name (typically __name__ from the calling module).

    Returns:
        A structlog BoundLogger instance from shared library.
    """
    return obs_logging.get_logger(name)
