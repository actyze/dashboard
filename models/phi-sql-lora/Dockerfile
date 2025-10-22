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

# Install PyTorch with CUDA support (T4 optimized)
RUN pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install other dependencies (compatible versions for Phi-4)
RUN pip3 install --no-cache-dir transformers==4.53.3 peft==0.17.1 fastapi uvicorn accelerate

# Copy application code
COPY scripts/ ./scripts/
COPY adapters/ ./adapters/

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Check GPU availability
RUN python3 -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda)"

# Run the T4-only server
CMD ["python3", "scripts/t4_phi4_server.py"]
