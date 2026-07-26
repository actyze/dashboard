FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy shared observability library first
COPY shared/observability/python /shared/observability/python

# Copy requirements and install
COPY schema-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY schema-service . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run app
CMD ["python", "schema_service.py"]
