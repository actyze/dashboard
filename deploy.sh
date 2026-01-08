#!/bin/bash

# Dashboard Deployment Script
# Usage: ./deploy.sh [local|production] [install|upgrade|uninstall]

set -e

ENVIRONMENT=${1:-local}
ACTION=${2:-install}
RELEASE_NAME="dashboard"
NAMESPACE="dashboard"

echo "🚀 Dashboard Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo "Release: $RELEASE_NAME"
echo "Namespace: $NAMESPACE"

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed. Please install Helm first."
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Function to install/upgrade the chart
deploy_chart() {
    local values_file="helm/dashboard/values-${ENVIRONMENT}.yaml"
    
    if [ ! -f "$values_file" ]; then
        echo "❌ Values file not found: $values_file"
        exit 1
    fi
    
    echo "📦 Using values file: $values_file"
    
    if [ "$ACTION" = "install" ]; then
        echo "🔧 Installing Dashboard..."
        helm install $RELEASE_NAME helm/dashboard \
            --namespace $NAMESPACE \
            --create-namespace \
            --values $values_file \
            --wait \
            --timeout 10m
    elif [ "$ACTION" = "upgrade" ]; then
        echo "🔄 Upgrading Dashboard..."
        helm upgrade $RELEASE_NAME helm/dashboard \
            --namespace $NAMESPACE \
            --values $values_file \
            --wait \
            --timeout 10m
    fi
}

# Function to uninstall the chart
uninstall_chart() {
    echo "🗑️  Uninstalling Dashboard..."
    helm uninstall $RELEASE_NAME --namespace $NAMESPACE
    
    # Optionally delete the namespace
    read -p "Do you want to delete the namespace '$NAMESPACE'? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        echo "✅ Namespace '$NAMESPACE' deleted"
    fi
}

# Function to check deployment status
check_status() {
    echo "📊 Checking deployment status..."
    kubectl get pods -n $NAMESPACE
    echo ""
    kubectl get services -n $NAMESPACE
    echo ""
    kubectl get ingress -n $NAMESPACE
}

# Main execution
case $ACTION in
    install|upgrade)
        # Pre-deployment checks for local environment
        if [ "$ENVIRONMENT" = "local" ]; then
            echo "🔍 Checking local Kind cluster..."
            if ! kubectl cluster-info | grep -q "kind"; then
                echo "⚠️  Warning: Not connected to a Kind cluster"
                read -p "Continue anyway? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
            
            # Check if images exist locally
            echo "🔍 Checking Docker images..."
            docker images | grep -E "(dashboard-nexus|dashboard-frontend|dashboard-schema-service)" || {
                echo "⚠️  Warning: Some Docker images may not be available locally"
                echo "Make sure to build images first using docker compose:"
                echo "  cd docker && docker compose build"
            }
        fi
        
        deploy_chart
        echo "✅ Deployment completed successfully!"
        
        # Show status
        sleep 5
        check_status
        
        # Show access instructions
        if [ "$ENVIRONMENT" = "local" ]; then
            echo ""
            echo "🌐 Access your dashboard:"
            echo "  Add to /etc/hosts: 127.0.0.1 dashboard.local"
            echo "  Then visit: http://dashboard.local"
            echo ""
            echo "Or use port-forward:"
            echo "  kubectl port-forward -n $NAMESPACE svc/dashboard-frontend 3000:80"
            echo "  kubectl port-forward -n $NAMESPACE svc/dashboard-nexus 8000:8000"
        else
            echo ""
            echo "🌐 Dashboard will be available at the configured ingress host"
        fi
        ;;
    uninstall)
        uninstall_chart
        echo "✅ Uninstallation completed!"
        ;;
    status)
        check_status
        ;;
    *)
        echo "❌ Invalid action: $ACTION"
        echo "Usage: $0 [local|production] [install|upgrade|uninstall|status]"
        exit 1
        ;;
esac

echo "🎉 Done!"
