# Actyze Observability Module - Documentation Index

Complete guide to navigating the observability module documentation and implementation.

## Start Here

**New to the module?** Start with one of these based on your role:

### For Architects & Tech Leads
1. Read [OVERVIEW.md](OVERVIEW.md) - Architecture and design
2. Review [MODULE_SUMMARY.md](MODULE_SUMMARY.md) - What's included
3. Check [python/README.md](python/README.md) - API reference

### For Service Developers
1. Follow [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Step-by-step (10 steps)
2. Look at [python/EXAMPLES.md](python/EXAMPLES.md) - Real-world code
3. Reference [python/README.md](python/README.md) - When stuck

### For Contributor/Reviewer
1. Read [MODULE_SUMMARY.md](MODULE_SUMMARY.md) - Complete overview
2. Review implementation files in [python/](python/)
3. Check dependencies in [python/requirements.txt](python/requirements.txt)

---

## Documentation Map

### Quick Overview (5 minutes)
- **[OVERVIEW.md](OVERVIEW.md)** - What is this module, why use it, quick structure

### Architecture (10 minutes)
- **[MODULE_SUMMARY.md](MODULE_SUMMARY.md)** - Complete breakdown of every file

### Implementation (20 minutes)
- **[python/logging.py](python/logging.py)** - Structured logging (155 lines)
- **[python/metrics.py](python/metrics.py)** - Prometheus metrics (431 lines)
- **[python/health.py](python/health.py)** - Health checks (379 lines)

### Getting Started (30 minutes)
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - 10-step integration checklist
- **[python/README.md](python/README.md)** - Comprehensive usage guide

### Examples & Patterns (45 minutes)
- **[python/EXAMPLES.md](python/EXAMPLES.md)** - 6 real-world code examples

---

## Directory Structure

```
shared/observability/
│
├── INDEX.md                    ← YOU ARE HERE
├── OVERVIEW.md                 Quick overview for architects
├── MODULE_SUMMARY.md           Complete breakdown of module
├── INTEGRATION_GUIDE.md        Step-by-step integration for developers
│
└── python/
    ├── __init__.py             Public API exports
    ├── logging.py              Structured logging with structlog
    ├── metrics.py              Prometheus metrics
    ├── health.py               Health checks & readiness probes
    ├── requirements.txt        Dependencies
    ├── README.md               Comprehensive usage guide
    ├── EXAMPLES.md             Real-world code examples
    └── [Tests directory - future]
```

---

## Key Features at a Glance

### Structured Logging
```python
from observability.python import configure_logging, get_logger, set_request_id

configure_logging("my-service", log_format="json")
logger = get_logger(__name__)
set_request_id("req-123")
logger.info("query_executed", duration_ms=1234)
# Outputs JSON with automatic request_id, timestamp, etc.
```

### Prometheus Metrics
```python
from observability.python import MetricsContext, record_sql_execution
import time

with MetricsContext("GET", "/api/queries") as ctx:
    start = time.time()
    result = await db.query(sql)
    record_sql_execution(time.time() - start, catalog="trino", row_count=len(result))
    ctx.set_status(200)
```

### Health Checks
```python
from observability.python import HealthChecker, check_http_endpoint

health = HealthChecker()
health.register("trino", lambda: check_http_endpoint("http://trino:8080"))
result = await health.check_all()
return result.to_dict(), 200 if result.healthy else 503
```

---

## Quick Navigation by Task

### I want to...

#### ...understand what this module does
→ [OVERVIEW.md](OVERVIEW.md) (5 min read)

#### ...see complete implementation
→ [MODULE_SUMMARY.md](MODULE_SUMMARY.md) (10 min read)

#### ...integrate into my service
→ [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) (step-by-step)

#### ...see working code examples
→ [python/EXAMPLES.md](python/EXAMPLES.md) (6 examples)

#### ...learn the complete API
→ [python/README.md](python/README.md) (detailed reference)

#### ...migrate from Nexus implementation
→ [INTEGRATION_GUIDE.md#migration-from-nexus](INTEGRATION_GUIDE.md) (Nexus section)

#### ...troubleshoot a problem
→ [INTEGRATION_GUIDE.md#troubleshooting](INTEGRATION_GUIDE.md) (troubleshooting)

#### ...implement a custom health check
→ [python/README.md#health-checks](python/README.md) (health check examples)

#### ...track specific metrics
→ [python/README.md#available-metrics-reference](python/README.md) (metrics list)

#### ...set up Kubernetes probes
→ [INTEGRATION_GUIDE.md#step-9-configure-kubernetes-probes](INTEGRATION_GUIDE.md) (K8s config)

---

## File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| python/logging.py | 155 | Structured logging implementation |
| python/metrics.py | 431 | Prometheus metrics implementation |
| python/health.py | 379 | Health check implementation |
| python/__init__.py | 132 | Public API exports |
| python/README.md | 468 | Comprehensive usage guide |
| python/EXAMPLES.md | 500+ | Real-world code examples |
| OVERVIEW.md | 208 | Architecture overview |
| INTEGRATION_GUIDE.md | 350+ | Step-by-step integration |
| MODULE_SUMMARY.md | 350+ | Complete module breakdown |
| **Total** | **2,822** | **Code + Documentation** |

---

## Reading Recommendations

### 10-Minute Overview
1. [OVERVIEW.md](OVERVIEW.md) - Quick architecture overview
2. [MODULE_SUMMARY.md#file-descriptions](MODULE_SUMMARY.md) - What each file does

### 30-Minute Deep Dive
1. [OVERVIEW.md](OVERVIEW.md) - Architecture (5 min)
2. [python/README.md#quick-start](python/README.md) - Quick start examples (10 min)
3. [MODULE_SUMMARY.md#key-features](MODULE_SUMMARY.md) - Feature overview (5 min)
4. [INTEGRATION_GUIDE.md#overview](INTEGRATION_GUIDE.md) - Integration overview (10 min)

### 1-Hour Complete Study
1. [OVERVIEW.md](OVERVIEW.md) (10 min)
2. [python/README.md](python/README.md) - Full usage guide (20 min)
3. [python/EXAMPLES.md](python/EXAMPLES.md) - Code examples (20 min)
4. [MODULE_SUMMARY.md](MODULE_SUMMARY.md) - Complete breakdown (10 min)

### Full Mastery (3-4 Hours)
1. All documentation above (1-2 hours)
2. Read implementation files:
   - [python/logging.py](python/logging.py) (20 min)
   - [python/metrics.py](python/metrics.py) (20 min)
   - [python/health.py](python/health.py) (20 min)
3. [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Full integration (30 min)
4. Follow along with [python/EXAMPLES.md](python/EXAMPLES.md) (30 min)

---

## Quick Reference

### Logging
```python
from observability.python import (
    configure_logging,        # Set up logging
    get_logger,              # Get logger instance
    set_request_id,          # Set request context
    set_user_id,             # Set user context
    set_query_id,            # Set query context
    set_session_id,          # Set session context
)
```

### Metrics
```python
from observability.python import (
    MetricsContext,          # Context manager for HTTP metrics
    record_sql_execution,    # Track database queries
    record_llm_call,         # Track LLM API calls
    record_cache_hit,        # Track cache operations
    record_cache_miss,
    record_prediction,       # Track ML predictions
    set_service_health,      # Track external service health
)
```

### Health
```python
from observability.python import (
    HealthChecker,           # Health check orchestrator
    ReadinessChecker,        # Readiness probe checks
    HealthStatus,            # Single check result
    check_http_endpoint,     # Pre-built HTTP check
    check_database_connection,  # Pre-built database check
    check_redis_connection,  # Pre-built Redis check
)
```

---

## Related Resources

### Within Actyze
- [Nexus API](../../nexus/README.md) - Original implementation reference
- [Schema Service](../../schema-service/) - Potential adopter
- [Prediction Workers](../../docker/prediction-worker-lightgbm/) - Potential adopter

### External
- [Prometheus Instrumentation](https://prometheus.io/docs/practices/instrumentation/)
- [structlog Documentation](https://www.structlog.org/)
- [Python Logging](https://docs.python.org/3/library/logging.html)
- [Asyncio Documentation](https://docs.python.org/3/library/asyncio.html)

---

## How to Use This Index

1. **Bookmark this file** - Reference it whenever you need to find something
2. **Share the link** - Point teammates to this when asking questions
3. **Print the table above** - Keep quick reference handy
4. **Update as needed** - Add your own notes or custom patterns

---

## Document Conventions

### Notation
- `module.function()` - Python function
- `Class()` - Python class
- `/path/to/file` - File path
- `[Link Text](file.md)` - Cross-reference
- `<placeholder>` - User-supplied value

### Code Examples
All examples are syntactically correct and can be copied directly:
```python
# Real, working code
from observability.python import get_logger
logger = get_logger(__name__)
```

### Timestamps
- **Created**: June 14, 2025
- **Module Version**: 0.1.0
- **Python**: 3.11+
- **License**: AGPL-3.0

---

## Quick Answers

**Q: Where do I start?**
A: Read [OVERVIEW.md](OVERVIEW.md) first, then [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)

**Q: How do I integrate this?**
A: Follow the 10 steps in [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)

**Q: What metrics are available?**
A: See [python/README.md#available-metrics-reference](python/README.md)

**Q: How do I write custom health checks?**
A: See [python/README.md#health-checks](python/README.md)

**Q: Can I see working code?**
A: Yes, [python/EXAMPLES.md](python/EXAMPLES.md) has 6 complete examples

**Q: What are the dependencies?**
A: See [python/requirements.txt](python/requirements.txt) - already in Nexus

**Q: Is this AGPL compliant?**
A: Yes, all code is AGPL-3.0 compatible

**Q: How do I migrate from Nexus?**
A: Follow [INTEGRATION_GUIDE.md#migration-from-nexus](INTEGRATION_GUIDE.md)

---

## Feedback & Improvements

If you find issues or have suggestions:

1. Check [INTEGRATION_GUIDE.md#troubleshooting](INTEGRATION_GUIDE.md) first
2. Review examples in [python/EXAMPLES.md](python/EXAMPLES.md)
3. File an issue with reference to the relevant documentation section

---

**Last updated**: June 14, 2025
**Next review**: When integrated into first service (Nexus migration)
