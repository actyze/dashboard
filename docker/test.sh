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
    echo "⚠️  Demo data not found (skipping — may not be seeded)"
fi

# =========================================================================
# API Smoke Tests — validate core product flows against the real stack
# =========================================================================
echo ""
echo "🔐 Testing authentication..."
LOGIN_RESPONSE=$(curl -sf -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=nexus_admin&password=admin" 2>&1)

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login works (nexus_admin)"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
else
    echo "❌ Login failed: $LOGIN_RESPONSE"
    exit 1
fi

echo "👤 Testing authenticated user profile..."
ME_RESPONSE=$(curl -sf http://localhost:8000/api/auth/users/me \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$ME_RESPONSE" | grep -q "nexus_admin"; then
    echo "✅ /auth/users/me returns correct user"
else
    echo "❌ /auth/users/me failed: $ME_RESPONSE"
    exit 1
fi

echo "📋 Testing dashboard CRUD..."
# Create
DASH_CREATE=$(curl -sf -X POST http://localhost:8000/api/dashboards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke Test Dashboard","description":"Created by test.sh"}' 2>&1)

if echo "$DASH_CREATE" | grep -q '"success":true\|"success": true'; then
    DASH_ID=$(echo "$DASH_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['dashboard']['id'])" 2>/dev/null)
    echo "✅ Dashboard created ($DASH_ID)"
else
    echo "❌ Dashboard creation failed: $DASH_CREATE"
    exit 1
fi

# List
DASH_LIST=$(curl -sf http://localhost:8000/api/dashboards \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$DASH_LIST" | grep -q "Smoke Test Dashboard"; then
    echo "✅ Dashboard appears in list"
else
    echo "❌ Dashboard not found in list: $DASH_LIST"
    exit 1
fi

# Delete (cleanup)
curl -sf -X DELETE "http://localhost:8000/api/dashboards/$DASH_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
echo "✅ Dashboard deleted (cleanup)"

echo "👥 Testing admin endpoints..."
USERS_RESPONSE=$(curl -sf http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$USERS_RESPONSE" | grep -q "nexus_admin"; then
    echo "✅ Admin user listing works"
else
    echo "❌ Admin user listing failed: $USERS_RESPONSE"
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
