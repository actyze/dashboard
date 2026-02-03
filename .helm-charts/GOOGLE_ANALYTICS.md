# Google Analytics for Demo Site

## Overview

Google Analytics is **conditionally enabled via Helm values** at deployment time using **HTML tag injection**:
- ✅ **Demo site** (`.helm-charts/`): GA scripts injected into HTML at container startup
- ❌ **Customer deployments**: No GA scripts, clean HTML served

**Key benefit:** Same Docker image for both demo and customers, controlled purely at deployment time!

---

## How It Works (HTML Injection Approach)

### Step 1: Frontend has placeholder in HTML

```html
<!-- frontend/public/index.html -->
<head>
  <title>Dashboard</title>
  <!-- GA_TRACKING_PLACEHOLDER - Replaced at container startup by deployment scripts -->
</head>
```

### Step 2: Helm values configure GA (demo only)

```yaml
# .helm-charts/dashboard/values.yaml (Demo site)
frontend:
  googleAnalytics:
    enabled: true
    trackingId: "G-7DR23KDBE8"
```

### Step 3: Helm creates ConfigMap with entrypoint script

```yaml
# .helm-charts/dashboard/templates/frontend-configmap.yaml
# Contains shell script that uses sed to inject GA tags
```

### Step 4: Deployment mounts script and sets env var

```yaml
# .helm-charts/dashboard/templates/frontend-deployment.yaml
env:
- name: REACT_APP_GA_TRACKING_ID
  value: "G-7DR23KDBE8"  # Only if enabled
command: ["/scripts/docker-entrypoint.sh"]
volumeMounts:
- name: entrypoint-script
  mountPath: /scripts
```

### Step 5: Container starts and injects GA

```bash
# At container startup, docker-entrypoint.sh runs:
if [ -n "$REACT_APP_GA_TRACKING_ID" ]; then
  # Replace placeholder with actual <script> tags
  sed -i "s|<!-- GA_TRACKING_PLACEHOLDER -->|<script>...GA code...</script>|g" index.html
fi
```

### Result:

**Demo site HTML:**
```html
<head>
  <title>Dashboard</title>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7DR23KDBE8"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-7DR23KDBE8');</script>
</head>
```

**Customer site HTML:**
```html
<head>
  <title>Dashboard</title>
  
</head>
```

---

## File Structure

```
dashboard/
├── frontend/
│   ├── public/index.html              ← Placeholder comment added
│   └── src/App.js                     ← No GoogleAnalytics component needed!
│
└── .helm-charts/dashboard/
    ├── docker/
    │   └── frontend-entrypoint.sh     ← Injection script (source)
    ├── templates/
    │   ├── frontend-configmap.yaml    ← Creates ConfigMap from script
    │   └── frontend-deployment.yaml   ← Mounts and uses script
    └── values.yaml                    ← Configures GA tracking ID
```

**Key point:** All deployment logic lives in `.helm-charts/`, frontend code is clean!

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

## Benefits of HTML Injection Approach

| Aspect | This Approach | window._env_ Approach | Build-Time Approach |
|--------|---------------|----------------------|---------------------|
| **Frontend Code** | ✅ Minimal (1 line placeholder) | ⚠️  env-config.js needed | ❌ Separate builds |
| **React Component** | ✅ Not needed! | ⚠️  GoogleAnalytics.js needed | ⚠️  Component needed |
| **GA Loading** | ✅ Immediate (in HTML) | ⚠️  Dynamic (React useEffect) | ✅ Immediate |
| **Deployment Logic** | ✅ All in .helm-charts/ | ✅ All in .helm-charts/ | ❌ In CI/CD |
| **Simplicity** | ✅✅ Simplest | ✅ Simple | ❌ Complex |
| **Docker Image** | ✅ One image | ✅ One image | ❌ Multiple images |

---

## Deployment

