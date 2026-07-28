# Container Security Posture

This document is written for enterprise security reviewers evaluating Actyze
for deployment. It states what the images contain, how that is verified, and
what is knowingly outstanding.

Actyze is AGPL-3.0-only. All components are open source; there is no licensed,
paywalled, or telemetry-gated functionality.

---

## 1. Images

| Image | Base | Runs as | Build toolchain in runtime |
|---|---|---|---|
| `actyze/dashboard-nexus` | `python:3.13-slim` | uid 10001 | no |
| `actyze/dashboard-schema-service` | `python:3.13-slim` | uid 10001 | no |
| `actyze/dashboard-frontend` | `nginxinc/nginx-unprivileged:stable-alpine` | uid 101 | no |
| `actyze/prediction-worker-xgboost` | `python:3.13-slim` | uid 10001 | no |
| `actyze/prediction-worker-lightgbm` | `python:3.13-slim` | uid 10001 | no |
| `actyze/prediction-worker-autogluon` | `python:3.13-slim` | uid 10001 | no |
| `actyze/dashboard-trino` | `trinodb/trino:477` | uid 1000 | no |

Every Python image is a two-stage build. Compilers (`gcc`, `g++`,
`build-essential`) and build-time packages exist only in the builder stage; the
runtime stage receives a virtualenv and nothing else, and `pip`, `setuptools`
and `wheel` are removed after install.

The frontend listens on **8080**, not 80, because it runs unprivileged and
cannot bind a port below 1024. Kubernetes Services target the named port, so
Service and Ingress definitions are unaffected. The Compose mapping is
`3000:8080`.

## 2. What changed, and why the earlier scans looked the way they did

An enterprise scan in July 2026 reported CRITICAL/HIGH findings against five of
six images. Every root cause was in how the images were assembled, not in
application code:

| Cause | Effect |
|---|---|
| `python:3.11-slim` base | 8 fixable HIGH in every Python image |
| Build toolchain left in the runtime layer | `wheel`, `jaraco-context` — 2 more HIGH each |
| `COPY <dir> . .` (three arguments) | entire build context, including `.git`, baked into 4 images |
| No `.dockerignore` | nothing prevented the above |
| `curl` installed only to run a HEALTHCHECK | an extra CVE surface, and the sole HIGH source in the frontend |
| Outdated pinned libraries | the CRITICALs: `litellm`, `python-jose`, `torch`, `ray` |

Results after remediation, measured with `grype`, counting **fixable**
CRITICAL/HIGH — the same basis the enterprise scanner used:

| Image | Before | After |
|---|---|---|
| nexus | 3 CRITICAL / 24 HIGH | **0 / 1** |
| schema-service | 0 / 10 | **0 / 1** (expected) |
| frontend | 0 / 4 | **0 / 0** |
| prediction-worker-xgboost | 0 / 13 | **0 / 1** |
| prediction-worker-lightgbm | 0 / 14 | **0 / 1** |
| prediction-worker-autogluon | 2 / 21 | **0 / 4** |

The residual findings are upstream-capped, not deferred work. See
`vulnerability-allowlist.txt` for each one with its reason and review date.

### Verification status

**CI is the authoritative check, not local builds.** The
`SBOM and Vulnerability Scan` workflow builds all six images from the committed
Dockerfiles on amd64 runners and runs the CVE and licence gates against them.

Local rebuilds during this work were done on arm64 and proved to be
**unrepresentative**: `nvidia-nccl-cu12`, pulled in unconditionally by
`xgboost` on Linux, is published for x86_64 only, so it was absent from every
local scan and present in the images that would actually ship. CI caught it;
the local scans reported clean. Treat any architecture-specific claim about
these images as valid only when made against an amd64 build.

Two images were additionally never built locally at all — `schema-service` and
`prediction-worker-autogluon` — because this workstation's network intercepts
TLS to `download.pytorch.org`, which the CPU-only `torch` install requires. For
those, only dependency resolution was verified locally.

## 3. Supply chain

`.dockerignore` excludes `.git`, `.env*`, keys, and agent/editor state from
every build context. Prior to this, four published images contained the full
git history.

A scan of that history with `gitleaks` returns 16 hits, all of which are
placeholder `Authorization:` headers in documentation and credentials in
license-service code that has since been removed from the product. No live
credential was found. The exposure path is closed regardless, since `.git` no
longer enters any image.

Secret scanning runs at three points: `gitleaks` via pre-commit, `gitleaks` in
CI on every PR and push to main, and GitHub Push Protection at the receive step.

## 4. SBOM

A CycloneDX SBOM is generated for every image on every push, pull request, and
weekly, and retained for 90 days as a workflow artifact
(`.github/workflows/sbom-and-scan.yml`). To produce one locally:

```bash
syft actyze/dashboard-nexus:<tag> -o cyclonedx-json=nexus.cdx.json
```

## 5. CI gating

`.github/workflows/sbom-and-scan.yml` builds each image without registry
credentials, then:

- fails on **fixable** CRITICAL/HIGH findings. A fixable finding means an
  upgrade exists upstream and has not been taken. Findings with no available
  fix cannot be actioned, so they are waived explicitly in
  `vulnerability-allowlist.txt` with a reason and a review date, rather than
  being suppressed by a blanket severity threshold.
- fails on any package whose licence is denied by `license-policy.yml`.
- uploads complete results, unfixable findings included, to the GitHub Security
  tab.

The pre-existing `security-scan` job in `build-and-push-images.yml` remains, but
it is `continue-on-error` and scans only already-pushed tags. It reports; this
workflow gates.

## 6. Kubernetes

All seven deployments in `.helm-charts/dashboard` set:

```yaml
runAsNonRoot: true
runAsUser: <10001 | 101 | 1000>
seccompProfile: { type: RuntimeDefault }
allowPrivilegeEscalation: false
privileged: false
capabilities: { drop: [ALL] }
```

This satisfies the Kubernetes **restricted** Pod Security Standard, apart from
`readOnlyRootFilesystem`.

`readOnlyRootFilesystem` is wired as a per-service toggle and currently defaults
to `false`. Several services write scratch data at runtime (the schema service's
model cache, matplotlib and litellm caches) and would crashloop without an
`emptyDir` mounted over those paths. Enabling it per service:

```yaml
# in the deployment template
{{- include "dashboard.containerSecurityContext" (dict "readOnlyRootFilesystem" true) | nindent 10 }}
```

and mount an `emptyDir` at `/tmp` plus any service-specific cache directory.

## 7. Reporting

Security contact and disclosure process: see `SECURITY.md` in the repository
root.
