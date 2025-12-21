#!/bin/bash

# Test script for simplified query history API
# Tests: get history, toggle favorite, get favorites

NEXUS_URL="http://localhost:8000"
TOKEN="test_token_12345"

echo "============================================="
echo "Testing Simplified Query History API"
echo "============================================="

# Step 1: Login to get a real token
echo ""
echo "Step 1: Login as john_doe"
LOGIN_RESPONSE=$(curl -s -X POST "${NEXUS_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "password123"
  }')
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "Token obtained: ${TOKEN:0:20}..."

# Step 2: Get query history
echo ""
echo "Step 2: Get query history (first 5)"
echo "-------------------------------------"
curl -s -X GET "${NEXUS_URL}/api/query-history?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.queries[] | {id, query_name, is_favorite, execution_count, last_executed_at}'

# Step 3: Toggle favorite on first query
echo ""
echo "Step 3: Toggle favorite on query ID 1"
echo "-------------------------------------"
curl -s -X POST "${NEXUS_URL}/api/query-history/1/favorite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"favorite_name": "My First Favorite"}' | jq '.'

# Step 4: Get favorites only
echo ""
echo "Step 4: Get favorites only"
echo "-------------------------------------"
curl -s -X GET "${NEXUS_URL}/api/query-history?favorites_only=true&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.queries[] | {id, favorite_name, is_favorite, execution_count}'

# Step 5: Toggle favorite again (should unfavorite)
echo ""
echo "Step 5: Toggle favorite again (unfavorite)"
echo "-------------------------------------"
curl -s -X POST "${NEXUS_URL}/api/query-history/1/favorite" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Step 6: Verify it's no longer favorite
echo ""
echo "Step 6: Verify favorites list is empty (or doesn't include ID 1)"
echo "-------------------------------------"
curl -s -X GET "${NEXUS_URL}/api/query-history?favorites_only=true&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.queries[] | {id, favorite_name, is_favorite}'

echo ""
echo "============================================="
echo "Test Complete!"
echo "============================================="