### Demo Site (with GA)
```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard
helm upgrade dashboard .helm-charts/dashboard/ \
  --install \
  --namespace dashboard \
  -f .helm-charts/dashboard/values.yaml \
  -f .helm-charts/dashboard/values-secrets.yaml
# GA automatically injected via values.yaml
```

### Customer Site (no GA)
```bash
cd /path/to/helm-charts
helm upgrade dashboard ./dashboard \
  --install \
  --namespace customer \
  -f values.yaml
# GA disabled (not in customer values.yaml)
```

---

## Verification

### Check if GA is enabled in deployment
```bash
# Check if env var is set
kubectl get deployment dashboard-frontend -n dashboard -o yaml | grep REACT_APP_GA_TRACKING_ID

# Check pod logs for injection confirmation
kubectl logs -n dashboard -l app.kubernetes.io/component=frontend | grep "Google Analytics"
```

**Demo site output:**
```
✅ Google Analytics enabled - Tracking ID: G-7DR23KDBE8
✅ Google Analytics tracking code injected into index.html
```

**Customer site output:**
```
ℹ️  Google Analytics disabled (no tracking ID provided)
ℹ️  This is expected for customer deployments
```

### Browser verification
```javascript
// Open browser console on demo.actyze.ai
console.log(window.dataLayer);
// Should show: Array with GA events

// On customer sites
console.log(window.dataLayer);
// Should show: undefined (no GA loaded)
```

### View HTML source
```bash
# Demo site
curl https://demo.actyze.ai | grep gtag
# Should show: <script async src="https://www.googletagmanager.com/gtag/js...

# Customer site
curl https://customer-site.com | grep gtag
# Should show: (no results)
```

---

## Troubleshooting

### GA not loading on demo site

**Check Helm values:**
```bash
helm get values dashboard -n dashboard | grep -A 3 googleAnalytics
```

**Check pod logs:**
```bash
kubectl logs -n dashboard deployment/dashboard-frontend --tail=50
# Look for "Google Analytics enabled" message
```

**Check HTML source:**
```bash
kubectl exec -n dashboard deployment/dashboard-frontend -- cat /usr/share/nginx/html/index.html | grep gtag
# Should show GA script tags if enabled
```

### GA loading on customer site (should NOT happen)

**Verify customer values.yaml:**
```yaml
# Should NOT have googleAnalytics.enabled: true
frontend:
  googleAnalytics:
    enabled: false  # or omit entirely
```

**Check pod doesn't have env var:**
```bash
kubectl exec -n customer deployment/dashboard-frontend -- env | grep GA
# Should return nothing
```

---

## Security & Privacy

### Customer Protection
- ✅ **No GA code in HTML** if env var not set
- ✅ **Same Docker image** = no code divergence
- ✅ **Zero tracking** on customer sites
- ✅ **HTML inspection-friendly** - customers can verify no GA

### Demo Tracking
- ✅ Only tracks demo.actyze.ai
- ✅ Page views and navigation
- ✅ No PII collected
- ✅ Privacy compliant

---

## Summary

**One Image, Pure Runtime Configuration:**
```
┌─────────────────────────────────────┐
│  actyze/dashboard-frontend:latest   │
│  (Same image for demo & customers)  │
│  - Contains placeholder in HTML     │
│  - No GA code baked in              │
└─────────────────────────────────────┘
              │
              ├─────────────────┬─────────────────
              │                 │
         Demo Deploy       Customer Deploy
              │                 │
    values.yaml: GA=true   values.yaml: GA=false
              │                 │
    Entrypoint injects GA   Entrypoint removes placeholder
              │                 │
    HTML: <script>GA</script>   HTML: (clean, no GA)
```

**Key Points:**
1. ✅ Same Docker image everywhere
2. ✅ Minimal frontend code changes (1 line)
3. ✅ All deployment logic in .helm-charts/
4. ✅ GA injected at container startup (runtime)
5. ✅ Customer privacy guaranteed
6. ✅ Simplest possible implementation
