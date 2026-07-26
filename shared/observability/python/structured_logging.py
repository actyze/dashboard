"""Structured logging configuration for Actyze services.

This module provides reusable structured logging setup using structlog,
with support for context variables (request_id, user_id, etc.) and
multiple output formats (JSON, console).

Example:
    from observability.logging import configure_logging, get_logger

    # Configure logging once at startup
    configure_logging(service_name="my-service", log_level="INFO", log_format="json")

    # Get logger and use it
    logger = get_logger(__name__)
    logger.info("process_started", user_id="user123", duration_ms=1234)
"""

import logging
import sys
from typing import Optional
from contextvars import ContextVar
import structlog


# Context variables for request tracing
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
query_id_var: ContextVar[Optional[str]] = ContextVar('query_id', default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)


def get_request_id() -> Optional[str]:
    """Get current request ID from context."""
    return request_id_var.get()


def set_request_id(request_id: str) -> None:
    """Set request ID in context."""
    request_id_var.set(request_id)


def get_user_id() -> Optional[str]:
    """Get current user ID from context."""
    return user_id_var.get()


def set_user_id(user_id: str) -> None:
    """Set user ID in context."""
    user_id_var.set(user_id)


def get_query_id() -> Optional[str]:
    """Get current query ID from context."""
    return query_id_var.get()


def set_query_id(query_id: str) -> None:
    """Set query ID in context."""
    query_id_var.set(query_id)


def get_session_id() -> Optional[str]:
    """Get current session ID from context."""
    return session_id_var.get()


def set_session_id(session_id: str) -> None:
    """Set session ID in context."""
    session_id_var.set(session_id)


def add_context_fields(logger, method_name: str, event_dict: dict) -> dict:
    """Add context fields (request_id, user_id, query_id, session_id) to all logs.

    Args:
        logger: The logger instance (unused, required by structlog).
        method_name: The name of the method called on the logger (unused).
        event_dict: The event dictionary to augment with context fields.

    Returns:
        The augmented event dictionary.
    """
    request_id = get_request_id()
    user_id = get_user_id()
    query_id = get_query_id()
    session_id = get_session_id()

    if request_id:
        event_dict['request_id'] = request_id
    if user_id:
        event_dict['user_id'] = user_id
    if query_id:
        event_dict['query_id'] = query_id
    if session_id:
        event_dict['session_id'] = session_id

    return event_dict


def configure_logging(
    service_name: str,
    log_level: str = "INFO",
    log_format: str = "json"
) -> None:
    """Configure structured logging with structlog.

    Args:
        service_name: Name of the service (added to all log events).
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        log_format: Output format ('json' or 'console').
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper(), logging.INFO)
    )

    # Configure structlog
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        add_context_fields,  # Add context variables
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if log_format.lower() == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: Optional[str] = None) -> structlog.BoundLogger:
    """Get a structured logger instance.

    Args:
        name: Optional logger name (typically __name__ from the calling module).

    Returns:
        A structlog BoundLogger instance.
    """
    return structlog.get_logger(name)
