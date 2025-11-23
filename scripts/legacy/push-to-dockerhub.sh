#!/bin/bash
# Script to build and push latest images to Docker Hub

set -e

# Check if DOCKERHUB_USERNAME is set
if [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "❌ Error: DOCKERHUB_USERNAME environment variable is not set"
    echo ""
    echo "Usage:"
    echo "  export DOCKERHUB_USERNAME=your-username"
    echo "  ./scripts/push-to-dockerhub.sh"
    echo ""
    exit 1
fi

echo "🐳 Building and pushing images to Docker Hub as ${DOCKERHUB_USERNAME}..."
echo ""

# Login to Docker Hub
echo "🔐 Logging into Docker Hub..."
docker login

# Function to build and push
build_and_push() {
    local service=$1
    local dockerfile=$2
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Building ${service}..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    docker build -f ${dockerfile} -t ${DOCKERHUB_USERNAME}/dashboard-${service}:latest .
    
    echo ""
    echo "⬆️  Pushing ${service} to Docker Hub..."
    docker push ${DOCKERHUB_USERNAME}/dashboard-${service}:latest
    
    echo "✅ ${service} pushed successfully!"
}

# Change to repo root directory
cd "$(dirname "$0")/.."

# Build and push all services
build_and_push "backend" "docker/Dockerfile.backend"
build_and_push "frontend" "docker/Dockerfile.frontend"
build_and_push "schema-service" "docker/Dockerfile.schema-service"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All images pushed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Images available at:"
echo "  🔒 docker.io/${DOCKERHUB_USERNAME}/dashboard-backend:latest"
echo "  🔒 docker.io/${DOCKERHUB_USERNAME}/dashboard-frontend:latest"
echo "  🔒 docker.io/${DOCKERHUB_USERNAME}/dashboard-schema-service:latest"
echo ""
echo "Next steps:"
echo "  1. Create Kubernetes secret (if not already done):"
echo "     kubectl create secret docker-registry dockerhub-secret \\"
echo "       --docker-server=docker.io \\"
echo "       --docker-username=${DOCKERHUB_USERNAME} \\"
echo "       --docker-password=YOUR_PASSWORD \\"
echo "       --docker-email=YOUR_EMAIL \\"
echo "       -n dashboard"
echo ""
echo "  2. Deploy/update with Helm:"
echo "     helm upgrade --install dashboard ./helm/dashboard \\"
echo "       -n dashboard --create-namespace \\"
echo "       --values helm/dashboard/values-dev.yaml"
echo ""
echo "  3. Restart deployments to pull new images:"
echo "     kubectl rollout restart deployment dashboard-backend -n dashboard"
echo "     kubectl rollout restart deployment dashboard-frontend -n dashboard"
echo "     kubectl rollout restart deployment dashboard-schema-service -n dashboard"
echo ""
