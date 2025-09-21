# Dashboard Helm Chart

A comprehensive Helm chart for deploying the Dashboard application with dual-model ML backend to Kubernetes clusters.

## Architecture

The chart deploys three main services:
- **Backend**: Spring Boot application with Spring Integration orchestration
- **FastAPI**: ML service with CodeT5+ and chart recommendation models
- **Frontend**: React application with Material-UI

## Quick Start

### Local Deployment (Kind)

```bash
# Deploy to local Kind cluster
./deploy.sh local install

# Access the dashboard
echo "127.0.0.1 dashboard.local" | sudo tee -a /etc/hosts
open http://dashboard.local
```

### Production Deployment (Azure AKS)

```bash
# Deploy to production
./deploy.sh production install

# Check status
./deploy.sh production status
```

## Chart Structure

```
helm/dashboard/
├── Chart.yaml                 # Chart metadata
├── values.yaml                # Default values
├── values-local.yaml          # Local environment overrides
├── values-production.yaml     # Production environment overrides
└── templates/
    ├── _helpers.tpl           # Template helpers
    ├── namespace.yaml         # Namespace creation
    ├── pvc.yaml              # Persistent Volume Claims
    ├── backend-deployment.yaml
    ├── fastapi-deployment.yaml
    ├── frontend-deployment.yaml
    ├── services.yaml          # All services
    ├── ingress.yaml          # Ingress configuration
    ├── hpa.yaml              # Horizontal Pod Autoscaler
    └── pdb.yaml              # Pod Disruption Budgets
```

## Configuration

### Environment-Specific Values

| File | Purpose | Use Case |
|------|---------|----------|
| `values.yaml` | Default configuration | Base template |
| `values-local.yaml` | Local development | Kind cluster |
| `values-production.yaml` | Production settings | Azure AKS |

### Key Configuration Options

#### Global Settings
```yaml
global:
  namespace: dashboard
  imagePullPolicy: Never  # Never for local, Always for production
```

#### Backend Service
```yaml
backend:
  enabled: true
  replicaCount: 2
  image:
    repository: dashboard-backend
    tag: latest
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
```

#### FastAPI ML Service
```yaml
fastapi:
  enabled: true
  replicaCount: 1
  image:
    repository: dashboard-fastapi
    tag: dual-model
  storage:
    enabled: true
    size: 10Gi
    storageClass: "standard"  # "managed-csi" for Azure
```

#### Frontend Service
```yaml
frontend:
  enabled: true
  replicaCount: 2
  image:
    repository: dashboard-frontend
    tag: latest
```

#### Ingress Configuration
```yaml
ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: dashboard.local
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
```

## Deployment Commands

### Using the Deploy Script

```bash
# Install on local Kind cluster
./deploy.sh local install

# Upgrade existing deployment
./deploy.sh local upgrade

# Check deployment status
./deploy.sh local status

# Uninstall
./deploy.sh local uninstall
```

### Using Helm Directly

```bash
# Install with custom values
helm install dashboard helm/dashboard \
  --namespace dashboard \
  --create-namespace \
  --values helm/dashboard/values-local.yaml

# Upgrade deployment
helm upgrade dashboard helm/dashboard \
  --namespace dashboard \
  --values helm/dashboard/values-local.yaml

# Uninstall
helm uninstall dashboard --namespace dashboard
```

## Prerequisites

### Local Development (Kind)
- Docker Desktop
- Kind cluster
- Helm 3.x
- kubectl

```bash
# Create Kind cluster
kind create cluster --name dashboard

# Load Docker images into Kind
kind load docker-image dashboard-backend:latest --name dashboard
kind load docker-image dashboard-fastapi:dual-model --name dashboard
kind load docker-image dashboard-frontend:latest --name dashboard
```

### Production (Azure AKS)
- Azure CLI
- AKS cluster
- Helm 3.x
- kubectl configured for AKS

```bash
# Connect to AKS cluster
az aks get-credentials --resource-group myResourceGroup --name myAKSCluster
```

## Monitoring and Scaling

### Horizontal Pod Autoscaling
The chart includes HPA configurations for automatic scaling based on CPU utilization:

```yaml
autoscaling:
  backend:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
```

### Pod Disruption Budgets
Ensures high availability during cluster maintenance:

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

## Storage

### Model Storage
FastAPI service uses persistent storage for ML models:

```yaml
fastapi:
  storage:
    enabled: true
    size: 10Gi
    storageClass: "standard"  # Local
    # storageClass: "managed-csi"  # Azure AKS
```

## Networking

### Service Mesh Ready
The chart is compatible with service mesh solutions like Istio:

```yaml
# Add to values file for Istio
podAnnotations:
  sidecar.istio.io/inject: "true"
```

### Network Policies
Enable network policies for enhanced security:

```yaml
networkPolicy:
  enabled: true
```

## Troubleshooting

### Common Issues

1. **Images not found in Kind**
   ```bash
   # Load images into Kind cluster
   kind load docker-image dashboard-backend:latest --name dashboard
   ```

2. **Persistent Volume issues**
   ```bash
   # Check PVC status
   kubectl get pvc -n dashboard
   
   # Check storage class
   kubectl get storageclass
   ```

3. **Ingress not working**
   ```bash
   # Install nginx ingress controller
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
   ```

### Debugging Commands

```bash
# Check pod logs
kubectl logs -n dashboard deployment/dashboard-backend
kubectl logs -n dashboard deployment/dashboard-fastapi
kubectl logs -n dashboard deployment/dashboard-frontend

# Check pod status
kubectl get pods -n dashboard -o wide

# Describe problematic pods
kubectl describe pod -n dashboard <pod-name>

# Check services
kubectl get svc -n dashboard

# Check ingress
kubectl get ingress -n dashboard
```

## Security

### Production Security Checklist
- [ ] Enable TLS/SSL certificates
- [ ] Configure network policies
- [ ] Set resource limits and requests
- [ ] Enable pod security policies
- [ ] Configure RBAC
- [ ] Use secrets for sensitive data
- [ ] Enable audit logging

### Example TLS Configuration
```yaml
ingress:
  tls:
    - secretName: dashboard-tls
      hosts:
        - dashboard.yourdomain.com
```

## Customization

### Adding Custom Resources
Create additional templates in `helm/dashboard/templates/`:

```yaml
# custom-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "dashboard.fullname" . }}-config
  namespace: {{ .Values.global.namespace }}
data:
  custom.conf: |
    # Your custom configuration
```

### Environment Variables
Add environment variables to deployments:

```yaml
# In values.yaml
backend:
  env:
    CUSTOM_VAR: "value"
    
# In deployment template
env:
- name: CUSTOM_VAR
  value: {{ .Values.backend.env.CUSTOM_VAR }}
```

## Contributing

1. Make changes to templates or values
2. Test with `helm template` command
3. Validate with `helm lint`
4. Test deployment on Kind cluster
5. Update documentation

```bash
# Validate chart
helm lint helm/dashboard

# Generate templates for review
helm template dashboard helm/dashboard --values helm/dashboard/values-local.yaml
```
