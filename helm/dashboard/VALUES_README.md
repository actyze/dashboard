# Dashboard Helm Values Configuration

## Configuration Files

We now have **TWO** clean configuration files:

1. **`values-dev.yaml`** - Development environment (local Kind cluster)
2. **`values-production.yaml`** - Production environment (Azure AKS)

## Docker Hub Setup (Private Registry)

**All images are configured to always pull `latest` from your private Docker Hub repository.**

### Quick Setup

**1. Replace Docker Hub username in both values files:**
```bash
# Replace "yourusername" with your actual Docker Hub username
sed -i '' 's/yourusername/YOUR_DOCKERHUB_USERNAME/g' helm/dashboard/values-dev.yaml
sed -i '' 's/yourusername/YOUR_DOCKERHUB_USERNAME/g' helm/dashboard/values-production.yaml
```

**2. Create private repositories on Docker Hub:**
- Go to https://hub.docker.com/repositories
- Create 3 private repositories:
  - `dashboard-backend`
  - `dashboard-frontend`
  - `dashboard-schema-service`

**3. Build and push images:**
```bash
# Set your Docker Hub username
export DOCKERHUB_USERNAME="your-username"

# Login to Docker Hub
docker login

# Build and push backend
docker build -f docker/Dockerfile.backend -t ${DOCKERHUB_USERNAME}/dashboard-backend:latest .
docker push ${DOCKERHUB_USERNAME}/dashboard-backend:latest

# Build and push frontend
docker build -f docker/Dockerfile.frontend -t ${DOCKERHUB_USERNAME}/dashboard-frontend:latest .
docker push ${DOCKERHUB_USERNAME}/dashboard-frontend:latest

# Build and push schema service
docker build -f docker/Dockerfile.schema-service -t ${DOCKERHUB_USERNAME}/dashboard-schema-service:latest .
docker push ${DOCKERHUB_USERNAME}/dashboard-schema-service:latest
```

**4. Create Kubernetes secret for Docker Hub authentication:**
```bash
# For development (Kind cluster)
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_PASSWORD \
  --docker-email=YOUR_EMAIL \
  -n dashboard

# For production (Azure AKS)
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_PASSWORD \
  --docker-email=YOUR_EMAIL \
  -n dashboard \
  --context=your-production-cluster
```

**5. Deploy with Helm:**
```bash
# Now Helm will always pull the latest images from your private Docker Hub
helm upgrade --install dashboard ./helm/dashboard \
  --namespace dashboard \
  --create-namespace \
  --values helm/dashboard/values-dev.yaml
```

### Updating Images (No Helm Changes Needed!)

**Every time you build a new image, just push it:**
```bash
# Build new version
docker build -f docker/Dockerfile.backend -t ${DOCKERHUB_USERNAME}/dashboard-backend:latest .

# Push to Docker Hub (overwrites latest tag)
docker push ${DOCKERHUB_USERNAME}/dashboard-backend:latest

# Restart pods to pull new image
kubectl rollout restart deployment dashboard-backend -n dashboard
```

**Helm values never need updating!** The `latest` tag and `pullPolicy: Always` ensure fresh images every time.

## Model Strategy - Choose ONE

Both files have a `modelStrategy` section where you choose your SQL generation approach:

### Option 1: External LLM APIs (Current Default)
```yaml
modelStrategy:
  externalLLM:
    enabled: true           # ← Set to true to use external APIs
    provider: "perplexity"  # openai, perplexity, anthropic, groq, together
    model: "sonar-reasoning-pro"
    apiKey: "your-api-key"  # Should be from Kubernetes secret in production
```

**Benefits:**
- ✅ No local GPU/CPU required
- ✅ Latest models (GPT-4, Claude, Perplexity)
- ✅ Pay-per-use pricing
- ✅ Instant updates to newer models

### Option 2: Local Phi-4 LoRA Model
```yaml
modelStrategy:
  phiSqlLora:
    enabled: true           # ← Set to true to use self-hosted model
    replicas: 1
    resources:
      memory: "8Gi"
      cpu: "2000m"
```

