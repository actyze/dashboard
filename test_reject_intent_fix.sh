#!/bin/bash

BASE_URL="http://localhost:8000"

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=nexus_admin&password=admin")
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

echo "Token obtained: ${TOKEN:0:20}..."
echo ""

# Initial query
echo "1. Initial Query: 'sales data for last month'"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-sql" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nl_query": "sales data for last month",
    "conversation_history": [],
    "session_id": "test-session-reject"
  }')

INTENT=$(echo $RESPONSE | grep -o '"intent":"[^"]*' | sed 's/"intent":"//')
SQL=$(echo $RESPONSE | grep -o '"generated_sql":"[^"]*' | head -1 | sed 's/"generated_sql":"//' | cut -c1-80)
SCHEMA_COUNT=$(echo $RESPONSE | grep -o '"full_name"' | wc -l | tr -d ' ')

echo "Intent: $INTENT"
echo "Schema Count: $SCHEMA_COUNT"
echo "SQL: $SQL..."
echo ""

# Follow-up: "this is wrong"
echo "2. Follow-up Query: 'this is wrong' (REJECT_RESULT)"
echo "-------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-sql" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nl_query": "this is wrong",
    "conversation_history": ["sales data for last month", "this is wrong"],
    "session_id": "test-session-reject"
  }')

SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,]*' | sed 's/"success"://')
INTENT=$(echo $RESPONSE | grep -o '"intent":"[^"]*' | sed 's/"intent":"//')
SQL=$(echo $RESPONSE | grep -o '"generated_sql":"[^"]*' | head -1 | sed 's/"generated_sql":"//' | cut -c1-80)
ERROR=$(echo $RESPONSE | grep -o '"error":"[^"]*' | sed 's/"error":"//')

echo "Success: $SUCCESS"
echo "Intent: $INTENT"
if [ "$SUCCESS" = "true" ]; then
  echo "SQL: $SQL..."
  echo ""
  echo "✅ FIX SUCCESSFUL - Schema was properly reused!"
else
  echo "Error: $ERROR"
  echo ""
  echo "❌ FIX FAILED - Schema not passed to LLM"
fi
