#!/bin/bash
# Start FastAPI ML service with CodeT5+ dual-model

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Shutdown existing FastAPI service ---
EXISTING_FASTAPI_PID=$(ps aux | grep 'dual_model_server.py\|uvicorn.*dual_model_server' | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_FASTAPI_PID" ]; then
  echo "Stopping existing FastAPI process: $EXISTING_FASTAPI_PID"
  kill $EXISTING_FASTAPI_PID
  sleep 3
fi

# Check if virtual environment exists, create if not
if [ ! -d "$SCRIPT_DIR/trainer/venv" ]; then
  echo "Creating Python virtual environment..."
  cd "$SCRIPT_DIR/trainer"
  python3 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  echo "Activating existing virtual environment..."
  cd "$SCRIPT_DIR/trainer"
  source venv/bin/activate
fi

# Install MCP servers if not already installed
if ! command -v npx &> /dev/null; then
  echo "Warning: Node.js/npm not found. Chart MCP server will not work."
fi

# Start FastAPI service
echo "Starting FastAPI service with CodeT5+ dual-model..."
python dual_model_server.py > "$SCRIPT_DIR/fastapi.log" 2>&1 &
FASTAPI_PID=$!
echo $FASTAPI_PID > "$SCRIPT_DIR/fastapi.pid"
echo "FastAPI service started with PID $FASTAPI_PID. Logs: $SCRIPT_DIR/fastapi.log"

# Wait for service to start
sleep 10

# Test health endpoint
if curl -s http://localhost:8000/health > /dev/null; then
  echo "✅ FastAPI service is healthy and ready"
else
  echo "❌ FastAPI service failed to start properly"
  echo "Check logs: tail -f $SCRIPT_DIR/fastapi.log"
fi