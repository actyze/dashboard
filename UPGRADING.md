# Upgrading Actyze

Breaking changes and required actions, newest first. Versions follow the SemVer
and lockstep policy in [VERSIONING.md](VERSIONING.md): every Actyze image shares
one version, which is also the Helm chart's `appVersion`.

---

## 0.1.0 → 0.1.1

A security and reliability release. Most of it is transparent, but there are
**three changes an operator must act on**.

### Upgrade strongly recommended

The `0.1.0` prediction worker images do not start. All three
(`prediction-worker-xgboost`, `-lightgbm`, `-autogluon`) fail on import:

```
ImportError: cannot import name 'configure_logging' from 'observability_init'
```

If you deployed `0.1.0`, those three workers are in `CrashLoopBackOff` and
prediction pipelines are unavailable. The rest of the product is unaffected.

### 1. The frontend container now listens on 8080, not 80

The frontend runs as an unprivileged user (uid 101), which cannot bind a port
below 1024.

**Kubernetes users: no action needed.** The Service targets the named port
`http`, so it resolves automatically.

**Docker Compose users: no action needed** if you use the bundled
`docker-compose.yml` — the mapping is already `3000:8080`.

**Action required if you wrote your own manifests, Service, Ingress, or
compose file that targets container port 80 numerically.** Change it to 8080:

```yaml
# before
ports:
  - containerPort: 80
# after
ports:
  - containerPort: 8080
```

Nothing about the *published* port changes — only the port inside the
container.

### 2. `curl` is no longer present in the Python images

`nexus`, `schema-service` and the three prediction workers no longer ship
`curl`. It was installed solely to run a `HEALTHCHECK` and was itself a source
of HIGH-severity CVEs.

The built-in `HEALTHCHECK` and the bundled Compose probes now use a Python
stdlib request instead, so the default setup needs no change.

**Action required if you have your own health check, readiness probe, or
sidecar that shells out to `curl` inside these containers.** Replace it with an
HTTP probe (Kubernetes `httpGet`) or a stdlib call:

```bash
python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=5).status==200 else 1)"
```

`wget` is available in the frontend image (busybox), but not in the Python
images.

### 3. All containers now run as a non-root user

| Image | uid |
|---|---|
| nexus, schema-service, the three prediction workers | 10001 |
| frontend (nginx-unprivileged) | 101 |
| trino | 1000 |

The Helm chart sets a matching `securityContext` on every deployment
(`runAsNonRoot`, `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation:
false`, `capabilities: drop: [ALL]`), which satisfies the Kubernetes
**restricted** Pod Security Standard.

**Action required if you mount a volume that was written by a previous
root-running container.** Files owned by uid 0 will not be writable. Either
`chown` the volume contents to the new uid, or set `fsGroup` on the pod so the
kubelet adjusts group ownership at mount time. The chart already sets `fsGroup`
to match each service.

`readOnlyRootFilesystem` is wired as a per-service toggle but defaults to
`false` — several services write scratch data (model cache, litellm and
matplotlib caches) and need an `emptyDir` mounted over those paths first.

### Also in this release, no action needed

- Base images moved from `python:3.11-slim` to `python:3.13-slim`, and the
  frontend from `nginx:alpine` to `nginxinc/nginx-unprivileged:stable-alpine`.
- Images are now multi-stage; compilers and build tooling no longer ship in the
  runtime layer.
- `schema-service` no longer bundles the NVIDIA CUDA runtime, which it could not
  use. The image drops from **9.21 GB to 1.95 GB**.
- The `xgboost` worker uses the `xgboost-cpu` distribution. Same import name,
  same version, no NVIDIA dependencies.
- Fixable CRITICAL/HIGH findings across the six images went from 91 to 8. See
  [security/CONTAINER_SECURITY.md](security/CONTAINER_SECURITY.md).

### Helm chart

Chart version `0.3.0`, `appVersion` `0.1.1`. Image tags are pinned to `0.1.1`.

```bash
helm repo update
helm upgrade dashboard actyze/dashboard --version 0.3.0
```

If you pin image tags yourself, move them from `0.1.0` to `0.1.1` — the worker
images in particular, for the reason above.
