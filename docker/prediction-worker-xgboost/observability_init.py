"""Initialize observability for prediction-worker-xgboost."""

import sys
from pathlib import Path
import importlib.util

# Import shared modules
shared_obs_path = Path(__file__).parent.parent.parent / "shared" / "observability" / "python"
sys.path.insert(0, str(shared_obs_path))

structured_logging_spec = importlib.util.spec_from_file_location("obs_structured_logging", shared_obs_path / "structured_logging.py")
obs_structured_logging = importlib.util.module_from_spec(structured_logging_spec)
structured_logging_spec.loader.exec_module(obs_structured_logging)

metrics_spec = importlib.util.spec_from_file_location("obs_metrics", shared_obs_path / "metrics.py")
obs_metrics = importlib.util.module_from_spec(metrics_spec)
metrics_spec.loader.exec_module(obs_metrics)

health_spec = importlib.util.spec_from_file_location("obs_health", shared_obs_path / "health.py")
obs_health = importlib.util.module_from_spec(health_spec)
health_spec.loader.exec_module(obs_health)


def configure_observability(service_name: str = "prediction-worker-xgboost", log_level: str = "INFO"):
    """Configure all observability components for prediction worker."""
    
    # Configure structured logging
    obs_structured_logging.configure_logging(
        service_name=service_name,
        log_level=log_level,
        log_format="json"
    )
    
    # Configure Prometheus metrics
    obs_metrics.configure_metrics()
    
    return obs_structured_logging, obs_metrics, obs_health
