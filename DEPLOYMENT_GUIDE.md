# Dashboard Deployment Guide

## 🚀 Quick Start

### **Development Deployment**

1. **Create your secrets file:**
   ```bash
   cp helm/dashboard/values-dev-secrets.yaml.template helm/dashboard/values-dev-secrets.yaml
   # Edit values-dev-secrets.yaml with your actual:
   # - External LLM API key
   # - Trino credentials (username/password)
   # - Trino connection details (host/catalog/schema)
   # - Demo database passwords (optional)
   ```

2. **Deploy with Helm:**
   ```bash
   helm upgrade --install dashboard ./helm/dashboard \
     --namespace dashboard \
     --create-namespace \
     -f helm/dashboard/values-dev.yaml \
     -f helm/dashboard/values-dev-secrets.yaml \
     --wait
   ```

3. **Access the application:**
   ```bash
   kubectl port-forward -n dashboard svc/dashboard-frontend 3000:3000
   kubectl port-forward -n dashboard svc/dashboard-backend 8080:8080
   ```

### **Production Deployment**

1. **Create your production secrets file:**
   ```bash
   cp helm/dashboard/values-dev-secrets.yaml.template helm/dashboard/values-production-secrets.yaml
   # Edit values-production-secrets.yaml with your production credentials
   ```

2. **Deploy with production values:**
   ```bash
   helm upgrade --install dashboard ./helm/dashboard \
     --namespace dashboard \
     --create-namespace \
     -f helm/dashboard/values-production.yaml \
     -f helm/dashboard/values-production-secrets.yaml \
     --wait
   ```

## 📋 File Structure

```
helm/dashboard/
├── values-dev.yaml                    # ✅ Safe to commit - no secrets
├── values-production.yaml             # ✅ Safe to commit - no secrets  
├── values-dev-secrets.yaml            # ❌ NOT in Git - your actual secrets
├── values-dev-secrets.yaml.template   # ✅ Template for other developers
└── templates/secrets.yaml             # ✅ Helm template for Kubernetes secrets
```

## 🔐 Secret Management

### **Values-Based Approach (All Environments)**
- Secrets stored in `values-*-secrets.yaml` files (not committed to Git)
- Helm creates Kubernetes secrets from values
- Consistent approach for development and production
- Simple and secure

## 🛠️ Useful Commands

```bash
# Check deployment status
kubectl get pods -n dashboard

# View logs
kubectl logs -n dashboard -l app.kubernetes.io/name=dashboard

# Update secrets and restart
# Edit values-dev-secrets.yaml, then:
helm upgrade dashboard ./helm/dashboard \
  -f helm/dashboard/values-dev.yaml \
  -f helm/dashboard/values-dev-secrets.yaml

# Uninstall
helm uninstall dashboard -n dashboard
```

## ⚠️ Security Notes

- ✅ **values-dev.yaml** and **values-production.yaml** are safe to commit
- ❌ **values-dev-secrets.yaml** is in .gitignore - never commit this file
- 🔒 All secrets are stored as Kubernetes secrets, not in plain text
- 🔄 Use the template file to help other developers set up their secrets
