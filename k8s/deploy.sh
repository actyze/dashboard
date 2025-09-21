#!/bin/bash
# Kubernetes Deployment Script for Dashboard

set -e

echo "🚀 Deploying Dashboard to Kubernetes..."

# Build Docker images
echo "📦 Building Docker images..."
docker build -f docker/Dockerfile.backend -t dashboard-backend:latest .
docker build -f docker/Dockerfile.fastapi -t dashboard-fastapi:dual-model .
docker build -f docker/Dockerfile.frontend -t dashboard-frontend:latest .

# Create namespace
echo "🏗️ Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Deploy storage for ML model
echo "💾 Setting up model storage..."
kubectl apply -f k8s/model-storage-pvc.yaml

# Deploy services
echo "🔧 Deploying backend services..."
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/fastapi-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Setup ingress
echo "🌐 Setting up ingress..."
kubectl apply -f k8s/ingress.yaml

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-backend -n dashboard
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-fastapi -n dashboard
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-frontend -n dashboard

echo "✅ Dashboard deployed successfully!"
echo "🌍 Access your dashboard at: http://dashboard.local"
echo "📊 Backend API: http://dashboard.local/api"
echo "🤖 ML API: http://dashboard.local/ml"

# Show status
kubectl get pods -n dashboard
kubectl get services -n dashboard
