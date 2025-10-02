#!/bin/bash

# Complete setup for Phi SQL LoRA CPU on local kind cluster
set -e

CLUSTER_NAME="dev-cluster"
DOCKER_IMAGE="phi-sql-lora-clean:k8s"

echo "🚀 Setting up Phi SQL LoRA CPU on local kind cluster..."

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v kind &> /dev/null; then
    echo "❌ kind not found. Please install kind first:"
    echo "   brew install kind"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first:"
    echo "   brew install kubectl"
    exit 1
fi

if ! docker image inspect $DOCKER_IMAGE >/dev/null 2>&1; then
    echo "❌ Docker image $DOCKER_IMAGE not found. Please build it first:"
    echo "   cd ../models/phi-sql-lora && docker build -t $DOCKER_IMAGE ."
    exit 1
fi

# Use existing kind cluster
if kind get clusters | grep -q "$CLUSTER_NAME"; then
    echo "✅ Using existing kind cluster '$CLUSTER_NAME'"
else
    echo "❌ Kind cluster '$CLUSTER_NAME' not found. Available clusters:"
    kind get clusters
    exit 1
fi

# Set kubectl context
kubectl config use-context kind-$CLUSTER_NAME

# Load Docker image
echo "📦 Loading Docker image into kind cluster..."
kind load docker-image $DOCKER_IMAGE --name=$CLUSTER_NAME

# Create namespace
echo "🏗️  Creating namespace..."
kubectl create namespace dashboard --dry-run=client -o yaml | kubectl apply -f -

# Apply PVC
echo "💾 Creating persistent volume claims..."
if [ -f "model-storage-pvc.yaml" ]; then
    kubectl apply -f model-storage-pvc.yaml
else
    echo "⚠️  model-storage-pvc.yaml not found, creating basic PVC..."
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: model-storage-pvc
  namespace: dashboard
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard
EOF
fi

# Deploy the application
echo "🚀 Deploying Phi SQL LoRA CPU..."
kubectl apply -f phi-sql-lora-cpu-deployment.yaml

# Wait for deployment
echo "⏳ Waiting for deployment to be ready (this may take 5-10 minutes for model loading)..."
kubectl wait --for=condition=available --timeout=600s deployment/phi-sql-lora-cpu -n dashboard || {
    echo "❌ Deployment failed to become ready. Checking logs..."
    kubectl logs -n dashboard -l app=phi-sql-lora-cpu --tail=50
    exit 1
}

echo "✅ Deployment successful!"

# Show status
echo ""
echo "📊 Cluster status:"
kubectl get nodes
echo ""
echo "📊 Pod status:"
kubectl get pods -n dashboard -l app=phi-sql-lora-cpu
echo ""
echo "🌐 Service status:"
kubectl get svc -n dashboard phi-sql-lora-cpu-service

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🧪 Next steps:"
echo "1. Test the deployment: ./test-cpu-deployment.sh"
echo "2. Access the service: kubectl port-forward -n dashboard svc/phi-sql-lora-cpu-service 8000:8000"
echo "3. View logs: kubectl logs -n dashboard -l app=phi-sql-lora-cpu -f"
echo ""
echo "🗑️  To cleanup:"
echo "   kind delete cluster --name=$CLUSTER_NAME"
