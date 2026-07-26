"""Structured logging configuration - wrapper around shared observability library."""

import sys
from typing import Optional
from pathlib import Path
import importlib.util

# Add shared observability/python directory to path (but only the parent to load the module)
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
if str(shared_obs_path) not in sys.path:
    sys.path.insert(0, str(shared_obs_path))

# Import shared structured_logging module explicitly to avoid naming conflicts with Python's logging
structured_logging_spec = importlib.util.spec_from_file_location("obs_structured_logging", shared_obs_path / "structured_logging.py")
obs_structured_logging = importlib.util.module_from_spec(structured_logging_spec)
structured_logging_spec.loader.exec_module(obs_structured_logging)

from app.config import settings


# Re-export context setters/getters from shared library
get_request_id = obs_structured_logging.get_request_id
set_request_id = obs_structured_logging.set_request_id
get_user_id = obs_structured_logging.get_user_id
set_user_id = obs_structured_logging.set_user_id
get_query_id = obs_structured_logging.get_query_id
set_query_id = obs_structured_logging.set_query_id
get_session_id = obs_structured_logging.get_session_id
set_session_id = obs_structured_logging.set_session_id
get_logger = obs_structured_logging.get_logger


def configure_logging(service_name: str = "nexus", **kwargs):
    """Initialize structured logging for Nexus."""
    return obs_structured_logging.configure_logging(
        service_name=service_name,
        log_level=getattr(settings, "LOG_LEVEL", "INFO"),
        log_format="json",
        **kwargs
    )
