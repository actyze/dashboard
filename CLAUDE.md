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
