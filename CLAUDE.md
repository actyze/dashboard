# Actyze — Claude Code Review Standards

When reviewing pull requests, check for the following:

## Security
- Detect hardcoded secrets (API keys, tokens, passwords, connection strings)
- Identify SQL injection, XSS, or SSRF vulnerabilities
- Check authentication and authorization logic
- Verify no credentials are logged or exposed in error messages
- Review dependency versions for known CVEs

### Secrets handling (hard rules)
- **Never inline a credential** (API key, password, token, OAuth secret, JWT signing key, DB connection string with embedded password, customer credentials) into any file that gets committed — including workflows, docker-compose files, helm values, READMEs, scripts, source code, comments, and example configs.
- In **GitHub Actions workflows**, always read secrets via `${{ secrets.NAME }}` — never write a literal value, and never use `${VAR:-fallback}` patterns where the fallback is the real credential.
- In **docker-compose, helm values, and scripts**, use environment variable references (`${VAR}` or `${VAR:-placeholder}`) and source the real values from a gitignored `.env` file or runtime injection.
- In **documentation and example configs**, use placeholders like `<your-api-key>`, `<your-trino-password>`, `${VAR}`, or `***REDACTED***`. Never use a real-looking value, even as an "example".
- **If you see a hardcoded credential while editing a file** — stop, flag it to the user, and propose redaction + rotation. Do not silently rewrite it.
- This repo enforces these rules with:
  - **`.pre-commit-config.yaml`** — gitleaks blocks local commits containing detected secrets
  - **`.github/workflows/secret-scan.yml`** — gitleaks runs on every PR and push to main
  - **GitHub Push Protection** — enabled in repo settings, blocks pushes at GitHub's receive step

### Container images — no CUDA in CPU-only services
No service in this repo requests a GPU (neither `docker-compose.yml` nor the Helm chart), so no image should ship CUDA runtime libraries. They are also **proprietary** (`LicenseRef-NVIDIA-Proprietary`), so they break the "everything is open source" claim as well as bloating images — `schema-service` once carried 15 of them and weighed 9.21 GB.

- **PyTorch**: the default PyPI `torch` wheel is the CUDA build and pulls ~15 `nvidia-*` packages (cuDNN, cuBLAS, NCCL, ...) plus `triton`. Any image that installs `torch` — directly or transitively via `sentence-transformers`, `autogluon`, etc. — must install it from the CPU index **first**, then install the rest:
  ```dockerfile
  RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
      && pip install --no-cache-dir -r requirements.txt
  ```
  Pin the torch version when a dependency caps it (`autogluon.timeseries==1.5.0` requires `torch>=2.6,<2.10`). An unpinned install resolves to the newest CPU wheel, which pip then **downgrades back to the CUDA build** to satisfy the ceiling — silently undoing the fix.
- Use `--index-url` scoped to the torch install, never `--extra-index-url` in `requirements.txt`: an extra index makes pip search both indexes for every package and pick whichever version looks newest (dependency-confusion risk).
- **xgboost** hard-declares `nvidia-nccl-cu12` on non-aarch64 Linux (~300 MB) for distributed GPU training. Prefer the **`xgboost-cpu`** distribution, which declares no NVIDIA dependencies and has the same import name. Where a dependency requires `xgboost` by name (`autogluon.tabular` does), install it then `pip uninstall -y nvidia-nccl-cu12`, and import the package in the same layer so an upstream change fails the build rather than the container.
- Verify on **both** architectures. CI builds `linux/amd64,linux/arm64` and these dependency markers are arch-conditional — an arm64-only check will miss CUDA that amd64 pulls in. This is not hypothetical: local arm64 scans reported clean while the shipped amd64 images carried `nvidia-nccl-cu12`, and only CI caught it.
- After changing image dependencies, confirm behaviour is unchanged (identical model output/predictions), not just that the image is smaller.
- `.github/workflows/sbom-and-scan.yml` enforces this — `security/license-policy.yml` denies the NVIDIA licence identifiers and fails the build.

## AGPL Compliance
- New source files should include AGPL-3.0 license header
- Third-party libraries must be compatible with AGPL-3.0
- No proprietary dependencies that would conflict with the license

## Code Quality
- Frontend: React 18, Material-UI, Tailwind CSS, Plotly for charts
- Backend: FastAPI, Python 3.11, SQLAlchemy async, structlog
- Follow existing patterns in the codebase
- No unnecessary console.log or debug print statements
- Database migrations must be backwards-compatible (use IF EXISTS guards)

## Testing
- New features should include tests (Jest for frontend, pytest for backend)
- Verify existing tests are not broken
- Backend tests go in nexus/tests/
- Frontend tests go alongside components in __tests__/ directories

## Architecture
- Nexus is the central API — all frontend requests go through it
- Schema Service handles FAISS-based table discovery
- Trino handles federated queries across data sources
- LiteLLM provides LLM abstraction (100+ providers)
- No license or paywall code — all features are free and unlimited

## Commits
- **Never add a `Co-Authored-By:` trailer to a commit message.** This repo uses
  cla-assistant, which requires a CLA signature from every author *and*
  co-author on a pull request. A trailer naming a no-reply address adds a
  "contributor" that can never sign, leaving the `license/cla` check stuck at
  "Contributor License Agreement is not signed yet" and blocking the PR.
- Do not append a "Generated with" footer to commit messages either, for the
  same reason.
- PR descriptions are unaffected — cla-assistant only reads commit metadata.
