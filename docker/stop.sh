#!/bin/bash

# Dashboard Local Development Stopper
# Usage: ./stop.sh [--clean]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping Dashboard Local Development Environment..."

# Parse arguments
CLEAN_FLAG=""

for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_FLAG="true"
            shift
            ;;
        *)
            echo "Usage: $0 [--clean]"
            echo "  --clean: Remove volumes and networks (full cleanup)"
            exit 1
            ;;
    esac
done

# Stop services
echo "📦 Stopping all services..."
docker-compose down

if [ -n "$CLEAN_FLAG" ]; then
    echo "🧹 Cleaning up volumes and networks..."
    docker-compose down -v --remove-orphans
    
    # Remove any dangling images
    echo "🗑️  Removing unused Docker resources..."
    docker system prune -f
    
    echo "✅ Full cleanup completed!"
else
    echo "✅ Services stopped (data preserved)"
    echo "💡 Use './stop.sh --clean' to remove all data and start fresh"
fi

echo ""
echo "🔄 To start again: ./start.sh"
