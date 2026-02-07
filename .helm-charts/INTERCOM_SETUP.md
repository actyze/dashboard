# Intercom Setup for Demo Site

## Overview

Intercom is **disabled by default** and controlled via Helm values. This ensures customer deployments are **never affected** unless explicitly enabled.

## How It Works

1. **Helm values** control whether Intercom is enabled
2. **Environment variables** are injected into the frontend container at deployment
3. **Dynamic import** loads Intercom component ONLY if env var is set
4. **Zero customer impact** - Intercom code is NOT bundled for customers
5. **No code changes needed** per deployment - all controlled via Helm

### Bundle Optimization

✅ **Customers**: Intercom.js code is **completely excluded** from their bundle (code-splitting)  
✅ **Demo site**: Intercom.js is **lazy-loaded** only after app starts  
✅ **React Router**: Uses dynamic `import()` for conditional loading

## Configuration

### For Demo Site (demo.actyze.ai)

Enable Intercom in your values-secrets.yaml or directly in values.yaml:

```yaml
frontend:
  intercom:
    enabled: true           # Enable Intercom
    appId: "e4rc082n"      # Your Intercom App ID
```

### For Customer Deployments (DEFAULT)

Keep Intercom disabled (default configuration):

```yaml
frontend:
  intercom:
    enabled: false         # Intercom will NOT load
    appId: ""              # Not needed when disabled
```

## Deployment Methods

### Method 1: Via GitHub Actions (Recommended for Demo)

Update `.github/workflows/deploy-to-digitalocean.yml` to include Intercom config:

```yaml
- name: Create values-secrets.yaml from GitHub Secrets
  run: |
    cat <<EOF > .helm-charts/dashboard/values-secrets.yaml
    # ... other secrets ...
    
    # Intercom configuration (demo site only)
    frontend:
      intercom:
        enabled: true
        appId: "${{ secrets.INTERCOM_APP_ID }}"
    EOF
```

Then add GitHub Secret:
- Name: `INTERCOM_APP_ID`
- Value: `e4rc082n` (or your App ID)

### Method 2: Via values-secrets.yaml

For local deployments, add to `.helm-charts/dashboard/values-secrets.yaml`:

```yaml
frontend:
  intercom:
    enabled: true
    appId: "e4rc082n"
```

## Verification

After deployment, check if Intercom is loaded:

1. **View Pod Logs**:
   ```bash
   kubectl logs -n dashboard deployment/dashboard-frontend
   ```

2. **Check Environment Variables**:
   ```bash
   kubectl exec -n dashboard deployment/dashboard-frontend -- env | grep INTERCOM
   ```
   
   Expected output (if enabled):
   ```
   REACT_APP_ENABLE_INTERCOM=true
   REACT_APP_INTERCOM_APP_ID=e4rc082n
   ```

3. **Browser Console**:
   - Open demo.actyze.ai
   - Open DevTools Console
   - Look for: `[Intercom] Initializing with App ID: e4rc082n`
   - Intercom widget should appear in bottom-right corner

## Security & Best Practices

✅ **Safe by default**: Disabled unless explicitly enabled  
✅ **Customer protection**: Customers never see Intercom unless you enable it  
✅ **No code changes**: All configuration via Helm values  
✅ **Env var driven**: React app reads config at runtime  
✅ **Audit trail**: GitHub Actions logs show what's deployed  

## Troubleshooting

### Intercom Not Loading

1. **Check Helm values**: Is `frontend.intercom.enabled` set to `true`?
2. **Check env vars**: Run `kubectl exec` command above
3. **Check browser console**: Look for `[Intercom] Disabled` message
4. **Verify App ID**: Make sure it matches your Intercom workspace

### Intercom Loading on Customer Site (PROBLEM!)

This should NEVER happen if you follow the guidelines:

1. **Check values.yaml**: Ensure default is `enabled: false`
2. **Check customer deployment**: They shouldn't have Intercom config
3. **Review CI/CD**: Make sure Intercom is only enabled for demo pipeline

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Helm Values (values.yaml)                 │
│  frontend.intercom.enabled: false (default)                 │
│  frontend.intercom.appId: ""                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Helm Template
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Deployment (K8s Pod)                  │
│  env:                                                       │
│    - REACT_APP_ENABLE_INTERCOM=true  ◄─ Injected by Helm   │
│    - REACT_APP_INTERCOM_APP_ID=...   ◄─ Injected by Helm   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Container reads env vars at build
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            React App (App.js - IntercomLoader)              │
│  useEffect(() => {                                          │
│    if (REACT_APP_ENABLE_INTERCOM === 'true') {              │
│      import('./components/Common/Intercom')  ◄─ Dynamic!    │
│        .then(module => setIntercomComponent(module.default))│
│    }                                                        │
│  })                                                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Lazy load only if enabled
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          Intercom.js (Separate bundle chunk)                │
│  - Only downloaded when REACT_APP_ENABLE_INTERCOM=true      │
│  - NOT included in main.js bundle                           │
│  - Loads Intercom widget script from widget.intercom.io     │
└─────────────────────────────────────────────────────────────┘

Customer Bundle:   main.js (NO Intercom code)
Demo Bundle:       main.js + Intercom.chunk.js (lazy-loaded)
```

## Related Files

- **Helm Values**: `.helm-charts/dashboard/values.yaml` (line 168-170)
- **Helm Template**: `.helm-charts/dashboard/templates/frontend-deployment.yaml`
- **React Component**: `frontend/src/components/Common/Intercom.js`
- **App Integration**: `frontend/src/App.js`
