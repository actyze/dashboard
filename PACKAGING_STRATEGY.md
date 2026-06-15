# Observability Packaging & Shipping Strategy

## Current State

**Monorepo Structure:**
```
dashboard/
├── shared/observability/          ← Shared library (Python + JS)
│   ├── python/                   ← Python modules
│   ├── javascript/               ← TypeScript modules
│   └── docs/                     ← Guides
├── nexus/                        ← Service 1 (root level)
├── schema-service/               ← Service 2 (root level)
├── frontend/                     ← Service 3 (root level)
└── docker/
    ├── prediction-worker-xgboost/    ← Service 4 (subdirectory)
    ├── prediction-worker-lightgbm/   ← Service 5 (subdirectory)
    └── prediction-worker-autogluon/  ← Service 6 (subdirectory)
```

---

## Problem: Build Context Isolation

### Root-Level Services (Nexus, Schema, Frontend)
✅ **Working** — Dockerfiles use relative imports correctly

```dockerfile
# nexus/Dockerfile
COPY . .                          # Copies nexus/ AND parent shared/
# Then in app: from ../../shared/observability/python import ...
```

Docker build context is the service directory, but `COPY . .` copies the entire repo:
```bash
cd nexus
docker build .                    # context = . (nexus/)
```

### Subdirectory Services (Prediction Workers)
❌ **Problem** — Can't access parent directory

```dockerfile
# docker/prediction-worker-xgboost/Dockerfile
COPY . .                          # Only copies docker/prediction-worker-xgboost/
# Then in app: from ../../../shared/observability/python import ...  ← FAILS
```

Docker build context is locked to service directory:
```bash
cd docker/prediction-worker-xgboost
docker build .                    # context = . (only this dir)
```

---

## Solution: Update Docker Build Context

### Option A: Build from Project Root (RECOMMENDED)

**Update docker-compose.yml:**
```yaml
prediction-worker-xgboost:
  build:
    context: .                           # Build from project root
    dockerfile: docker/prediction-worker-xgboost/Dockerfile
    
prediction-worker-lightgbm:
  build:
    context: .
    dockerfile: docker/prediction-worker-lightgbm/Dockerfile
    
prediction-worker-autogluon:
  build:
    context: .
    dockerfile: docker/prediction-worker-autogluon/Dockerfile
```

**Update Dockerfiles:**
```dockerfile
# docker/prediction-worker-xgboost/Dockerfile
FROM python:3.11-slim
WORKDIR /app

COPY shared/observability/python ./shared_obs
COPY docker/prediction-worker-xgboost/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY docker/prediction-worker-xgboost . .

# Add shared library to Python path
ENV PYTHONPATH=/app:/app/shared_obs:$PYTHONPATH

EXPOSE 8400
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8400"]
```

**Update observability_init.py:**
```python
# Instead of: from ../../../shared/observability/...
# Use: from shared_obs.logging import ...
import sys
sys.path.insert(0, '/app/shared_obs')
from logging import configure_logging, get_logger
```

**Advantages:**
- ✅ All services built consistently from root
- ✅ Works for nested directory structures
- ✅ No symlinks or complex file management
- ✅ Git repository structure is source of truth

---

## Kubernetes Deployment

### Strategy: ConfigMap + Volume Mount

**For Python services:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: observability-python
data:
  __init__.py: |
    # (contents of shared/observability/python/__init__.py)
  logging.py: |
    # (contents of shared/observability/python/logging.py)
  metrics.py: |
    # (contents of shared/observability/python/metrics.py)
  health.py: |
    # (contents of shared/observability/python/health.py)
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexus
spec:
  template:
    spec:
      containers:
      - name: nexus
        image: actyze/nexus:latest
        volumeMounts:
        - name: obs-py
          mountPath: /opt/observability/python
        env:
        - name: PYTHONPATH
          value: /opt/observability/python:/app
      volumes:
      - name: obs-py
        configMap:
          name: observability-python
```

**Alternative: Use Init Container**
```yaml
spec:
  initContainers:
  - name: copy-observability
    image: alpine:latest
    command: ['cp', '-r', '/obs/shared/observability/python', '/mnt/obs/']
    volumeMounts:
    - name: obs-vol
      mountPath: /mnt/obs
  containers:
  - name: nexus
    image: actyze/nexus:latest
    volumeMounts:
    - name: obs-vol
      mountPath: /opt/observability
```

### For JavaScript Services:

```yaml
kind: ConfigMap
metadata:
  name: observability-js
data:
  observability.ts: |
    # (contents from shared/observability/javascript/observability.ts)
  metrics.ts: |
    # (contents from shared/observability/javascript/metrics.ts)
  index.ts: |
    # (contents from shared/observability/javascript/index.ts)
---
containers:
- name: frontend
  image: actyze/frontend:latest
  volumeMounts:
  - name: obs-js
    mountPath: /app/src/utils/observability
volumes:
- name: obs-js
  configMap:
    name: observability-js
```

---

## Production Shipping: Multi-Stage Approach

### Phase 1: Docker (Current - Immediate)

**Option 1: Update Build Context** (5 min fix)
```bash
# Update docker-compose.yml
# Change each prediction-worker build context to: .
# Update Dockerfiles to copy from docker/prediction-worker-*/

