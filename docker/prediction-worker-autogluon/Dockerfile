FROM python:3.11-slim

WORKDIR /app

# Copy shared observability library first (for caching)
COPY shared/observability/python ./shared_obs

# Copy requirements and install dependencies
COPY docker/prediction-worker-${WORKER_TYPE}/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY docker/prediction-worker-${WORKER_TYPE}/ .

# Set Python path to include shared observability
ENV PYTHONPATH=/app:/app/shared_obs:$PYTHONPATH

EXPOSE 8400

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8400/healthz || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8400"]
