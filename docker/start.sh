#!/bin/bash

# Dashboard Local Development Starter
# Usage: ./start.sh [--build] [--logs]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Dashboard Local Development Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your API keys before continuing."
    echo "   Especially set PERPLEXITY_API_KEY for SQL generation to work."
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to exit and edit .env..."
fi

# Parse arguments
NO_BUILD_FLAG=""
LOGS_FLAG=""
PROFILE="local"  # Default profile

for arg in "$@"; do
    case $arg in
        --no-build)
            NO_BUILD_FLAG="true"
            shift
            ;;
        --logs)
            LOGS_FLAG="--follow"
            shift
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --profile=*)
            PROFILE="${arg#*=}"
            shift
            ;;
        *)
            echo "Usage: $0 [--no-build] [--logs] [--profile PROFILE]"
            echo "  --no-build:        Skip building images (use existing)"
            echo "  --logs:            Follow logs after starting"
            echo "  --profile PROFILE: Docker compose profile to use"
            echo ""
            echo "Available profiles:"
            echo "  local         - Local PostgreSQL + Trino (default)"
            echo "  external      - External PostgreSQL + Trino only"
            echo "  postgres-only - Local PostgreSQL + External Trino"
            echo "  trino-only    - External PostgreSQL + Local Trino"
            exit 1
            ;;
    esac
done

# Start services
echo "📦 Starting services with profile: $PROFILE"
if [ -z "$NO_BUILD_FLAG" ]; then
    echo "🔨 Building images locally..."
    docker-compose --profile $PROFILE up -d --build
else
    echo "⚡ Using existing images..."
    docker-compose --profile $PROFILE up -d
fi

echo ""
echo "⏳ Waiting for services to be healthy..."

# Wait for services to be ready
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "healthy"; then
        healthy_count=$(docker-compose ps | grep -c "healthy" || echo "0")
        total_services=5  # postgres, trino, schema-service, nexus, frontend
        
        echo "📊 Services healthy: $healthy_count/$total_services"
        
        if [ "$healthy_count" -eq "$total_services" ]; then
            break
        fi
    fi
    
    sleep 5
    attempt=$((attempt + 1))
done

echo ""
echo "✅ Dashboard is ready!"
echo ""
echo "🌐 Access URLs:"
echo "  📱 Frontend:      http://localhost:3000"
echo "  🔧 Nexus API:     http://localhost:8000"
echo "  🤖 Schema API:    http://localhost:8001"
echo "  🗄️  Trino:         http://localhost:8081"
echo "  🐘 PostgreSQL:    localhost:5432"
echo ""
echo "💡 Useful commands:"
echo "  ./stop.sh                    - Stop all services"
echo "  docker-compose logs -f       - View all logs"
echo "  docker-compose ps            - Check service status"
echo ""

if [ -n "$LOGS_FLAG" ]; then
    echo "📋 Following logs (Ctrl+C to exit)..."
    docker-compose logs -f
fi
