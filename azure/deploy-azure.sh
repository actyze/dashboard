#!/bin/bash
# Azure AKS Deployment Script for Dashboard

set -e

# Configuration
RESOURCE_GROUP="dashboard-rg"
CLUSTER_NAME="dashboard-aks"
LOCATION="eastus"
ACR_NAME="dashboardacr$(date +%s)"

echo "🚀 Deploying Dashboard to Azure AKS..."

# Login to Azure (if not already logged in)
echo "🔐 Checking Azure login..."
az account show > /dev/null 2>&1 || az login

# Create resource group
echo "🏗️ Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
echo "📦 Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "loginServer" --output tsv)

# Build and push Docker images
echo "🔨 Building and pushing Docker images..."
az acr build --registry $ACR_NAME --image dashboard-backend:latest --file docker/Dockerfile.backend .
az acr build --registry $ACR_NAME --image dashboard-fastapi:dual-model --file docker/Dockerfile.fastapi .
az acr build --registry $ACR_NAME --image dashboard-frontend:latest --file docker/Dockerfile.frontend .

# Create AKS cluster
echo "☸️ Creating AKS cluster..."
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --kubernetes-version 1.28 \
  --tier Standard \
  --node-count 1 \
  --node-vm-size Standard_D2s_v3 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 3 \
  --attach-acr $ACR_NAME \
  --enable-addons monitoring \
  --generate-ssh-keys

# Add ML node pool
echo "🤖 Adding ML node pool..."
az aks nodepool add \
  --resource-group $RESOURCE_GROUP \
  --cluster-name $CLUSTER_NAME \
  --name ml \
  --node-count 2 \
  --node-vm-size Standard_D2s_v3 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 5 \
  --node-taints ml-workload=true:NoSchedule \
  --labels workload=ml-inference

# Add application node pool
echo "📱 Adding application node pool..."
az aks nodepool add \
  --resource-group $RESOURCE_GROUP \
  --cluster-name $CLUSTER_NAME \
  --name apps \
  --node-count 2 \
  --node-vm-size Standard_D2s_v3 \
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 10

# Get AKS credentials
echo "🔑 Getting AKS credentials..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing

# Update Kubernetes manifests with ACR images
echo "📝 Updating Kubernetes manifests..."
sed -i.bak "s|dashboard-backend:latest|${ACR_LOGIN_SERVER}/dashboard-backend:latest|g" k8s/backend-deployment.yaml
sed -i.bak "s|dashboard-fastapi:dual-model|${ACR_LOGIN_SERVER}/dashboard-fastapi:dual-model|g" k8s/fastapi-deployment.yaml
sed -i.bak "s|dashboard-frontend:latest|${ACR_LOGIN_SERVER}/dashboard-frontend:latest|g" k8s/frontend-deployment.yaml

# Deploy to AKS
echo "🚀 Deploying applications to AKS..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/model-storage-pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/fastapi-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Install NGINX Ingress Controller
echo "🌐 Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller
echo "⏳ Waiting for ingress controller..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Apply ingress
kubectl apply -f k8s/ingress.yaml

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-backend -n dashboard
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-fastapi -n dashboard
kubectl wait --for=condition=available --timeout=300s deployment/dashboard-frontend -n dashboard

# Get external IP
echo "🌍 Getting external IP..."
EXTERNAL_IP=""
while [ -z $EXTERNAL_IP ]; do
  echo "Waiting for external IP..."
  EXTERNAL_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
  [ -z "$EXTERNAL_IP" ] && sleep 10
done

echo "✅ Dashboard deployed successfully!"
echo "🌍 Access your dashboard at: http://$EXTERNAL_IP"
echo "📊 Backend API: http://$EXTERNAL_IP/api"
echo "🤖 ML API: http://$EXTERNAL_IP/ml"
echo ""
echo "📋 Resource Summary:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  AKS Cluster: $CLUSTER_NAME"
echo "  Container Registry: $ACR_NAME"
echo "  External IP: $EXTERNAL_IP"

# Show cluster status
kubectl get nodes
kubectl get pods -n dashboard
kubectl get services -n dashboard