# Test
docker-compose -f docker/docker-compose.yml build prediction-worker-xgboost
docker-compose up
```

**Verification:**
```bash
docker logs prediction-worker-xgboost | grep "observability"
# Should show successful import
```

### Phase 2: Kubernetes (Helm)

**Option 1: Embed in Image**
```dockerfile
# Production image includes shared library
FROM python:3.11-slim
COPY shared/observability/python /opt/obs/python
COPY docker/prediction-worker-xgboost /app
ENV PYTHONPATH=/opt/obs/python:/app
```

**Option 2: ConfigMap Injection** (already shown above)
```yaml
# Helm chart mounts observability library as ConfigMap
# Allows hot-updates without rebuilding images
```

### Phase 3: Package Management (Optional - Future)

**Create pip package:**
```bash
# shared/observability/python/setup.py
from setuptools import setup

setup(
    name='actyze-observability',
    version='1.0.0',
    packages=['observability'],
    install_requires=[
        'structlog==24.4.0',
        'prometheus-client==0.24.1',
        'pydantic>=2.0.0'
    ]
)

# Then: pip install actyze-observability
# Usage: from observability.logging import configure_logging
```

**Create npm package:**
```json
{
  "name": "@actyze/observability",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}

// npm install @actyze/observability
// import { initObservability } from '@actyze/observability'
```

---

## Recommended Immediate Action

### Step 1: Update docker-compose.yml

```yaml
prediction-worker-xgboost:
  build:
    context: .                    # ← CHANGE
    dockerfile: docker/prediction-worker-xgboost/Dockerfile
    args:
      WORKER_TYPE: xgboost

prediction-worker-lightgbm:
  build:
    context: .                    # ← CHANGE
    dockerfile: docker/prediction-worker-lightgbm/Dockerfile
    args:
      WORKER_TYPE: lightgbm

prediction-worker-autogluon:
  build:
    context: .                    # ← CHANGE
    dockerfile: docker/prediction-worker-autogluon/Dockerfile
    args:
      WORKER_TYPE: autogluon
```

### Step 2: Update Prediction Worker Dockerfiles

```dockerfile
# docker/prediction-worker-xgboost/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy shared observability library
COPY shared/observability/python ./shared_obs

# Copy worker-specific files
COPY docker/prediction-worker-xgboost/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker application
COPY docker/prediction-worker-xgboost/main.py .
COPY docker/prediction-worker-xgboost/config.py .
COPY docker/prediction-worker-xgboost/models ./models
COPY docker/prediction-worker-xgboost/observability_init.py .

# Add shared library to Python path
ENV PYTHONPATH=/app:/app/shared_obs:$PYTHONPATH

EXPOSE 8400

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8400"]
```

### Step 3: Update observability_init.py

```python
# docker/prediction-worker-xgboost/observability_init.py
import sys
import os

# Add shared_obs to path (injected by Docker PYTHONPATH)
# This allows: from logging import configure_logging
# Instead of: from ../../shared/observability/python.logging import ...

from logging import configure_logging, get_logger
from metrics import configure_metrics, metrics_registry
from health import HealthChecker, HealthStatus

__all__ = [
    'configure_logging',
    'get_logger',
    'configure_metrics',
    'metrics_registry',
    'HealthChecker',
    'HealthStatus'
]
```

### Step 4: Test

```bash
# Build locally
cd dashboard
docker-compose -f docker/docker-compose.yml build prediction-worker-xgboost

# Run and verify
docker-compose up prediction-worker-xgboost
docker logs prediction-worker-xgboost | head -20
# Should show: "INFO: Uvicorn running on http://0.0.0.0:8400"

# Check observability
curl http://localhost:8400/metrics | head -20
curl http://localhost:8400/readyz | jq .
```

---

## Final Shipping Checklist

### Docker (Local Development)
- [ ] Update `docker/docker-compose.yml` build contexts
- [ ] Update all prediction-worker Dockerfiles
- [ ] Update observability imports in worker code
- [ ] Test: `docker-compose up`
- [ ] Verify logs and metrics work

### Kubernetes (Production)
- [ ] Option A: Embed observability in image (recommended for Helm)
- [ ] Option B: Use ConfigMap injection for dynamic updates
- [ ] Create Helm values for ConfigMap observability library
- [ ] Test: `helm install actyze ./helm-charts/dashboard`
- [ ] Verify: `kubectl logs -f deployment/nexus | jq '.'`

### Git & CI/CD
- [ ] Create GitHub Action to build all images
- [ ] Tag images: `actyze/nexus:v1.0.0-obs`, etc.
- [ ] Push to registry (Docker Hub, ECR, GCR)
- [ ] Update helm values with new image tags

---

## Summary

| Component | Current | Issue | Fix | Timeline |
|-----------|---------|-------|-----|----------|
| Nexus | ✅ Working | None | None | — |
| Schema | ✅ Working | None | None | — |
| Frontend | ✅ Working | None | None | — |
| Workers | ❌ Broken | Build context | Update docker-compose.yml + Dockerfile | **Immediate** |
| Kubernetes | 📦 Ready | None | Choose ConfigMap or embed | **Before deploy** |
| Package registry | 🔄 Optional | None | Create pip/npm packages | **Later** |

---

**Next step:** Apply the Docker fix and test worker observability locally.