**Benefits:**
- ✅ No API costs
- ✅ Complete data privacy
- ✅ No external dependencies
- ❌ Requires 8Gi+ RAM per replica

## Optional Services

All services can be toggled in the `services` section:

```yaml
services:
  backend:
    enabled: true        # REQUIRED - core orchestration
  frontend:
    enabled: true        # Optional - can disable for API-only
  schemaService:
    enabled: true        # Recommended - improves SQL quality
  trino:
    enabled: true        # Required - for query execution
  demo:
    enabled: true        # Dev only - sample databases
```

## Deployment Commands

### Development (local Kind cluster)
```bash
helm install dashboard ./helm/dashboard \
  --namespace dashboard \
  --create-namespace \
  --values helm/dashboard/values-dev.yaml
```

### Production (Azure AKS)
```bash
helm install dashboard ./helm/dashboard \
  --namespace dashboard \
  --create-namespace \
  --values helm/dashboard/values-production.yaml \
  --set modelStrategy.externalLLM.apiKey=${EXTERNAL_LLM_API_KEY}
```

## Upgrading Configuration

```bash
# Development
helm upgrade dashboard ./helm/dashboard \
  --namespace dashboard \
  --values helm/dashboard/values-dev.yaml

# Production
helm upgrade dashboard ./helm/dashboard \
  --namespace dashboard \
  --values helm/dashboard/values-production.yaml
```

## Switching Between External LLM and Local Model

### To use External LLM:
```yaml
modelStrategy:
  externalLLM:
    enabled: true      # ← Enable external LLM
  phiSqlLora:
    enabled: false     # ← Disable local model
```

### To use Local Phi-4 LoRA:
```yaml
modelStrategy:
  externalLLM:
    enabled: false     # ← Disable external LLM
  phiSqlLora:
    enabled: true      # ← Enable local model
```

**Note:** Only ONE should be enabled at a time.

## Environment Differences

| Feature | Development | Production |
|---------|-------------|------------|
| **External LLM** | ✅ Enabled (default) | ✅ Enabled (default) |
| **Replicas** | 1 (single instance) | 3-10 (HA + autoscaling) |
| **Demo Data** | ✅ Enabled | ❌ Disabled |
| **Autoscaling** | ❌ Disabled | ✅ Enabled |
| **TLS/HTTPS** | ❌ Optional | ✅ Required |
| **Resource Limits** | Low (dev cluster) | High (production) |

## Migration from Old Configuration

**Old structure (removed):**
- ~~`values.yaml`~~ → Renamed to `values-dev.yaml`
- ~~`values-local.yaml`~~ → Deleted (merged into `values-dev.yaml`)
- `values-production.yaml` → Completely rewritten

All working configuration from the old `values.yaml` has been preserved in `values-dev.yaml`.

## Security Notes

⚠️ **Production Security Checklist:**

1. **Never commit API keys** to version control
2. **Use Kubernetes secrets** for sensitive data:
   ```bash
   kubectl create secret generic external-llm-secret \
     --from-literal=apiKey=your-actual-api-key \
     -n dashboard
   ```
3. **Enable TLS/HTTPS** in production ingress
4. **Use Azure Managed Identity** for cloud resources
5. **Enable network policies** to restrict pod communication

## Troubleshooting

### Backend can't reach external LLM
Check that `modelStrategy.externalLLM.enabled` is `true` and API key is correctly set.

### Phi-4 LoRA pod crashing (OOMKilled)
Increase memory limits in `modelStrategy.phiSqlLora.resources`.

### Schema service not improving results
Ensure `services.schemaService.enabled` is `true`.

## Support

For issues, check:
1. Pod logs: `kubectl logs -n dashboard <pod-name>`
2. Events: `kubectl get events -n dashboard`
3. Configuration: `helm get values dashboard -n dashboard`
