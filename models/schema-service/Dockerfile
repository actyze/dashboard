FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install spaCy (without downloading models yet)
RUN pip install spacy

# Copy application code and model downloader
COPY schema_service.py download_models.py ./
COPY .env* ./

# Create directory for model cache
RUN mkdir -p /app/model_cache

# Expose port
EXPOSE 8001

# Health check with longer timeout for model loading
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:8001/health || exit 1

# Download models at startup if not cached, then run the application
CMD ["sh", "-c", "python download_models.py && python schema_service.py"]
