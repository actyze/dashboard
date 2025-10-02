FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install PyTorch CPU (latest stable)
RUN pip3 install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install other dependencies (compatible versions for Phi-4)
RUN pip3 install --no-cache-dir transformers==4.53.3 peft==0.17.1 fastapi uvicorn accelerate torchao

# Copy application code
COPY scripts/ ./scripts/
COPY adapters/ ./adapters/

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Check quantization backends available
RUN python3 -c "import torch; print('Available quantization engines:', torch.backends.quantized.supported_engines)"

# Run the CPU INT8 server
CMD ["python3", "scripts/cpu_int8_server.py"]
