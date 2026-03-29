# Actyze — Claude Code Review Standards

When reviewing pull requests, check for the following:

## Security
- Detect hardcoded secrets (API keys, tokens, passwords, connection strings)
- Identify SQL injection, XSS, or SSRF vulnerabilities
- Check authentication and authorization logic
- Verify no credentials are logged or exposed in error messages
- Review dependency versions for known CVEs

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
