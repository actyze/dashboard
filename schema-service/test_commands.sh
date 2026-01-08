#!/bin/bash

# FAISS Schema Service Test Commands
# Run these commands to test the schema service

echo "🔍 Testing FAISS Schema Service"
echo "================================"

# 1. Health Check
echo "1. Health Check:"
curl -s http://localhost:8001/health | python3 -m json.tool
echo ""

# 2. Get Schema Recommendations
echo "2. Schema Recommendations for 'customer sales data':"
curl -s -X POST http://localhost:8001/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "natural_language_query": "Show me customer sales data",
    "top_k": 3,
    "confidence_threshold": 0.3
  }' | python3 -m json.tool
echo ""

# 3. Test with different queries
echo "3. Schema Recommendations for 'user login information':"
curl -s -X POST http://localhost:8001/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "natural_language_query": "Find user login information",
    "top_k": 5,
    "confidence_threshold": 0.2
  }' | python3 -m json.tool
echo ""

# 4. List all schemas
echo "4. List all loaded schemas:"
curl -s http://localhost:8001/schemas | python3 -m json.tool
echo ""

# 5. Manual refresh
echo "5. Manual schema refresh:"
curl -s -X POST http://localhost:8001/refresh | python3 -m json.tool
echo ""

echo "✅ Testing complete!"
