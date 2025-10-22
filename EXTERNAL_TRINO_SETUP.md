# External Trino Configuration Guide

This guide explains how to configure the dashboard to use your own external Trino cluster instead of deploying a Trino pod.

## Overview

The dashboard supports two Trino deployment modes:

1. **Embedded Trino Pod** (default): Deploys a Trino pod with demo data
2. **External Trino Cluster**: Connects to your existing Trino infrastructure

## Configuration

### Option 1: Use External Trino

To use your own Trino cluster, update your `values.yaml`:

```yaml
services:
  trino:
    enabled: true        # Keep enabled for Trino functionality
    external: true       # Use external Trino instead of pod

# External Trino Configuration
externalTrino:
  host: "your-trino-cluster.example.com"
  port: 8080
  user: "your-trino-user"
  catalog: "your_catalog"     # Optional: default catalog
  schema: "your_schema"       # Optional: default schema
  
  # Authentication (if required)
  auth:
    enabled: true
    method: "basic"           # Options: basic, oauth2, kerberos
    username: "your-username"
    password: "your-password" # Use secret in production
  
  # SSL/TLS Configuration
  ssl:
    enabled: true
    trustStore: "/path/to/truststore.jks"
    keyStore: "/path/to/keystore.jks"
```

### Option 2: Use Embedded Trino Pod (Default)

```yaml
services:
  trino:
    enabled: true        # Deploy Trino pod
    external: false      # Use embedded Trino pod
```

## Deployment Examples

### Example 1: External Trino with Basic Auth

```yaml
services:
  trino:
    enabled: true
    external: true

externalTrino:
  host: "trino.mycompany.com"
  port: 8080
  user: "dashboard-user"
  catalog: "production"
  schema: "analytics"
  
  auth:
    enabled: true
    method: "basic"
    username: "dashboard-service"
    password: "secure-password"  # Use Kubernetes secret in production
```

### Example 2: External Trino with SSL

```yaml
services:
  trino:
    enabled: true
    external: true

externalTrino:
  host: "secure-trino.mycompany.com"
  port: 8443
  user: "dashboard-user"
  
  ssl:
    enabled: true
    trustStore: "/etc/ssl/certs/trino-truststore.jks"
```

### Example 3: Disable Trino Completely

```yaml
services:
  trino:
    enabled: false       # Disable all Trino functionality
```

## Helm Deployment Commands

### Deploy with External Trino

```bash
# Create custom values file
cat > my-external-trino-values.yaml << EOF
services:
  trino:
    enabled: true
    external: true

externalTrino:
  host: "your-trino-cluster.example.com"
  port: 8080
  user: "dashboard-user"
  catalog: "your_catalog"
EOF

# Deploy dashboard
helm install dashboard helm/dashboard \
  --values helm/dashboard/values-dev.yaml \
  --values my-external-trino-values.yaml \
  --namespace dashboard \
  --create-namespace
```

### Deploy with Embedded Trino (Default)

```bash
helm install dashboard helm/dashboard \
  --values helm/dashboard/values-dev.yaml \
  --namespace dashboard \
  --create-namespace
```

## What Gets Configured

When using external Trino, the following components are automatically configured:

### Backend Service
- JDBC URL: `jdbc:trino://your-host:port/catalog/schema`
- Authentication credentials
- SSL/TLS settings

### Schema Service (FAISS)
- Connects to external Trino for schema discovery
- Builds embeddings from your actual database schemas
- Refreshes schema cache every 3 hours

### What's NOT Deployed
- Trino pod and service
- Trino ConfigMap
- Demo databases (PostgreSQL/MySQL pods)

## Security Considerations

### Production Secrets

For production deployments, use Kubernetes secrets instead of plain text passwords:

```yaml
# Create secret
kubectl create secret generic trino-auth \
  --from-literal=username=dashboard-user \
  --from-literal=password=secure-password \
  --namespace dashboard

# Reference in values
externalTrino:
  auth:
    enabled: true
    method: "basic"
    username: "dashboard-user"
    passwordSecret:
      name: "trino-auth"
      key: "password"
```

### Network Security

- Ensure your Trino cluster is accessible from the Kubernetes cluster
- Configure appropriate firewall rules
- Use SSL/TLS for production deployments
- Consider using service mesh for additional security

## Troubleshooting

### Connection Issues

1. **Check connectivity**:
   ```bash
   kubectl exec -it deployment/dashboard-backend -n dashboard -- \
     curl -v http://your-trino-host:8080/v1/info
   ```

2. **Check schema service logs**:
   ```bash
   kubectl logs -n dashboard deployment/dashboard-schema-service
   ```

3. **Check backend logs**:
   ```bash
   kubectl logs -n dashboard deployment/dashboard-backend
   ```

### Common Issues

- **DNS Resolution**: Ensure the Trino host is resolvable from pods
- **Authentication**: Verify credentials and authentication method
- **SSL Certificates**: Check certificate validity and trust store configuration
- **Firewall**: Ensure ports are open between Kubernetes and Trino cluster

## Monitoring

Monitor the external Trino connection:

```bash
# Check schema service health
kubectl get pods -n dashboard -l app.kubernetes.io/component=schema-service

# Check backend health
curl http://localhost:8080/actuator/health

# Check Trino connectivity
kubectl logs -n dashboard deployment/dashboard-schema-service | grep "Connected to Trino"
```

## Migration from Embedded to External

1. **Deploy with external configuration**
2. **Verify connectivity**
3. **Test schema recommendations**
4. **Update DNS/networking as needed**
5. **Remove embedded Trino resources** (automatic when `external: true`)

The migration is seamless - the dashboard will automatically connect to your external Trino cluster and build fresh schema embeddings.
