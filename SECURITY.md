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
- [ ] Keep dependencies updated (Dependabot is enabled; see
      [security/DEPENDABOT_TRIAGE.md](security/DEPENDABOT_TRIAGE.md))
- [ ] Run containers as non-root — the images and chart already do this
- [ ] Review the SBOM for your deployed version before an enterprise rollout

## Container & Supply Chain Security

Configuration guidance above covers how *you* deploy Actyze. This section covers
what *we* ship.

Full detail lives in two documents, both regenerated from real scan data rather
than written by hand:

- **[security/CONTAINER_SECURITY.md](security/CONTAINER_SECURITY.md)** — base
  images, runtime users, per-image CVE counts before and after, supply-chain
  controls, and the Kubernetes security context posture.
- **[security/LICENSE_REPORT.md](security/LICENSE_REPORT.md)** — the
  "is this genuinely open source" answer, from SBOM data.

### Summary

- Every image runs as a **non-root user** and satisfies the Kubernetes
  **restricted** Pod Security Standard, apart from `readOnlyRootFilesystem`.
- Images are multi-stage; no compilers or build tooling in the runtime layer.
- A **CycloneDX SBOM** is generated for every image on every build and retained
  90 days as a workflow artifact.
- CI **fails the build** on a fixable CRITICAL/HIGH finding or a denied licence
  (`.github/workflows/sbom-and-scan.yml`).
- Secret scanning runs at three points: `gitleaks` in pre-commit, `gitleaks` in
  CI on every PR and push, and GitHub Push Protection at the receive step.

### On "zero CVE" claims

We do not make one. Findings with **no upstream fix available** remain in the
images — largely `perl-base` and `libc6` from the Debian base. Actyze's own
layers add roughly one finding beyond the official `python:3.13-slim` base
image.

What we do commit to: **zero fixable CRITICAL findings**, and every fixable
HIGH either taken or waived in the open. At 0.1.1 the waived set is three
CPython advisories (CVE-2026-11940, CVE-2026-11972, CVE-2026-15308) whose only
fix is an unreleased CPython 3.15 — two of them only in a beta. Shipping a
pre-release interpreter is not an acceptable trade for these.

Every waiver lives in `security/vulnerability-allowlist.txt` with a reason and a
review date. Nothing is suppressed by a blanket severity threshold, so the list
is short and auditable by design.

Scanning covers `linux/amd64`. Images also publish `linux/arm64`, which the gate
does not currently build — tracked in
[#250](https://github.com/actyze/dashboard/issues/250).

### Verifying for yourself

```bash
# SBOM for any published image
syft actyze/dashboard-nexus:0.1.1 -o cyclonedx-json

# Fixable CRITICAL/HIGH only. Expect exit 2 and the three waived CPython
# advisories above — CI applies the allowlist, this raw command does not.
# Anything beyond those three is a regression; please report it.
grype actyze/dashboard-nexus:0.1.1 --only-fixed --fail-on high
```

## Reporting Security Issues

**Please do not open a public issue for a security vulnerability.**

Report it through
[GitHub Security Advisories](https://github.com/actyze/dashboard/security/advisories/new),
which keeps the report private until a fix is available.

What to expect:

- Acknowledgement within **3 working days**
- An initial assessment, and a severity, within **10 working days**
- Credit in the release notes when a fix ships, unless you would rather not be
  named

Actyze is pre-1.0 and maintained by a small team. Only the latest release
receives security fixes; there is no backport branch.

### In scope

The Actyze services and images in this repository, the Helm chart, and the
published Docker images.

### Out of scope

Vulnerabilities in third-party services you connect Actyze to (your Trino, your
database, your LLM provider), and findings in upstream base images that have no
fix available — those are tracked in `security/vulnerability-allowlist.txt`
rather than handled as reports.
