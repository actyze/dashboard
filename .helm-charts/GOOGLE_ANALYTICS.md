# Google Analytics for Demo Site

## Overview

Google Analytics is **conditionally enabled via Helm values** at deployment time:
- ✅ **Demo site** (`.helm-charts/`): `googleAnalytics.enabled: true` → GA enabled
- ❌ **Customer deployments** (`helm-charts` repo): `googleAnalytics.enabled: false` → No GA

**Key benefit:** Same Docker image for both demo and customers, controlled at deployment time!

---

## How It Works

### Runtime Configuration (No Build Changes Needed!)

The `REACT_APP_GA_TRACKING_ID` environment variable is set at **runtime** via Kubernetes:

```yaml
# .helm-charts/dashboard/values.yaml (Demo site)
frontend:
  googleAnalytics:
    enabled: true
    trackingId: "G-7DR23KDBE8"
```

The Helm template injects this as an env var:
```yaml
# templates/frontend-deployment.yaml
env:
- name: REACT_APP_GA_TRACKING_ID
  value: "G-7DR23KDBE8"  # Only if enabled
```

React app checks for the env var:
```javascript
// GoogleAnalytics.js
const GA_TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;
if (!GA_TRACKING_ID) return; // No GA if not set
```

---

## Configuration

### Demo Site (Enable GA)

**File:** `.helm-charts/dashboard/values.yaml`

```yaml
frontend:
  image:
    repository: actyze/dashboard-frontend
    tag: latest  # Same image as customers!
  googleAnalytics:
    enabled: true  # ← Enable GA
    trackingId: "G-7DR23KDBE8"
```

### Customer Site (Disable GA)

**File:** `helm-charts/dashboard/values.yaml` (separate repo)

```yaml
frontend:
  image:
    repository: actyze/dashboard-frontend
    tag: latest  # Same image!
  googleAnalytics:
    enabled: false  # ← Disable GA (or omit entirely)
    trackingId: ""
```

---

## Deployment

### Demo Site
```bash
cd .helm-charts/dashboard
helm upgrade dashboard . \
  --install \
  --namespace dashboard \
  -f values.yaml \
  -f values-secrets.yaml
# GA automatically enabled via values.yaml
```

### Customer Site
```bash
cd helm-charts/dashboard
helm upgrade dashboard . \
  --install \
  --namespace customer \
  -f values.yaml
# GA disabled (not in customer values.yaml)
```

---

## Benefits

| Aspect | This Approach | Build-Time Approach |
|--------|---------------|---------------------|
| **Docker Image** | ✅ One image for all | ❌ Separate demo/customer images |
| **Build Process** | ✅ No changes needed | ❌ Different build args |
| **Maintenance** | ✅ Simple | ❌ Multiple image tags |
| **Flexibility** | ✅ Toggle at deploy time | ❌ Must rebuild to change |
| **CI/CD** | ✅ No workflow changes | ❌ Conditional builds |

---

## Testing

### Test with GA (Demo Mode)
```bash
# Set env var locally
export REACT_APP_GA_TRACKING_ID=G-7DR23KDBE8
npm start

# Check browser console
# "✅ Google Analytics loaded: G-7DR23KDBE8"
```

### Test without GA (Customer Mode)
```bash
# Don't set env var
unset REACT_APP_GA_TRACKING_ID
npm start

# GA not loaded - no tracking
```

---

## Verification

### Check if GA is enabled in deployment
```bash
kubectl get deployment dashboard-frontend -n dashboard -o yaml | grep REACT_APP_GA_TRACKING_ID
```

**Demo site output:**
```yaml
- name: REACT_APP_GA_TRACKING_ID
  value: G-7DR23KDBE8
```

**Customer site output:**
```
(no output - env var not set)
```

### Browser verification
```javascript
// Open browser console on the site
console.log(window.dataLayer);
// Demo: Array with GA events
// Customer: undefined
```

---

## Security & Privacy

### Customer Protection
- ✅ **No GA code runs** if env var not set
- ✅ **Same codebase** = no code divergence
- ✅ **Zero tracking** on customer sites
- ✅ **Deployment-time control** = easy to verify

### Demo Tracking
- ✅ Only tracks demo.actyze.ai
- ✅ Page views and navigation
- ✅ No PII collected
- ✅ Privacy compliant

---

## Troubleshooting

### GA not loading on demo site
```bash
# Check Helm values
helm get values dashboard -n dashboard | grep -A 3 googleAnalytics

# Check pod env vars
kubectl exec -it deployment/dashboard-frontend -n dashboard -- env | grep GA
```

### GA loading on customer site (should NOT happen)
```bash
# Verify customer values.yaml has GA disabled
cat values.yaml | grep -A 3 googleAnalytics
# Should be: enabled: false (or not present)
```

---

## Summary

**One Image, Two Configurations:**
```
┌─────────────────────────────────────┐
│  actyze/dashboard-frontend:latest   │
│  (Same image for demo & customers)  │
└─────────────────────────────────────┘
              │
              ├─────────────────┬─────────────────
              │                 │
         Demo Deploy       Customer Deploy
              │                 │
    GA enabled: true    GA enabled: false
    Tracking: Yes       Tracking: No
```

**Key Points:**
1. ✅ Same Docker image everywhere
2. ✅ Configuration via Helm values
3. ✅ No build-time complexity
4. ✅ Easy to toggle per deployment
5. ✅ Customer privacy guaranteed
