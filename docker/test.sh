#!/bin/bash

# Dashboard Local Development Tester
# Usage: ./test.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧪 Testing Dashboard Local Development Environment..."

# Check if services are running
echo "📊 Checking service status..."
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Services are not running. Start them with: ./start.sh"
    exit 1
fi

echo "✅ Services are running"

# Test database connection
echo "🐘 Testing PostgreSQL connection..."
if docker exec dashboard-postgres pg_isready -U nexus_service -d dashboard > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL connection failed"
    exit 1
fi

# Test Trino connection
echo "🗄️  Testing Trino connection..."
if curl -s http://localhost:8081/v1/info > /dev/null 2>&1; then
    echo "✅ Trino is ready"
else
    echo "❌ Trino connection failed"
    exit 1
fi

# Test Schema Service
echo "🤖 Testing Schema Service..."
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ Schema Service is ready"
else
    echo "❌ Schema Service connection failed"
    exit 1
fi

# Test Nexus API
echo "🔧 Testing Nexus API..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Nexus API is ready"
else
    echo "❌ Nexus API connection failed"
    exit 1
fi

# Test Frontend
echo "📱 Testing Frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is ready"
else
    echo "❌ Frontend connection failed"
    exit 1
fi

# Test demo data
echo "📊 Testing demo data..."
CUSTOMER_COUNT=$(docker exec dashboard-postgres psql -U nexus_service -d dashboard -t -c "SELECT COUNT(*) FROM demo_ecommerce.customers;" 2>/dev/null | tr -d ' \n' || echo "0")

if [ "$CUSTOMER_COUNT" -gt "0" ]; then
    echo "✅ Demo data loaded ($CUSTOMER_COUNT customers)"
else
    echo "❌ Demo data not found"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Dashboard is ready for development."
echo ""
echo "🌐 Access URLs:"
echo "  📱 Frontend:      http://localhost:3000"
echo "  🔧 Nexus API:     http://localhost:8000/docs"
echo "  🤖 Schema API:    http://localhost:8001/docs"
echo "  🗄️  Trino:         http://localhost:8081"
echo ""
echo "💡 Try asking: 'Show me the top 5 customers by total orders'"
