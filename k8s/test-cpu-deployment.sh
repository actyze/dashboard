#!/bin/bash

# Test Phi SQL LoRA CPU deployment on kind cluster
set -e

NAMESPACE="dashboard"
SERVICE_NAME="phi-sql-lora-cpu-service"
APP_LABEL="phi-sql-lora-cpu"

echo "🧪 Testing Phi SQL LoRA CPU deployment..."

# Check if deployment exists
if ! kubectl get deployment phi-sql-lora-cpu -n $NAMESPACE >/dev/null 2>&1; then
    echo "❌ Deployment not found. Please run deploy-cpu-local.sh first"
    exit 1
fi

# Check pod status
echo "📊 Checking pod status..."
kubectl get pods -n $NAMESPACE -l app=$APP_LABEL

# Check if pods are ready
READY_PODS=$(kubectl get pods -n $NAMESPACE -l app=$APP_LABEL --field-selector=status.phase=Running -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -o true | wc -l)
TOTAL_PODS=$(kubectl get pods -n $NAMESPACE -l app=$APP_LABEL -o jsonpath='{.items[*].metadata.name}' | wc -w)

echo "Ready pods: $READY_PODS/$TOTAL_PODS"

if [ "$READY_PODS" -eq 0 ]; then
    echo "❌ No pods are ready. Checking logs..."
    POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=$APP_LABEL -o jsonpath='{.items[0].metadata.name}')
    echo "Logs from $POD_NAME:"
    kubectl logs -n $NAMESPACE $POD_NAME --tail=50
    exit 1
fi

# Test health endpoint
echo "🏥 Testing health endpoint..."
kubectl port-forward -n $NAMESPACE svc/$SERVICE_NAME 8080:8000 &
PORT_FORWARD_PID=$!

# Wait for port forward to be ready
sleep 5

# Test health endpoint
if curl -s http://localhost:8080/health | jq . >/dev/null 2>&1; then
    echo "✅ Health endpoint working"
    HEALTH_RESPONSE=$(curl -s http://localhost:8080/health | jq .)
    echo "Health response: $HEALTH_RESPONSE"
else
    echo "❌ Health endpoint failed"
    kill $PORT_FORWARD_PID 2>/dev/null || true
    exit 1
fi

# Test SQL generation
echo "🔍 Testing SQL generation..."
SQL_REQUEST='{
    "prompt": "Show me customers from California with their total order amounts",
    "schema_context": "customers: customer_id|integer, name|varchar, state|varchar\norders: order_id|integer, customer_id|integer, amount|decimal",
    "max_tokens": 500,
    "temperature": 0.1
}'

echo "Sending request: $SQL_REQUEST"

if SQL_RESPONSE=$(curl -s -X POST http://localhost:8080/predict \
    -H "Content-Type: application/json" \
    -d "$SQL_REQUEST"); then
    
    echo "✅ SQL generation working"
    echo "SQL Response:"
    echo "$SQL_RESPONSE" | jq .
    
    # Check if response contains SQL
    if echo "$SQL_RESPONSE" | jq -r '.sql' | grep -q "SELECT\|select"; then
        echo "✅ Valid SQL generated"
    else
        echo "⚠️  Response doesn't contain valid SQL"
    fi
else
    echo "❌ SQL generation failed"
    kill $PORT_FORWARD_PID 2>/dev/null || true
    exit 1
fi

# Clean up port forward
kill $PORT_FORWARD_PID 2>/dev/null || true

echo ""
echo "🎉 All tests passed!"
echo ""
echo "📊 Resource usage:"
kubectl top pods -n $NAMESPACE -l app=$APP_LABEL 2>/dev/null || echo "Metrics server not available"

echo ""
echo "🔧 Useful commands:"
echo "- View logs: kubectl logs -n $NAMESPACE -l app=$APP_LABEL -f"
echo "- Port forward: kubectl port-forward -n $NAMESPACE svc/$SERVICE_NAME 8000:8000"
echo "- Scale up: kubectl scale deployment phi-sql-lora-cpu --replicas=2 -n $NAMESPACE"
echo "- Delete: kubectl delete -f phi-sql-lora-cpu-deployment.yaml"
