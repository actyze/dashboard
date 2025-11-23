#!/bin/bash
# Start frontend and backend services only

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Dashboard Services (Frontend + Backend)"
echo "=================================================="

# --- Shutdown existing services ---
echo "🛑 Stopping existing services..."

# Stop backend
EXISTING_BACKEND_PID=$(ps aux | grep 'org.springframework.boot.loader.JarLauncher\|spring-boot:run' | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_BACKEND_PID" ]; then
  echo "Stopping existing backend process: $EXISTING_BACKEND_PID"
  kill $EXISTING_BACKEND_PID
  sleep 2
fi

# Stop frontend
EXISTING_FRONTEND_PID=$(ps aux | grep 'npm start' | grep "$SCRIPT_DIR/frontend" | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_FRONTEND_PID" ]; then
  echo "Stopping existing frontend process: $EXISTING_FRONTEND_PID"
  kill $EXISTING_FRONTEND_PID
  sleep 2
fi

# --- Start Backend (Spring Boot) ---
echo "🏗️ Starting Spring Boot backend..."
(cd "$SCRIPT_DIR/backend" && mvn spring-boot:run > "$SCRIPT_DIR/backend.log" 2>&1 &)
BACKEND_PID=$!
echo "✅ Backend started with PID $BACKEND_PID (Port 8080)"

# Wait for backend to initialize
echo "⏳ Waiting for backend to start..."
sleep 10

# Check backend health
echo "🔍 Checking backend health..."
if curl -s http://localhost:8080/actuator/health > /dev/null; then
  echo "✅ Backend (Spring Boot) is healthy"
else
  echo "❌ Backend failed to start - check backend.log"
fi

# --- Start Frontend (React) ---
echo "🎨 Starting React frontend..."
echo "📱 Frontend will open in your browser at http://localhost:3000"
echo "🔗 Backend API: http://localhost:8080"
echo "=================================================="

# Start frontend in foreground
(cd "$SCRIPT_DIR/frontend" && npm start)
