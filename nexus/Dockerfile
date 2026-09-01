# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Build stage — compilers and build-only packages live here and never ship.
# ---------------------------------------------------------------------------
FROM python:3.14-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

# g++ as well as gcc: meson-based sdists need a C++ compiler.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY nexus/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && pip uninstall -y pip setuptools wheel

# ---------------------------------------------------------------------------
# Runtime stage — no compilers, no pip/setuptools/wheel, no build artifacts.
# ---------------------------------------------------------------------------
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# libpq5 is the runtime half of libpq-dev (psycopg2).
# postgresql-client provides the `psql` binary, which app/migrations.py shells
# out to on startup to read applied migrations without holding a connection
# lock. Dropping it makes every migration fail with
# "[Errno 2] No such file or directory: 'psql'", the lifespan raises
# RuntimeError("Database migrations failed"), and the container exits 0 into a
# crash loop. libpq5 is the shared library only and does not provide psql.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin --uid 10001 app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app shared/observability/python /shared/observability/python
COPY --chown=app:app nexus .

USER 10001

EXPOSE 8000

# stdlib probe — avoids shipping curl purely to health-check ourselves.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=5).status==200 else 1)"]

CMD ["python", "main.py"]
