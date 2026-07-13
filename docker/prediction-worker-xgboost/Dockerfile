FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y     build-essential     curl     && rm -rf /var/lib/apt/lists/*

# Copy shared observability library first
COPY shared/observability/python /shared/observability/python

# Copy requirements
COPY docker/prediction-worker-xgboost/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY docker/prediction-worker-xgboost . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3     CMD curl -f http://localhost:8400/health || exit 1

# Run app
CMD ["python", "main.py"]
