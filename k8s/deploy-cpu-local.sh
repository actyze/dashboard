#!/bin/bash

# Deploy Phi SQL LoRA CPU to local kind cluster
set -e

echo "🚀 Deploying Phi SQL LoRA CPU to local kind cluster..."

# Check if kind cluster is running
if ! kind get clusters | grep -q "kind"; then
    echo "❌ Kind cluster not found. Please create a kind cluster first:"
    echo "   kind create cluster --config=kind-config.yaml"
    exit 1
fi

# Load Docker image into kind cluster
echo "📦 Loading Docker image into kind cluster..."
kind load docker-image phi-sql-lora-clean:k8s

# Create namespace if it doesn't exist
echo "🏗️  Creating namespace..."
kubectl create namespace dashboard --dry-run=client -o yaml | kubectl apply -f -

# Apply PVC first (if not exists)
echo "💾 Creating persistent volume claims..."
kubectl apply -f model-storage-pvc.yaml

# Deploy the CPU application
echo "🚀 Deploying Phi SQL LoRA CPU..."
kubectl apply -f phi-sql-lora-cpu-deployment.yaml

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=600s deployment/phi-sql-lora-cpu -n dashboard

# Get pod status
echo "📊 Pod status:"
kubectl get pods -n dashboard -l app=phi-sql-lora-cpu

# Get service info
echo "🌐 Service info:"
kubectl get svc -n dashboard phi-sql-lora-cpu-service

# Port forward for testing
echo "🔗 Setting up port forwarding..."
echo "Run the following command to access the service:"
echo "kubectl port-forward -n dashboard svc/phi-sql-lora-cpu-service 8000:8000"

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the deployment:"
echo "1. Run: kubectl port-forward -n dashboard svc/phi-sql-lora-cpu-service 8000:8000"
echo "2. Test: curl http://localhost:8000/health"
echo "3. Generate SQL: curl -X POST http://localhost:8000/predict -H 'Content-Type: application/json' -d '{\"prompt\": \"Show me all customers\", \"max_tokens\": 500}'"
