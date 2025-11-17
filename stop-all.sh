#!/bin/bash
# Stop all dashboard services: backend (Spring Boot) and frontend (React)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping Dashboard Services"
echo "==============================="

# Stop backend
echo "Stopping Spring Boot backend..."
EXISTING_BACKEND_PID=$(ps aux | grep 'org.springframework.boot.loader.JarLauncher\|spring-boot:run' | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_BACKEND_PID" ]; then
  echo "Stopping backend process: $EXISTING_BACKEND_PID"
  kill $EXISTING_BACKEND_PID
  sleep 2
  echo "✅ Backend stopped"
else
  echo "ℹ️  Backend not running"
fi

# Stop frontend
echo "Stopping React frontend..."
FRONTEND_PIDS=$(ps aux | grep -E "npm start|react-scripts.*start|node.*frontend" | grep -v grep | awk '{print $2}')
if [ -n "$FRONTEND_PIDS" ]; then
  echo "Stopping frontend processes: $FRONTEND_PIDS"
  kill $FRONTEND_PIDS
  sleep 2
  echo "✅ Frontend stopped"
else
  echo "ℹ️  Frontend not running"
fi

# Clean up log files
echo "Cleaning up log files..."
rm -f "$SCRIPT_DIR/backend.log"

echo "==============================="
echo "✅ All dashboard services stopped"