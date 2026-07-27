# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Build stage — compilers and build-only packages live here and never ship.
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY schema-service/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && pip uninstall -y pip setuptools wheel

# ---------------------------------------------------------------------------
# Runtime stage — no compilers, no pip/setuptools/wheel, no build artifacts.
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin --uid 10001 app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app shared/observability/python /shared/observability/python
# Single destination argument: the previous `COPY schema-service . .` form
# copied the entire build context (including .git) into the image.
COPY --chown=app:app schema-service .

USER 10001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=5).status==200 else 1)"]

CMD ["python", "schema_service.py"]
