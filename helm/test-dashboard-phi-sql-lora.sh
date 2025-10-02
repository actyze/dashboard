#!/bin/bash

# Test Dashboard Helm Chart with Phi SQL LoRA
set -e

NAMESPACE="dashboard"
RELEASE_NAME="dashboard"
CHART_PATH="./dashboard"

echo "🚀 Testing Dashboard Helm Chart with Phi SQL LoRA..."

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm not found. Please install Helm first:"
    echo "   brew install helm"
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first"
    exit 1
fi

# Note: Namespace will be created by Helm with --create-namespace flag

# Validate the Helm chart
echo "🔍 Validating Helm chart..."
helm lint $CHART_PATH

# Dry run to check template rendering
echo "🧪 Testing template rendering..."
helm template $RELEASE_NAME $CHART_PATH \
    --namespace $NAMESPACE \
    --set components.phiSqlLora=true \
    --set components.backend=false \
    --set components.frontend=false \
    --set components.schemaService=false \
    --set components.trino=false \
    --debug

# Load Docker image into kind cluster (if using kind)
if kubectl config current-context | grep -q "kind"; then
    echo "📦 Loading Docker image into kind cluster..."
    CLUSTER_NAME=$(kubectl config current-context | sed 's/kind-//')
    kind load docker-image phi-sql-lora-clean:k8s --name=$CLUSTER_NAME
fi

# Install the Helm chart with only phi-sql-lora enabled
echo "🚀 Installing Helm chart with Phi SQL LoRA only..."
helm upgrade --install $RELEASE_NAME $CHART_PATH \
    --namespace $NAMESPACE \
    --set components.phiSqlLora=true \
    --set components.backend=false \
    --set components.frontend=false \
    --set components.schemaService=false \
    --set components.trino=false \
    --set components.mcpTrino=false \
    --set components.mcpChart=false \
    --set components.demo.enabled=false \
    --wait \
    --timeout 10m \
    --create-namespace

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=600s deployment/$RELEASE_NAME-phi-sql-lora -n $NAMESPACE

# Check pod status
echo "📊 Checking pod status..."
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=phi-sql-lora

# Check service status
echo "🌐 Checking service status..."
kubectl get svc -n $NAMESPACE -l app.kubernetes.io/component=phi-sql-lora

# Test the service
echo "🧪 Testing the service..."
kubectl port-forward -n $NAMESPACE svc/$RELEASE_NAME-phi-sql-lora 9000:8000 &
PORT_FORWARD_PID=$!

# Wait for port forward to be ready
sleep 5

# Test health endpoint
if curl -s http://localhost:9000/health | jq . >/dev/null 2>&1; then
    echo "✅ Health endpoint working"
    HEALTH_RESPONSE=$(curl -s http://localhost:9000/health | jq .)
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

if SQL_RESPONSE=$(curl -s -X POST http://localhost:9000/predict \
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
echo "🎉 Dashboard Helm chart with Phi SQL LoRA test completed successfully!"
echo ""
echo "📊 Helm release status:"
helm status $RELEASE_NAME -n $NAMESPACE

echo ""
echo "🔧 Useful commands:"
echo "- View logs: kubectl logs -n $NAMESPACE -l app.kubernetes.io/component=phi-sql-lora -f"
echo "- Port forward: kubectl port-forward -n $NAMESPACE svc/$RELEASE_NAME-phi-sql-lora 8000:8000"
echo "- Uninstall: helm uninstall $RELEASE_NAME -n $NAMESPACE"
echo "- Enable other components: helm upgrade $RELEASE_NAME $CHART_PATH -n $NAMESPACE --set components.backend=true"
