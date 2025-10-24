# Security Guidelines

## Configuration Security

### 🔒 Sensitive Information
- **Never commit passwords, API keys, or connection strings** to version control
- Use `values-dev.yaml.example` as a template and create your own `values-dev.yaml` with actual values
- Add `values-dev.yaml` to `.gitignore` if it contains sensitive information

### 🔑 Kubernetes Secrets (Recommended)
For production deployments, use Kubernetes secrets instead of plain text passwords:

```bash
# Create Trino credentials secret
kubectl create secret generic trino-credentials \
  --from-literal=username=your_trino_user \
  --from-literal=password=your_password \
  --namespace dashboard

# Create external LLM API key secret  
kubectl create secret generic external-llm-credentials \
  --from-literal=api-key=your_api_key \
  --namespace dashboard
```

### 🛡️ SSL/TLS Configuration
- Always use HTTPS for external Trino connections
- Configure SSL verification appropriately for your environment
- For self-signed certificates, use `SSLVerification=NONE` (development only)
- For production, use proper SSL certificates and enable verification

### 🔐 Environment Variables
Sensitive configuration can be injected via environment variables:

```yaml
# In deployment templates
env:
- name: TRINO_PASSWORD
  valueFrom:
    secretKeyRef:
      name: trino-credentials
      key: password
```

### 📋 Security Checklist
- [ ] Remove all hardcoded passwords from configuration files
- [ ] Use Kubernetes secrets for sensitive data
- [ ] Enable SSL/TLS for all external connections
- [ ] Regularly rotate credentials
- [ ] Monitor access logs for suspicious activity
- [ ] Use least-privilege access principles
- [ ] Keep dependencies updated

## Reporting Security Issues
If you discover a security vulnerability, please report it privately to the maintainers.
