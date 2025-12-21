#!/bin/bash

BASE_URL="http://localhost:8000"
SCHEMA_SERVICE_URL="http://localhost:8001"

echo "========================================="
echo "Testing ACCEPT_RESULT Intent"
echo "========================================="
echo ""

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=nexus_admin&password=admin")
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

echo "1. Test Intent Detection: 'this is good'"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$SCHEMA_SERVICE_URL/intent/detect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "this is good"}')

INTENT=$(echo $RESPONSE | grep -o '"intent":"[^"]*' | sed 's/"intent":"//')
CONFIDENCE=$(echo $RESPONSE | grep -o '"confidence":[0-9.]*' | sed 's/"confidence"://')
echo "Intent: $INTENT (confidence: $CONFIDENCE)"
echo ""

echo "2. Test Full Flow: Initial Query"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-sql" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nl_query": "Find all orders over $1000 this month",
    "conversation_history": [],
    "session_id": "test-accept-intent"
  }')

SQL=$(echo $RESPONSE | grep -o '"generated_sql":"[^"]*' | head -1 | sed 's/"generated_sql":"//' | cut -c1-80)
echo "Generated SQL: $SQL..."
echo ""

# Extract SQL for next request (simplified)
LAST_SQL="SELECT * FROM postgres.demo_ecommerce.orders WHERE total_amount > 1000"
LAST_SCHEMA='[{"catalog":"postgres","schema":"demo_ecommerce","table":"orders","type":"TABLE","full_name":"postgres.demo_ecommerce.orders","columns":["order_id","customer_id"]}]'

echo "3. Test ACCEPT_RESULT: 'this is good'"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-sql" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nl_query": "this is good",
    "conversation_history": ["Find all orders over $1000 this month", "this is good"],
    "session_id": "test-accept-intent",
    "last_sql": "'"$LAST_SQL"'",
    "last_schema_recommendations": '"$LAST_SCHEMA"'
  }')

SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,]*' | sed 's/"success"://')
INTENT=$(echo $RESPONSE | grep -o '"intent":"[^"]*' | sed 's/"intent":"//')
NO_LLM=$(echo $RESPONSE | grep -o '"no_llm_call":[^,]*' | sed 's/"no_llm_call"://')
REASONING=$(echo $RESPONSE | grep -o '"model_reasoning":"[^"]*' | sed 's/"model_reasoning":"//')

echo "Success: $SUCCESS"
echo "Intent: $INTENT"
echo "No LLM Call: $NO_LLM"
echo "Reasoning: $REASONING"
echo ""

if [ "$NO_LLM" = "true" ]; then
  echo "✅ ACCEPT_RESULT working correctly - no LLM call made!"
else
  echo "❌ ACCEPT_RESULT not working - LLM was called unnecessarily"
fi
