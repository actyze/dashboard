# Dependabot PR Triage — July 2026

All 22 open dependabot PRs were failing CI, so none were merged, so dependencies
went stale, so the enterprise scan found CVEs. The failures were almost entirely
a CI misconfiguration rather than real dependency breakage.

Two checks failed on **every** PR, including trivially safe ones:

- **`build-nexus` / `build-frontend` / `build-schema-service`** —
  `Username and password required`. The build workflow ran `docker/login-action`
  and `push: true` on `pull_request` events, but dependabot PRs run without
  repository secrets.
- **`build-complete`** — failed when all three build jobs were non-success, but
  `skipped` is normal for services a PR does not touch. A PR touching none of
  them (a GitHub Actions bump) skipped all three and was marked red.

Both are fixed on `chore/supply-chain-hardening-v2`. **Rerun CI on these PRs
after that branch merges before judging any of them.**

---

## Merge as-is once CI is fixed

Nothing wrong with these; they only ever failed the two checks above.

| PR | Change |
|---|---|
| 230 | `github/codeql-action` 3 → 4 |
| 231 | `docker/login-action` 3 → 4 |
| 232 | `actions/setup-python` 4 → 7 |
| 233 | `docker/setup-buildx-action` 3 → 4 |
| 234 | `actions/setup-node` 4 → 7 |
| 215, 229 | `trino` >=0.328.0 → >=0.338.0 (nexus + schema-service) |
| 218 | `apscheduler` >=3.10.0 → >=3.11.3 |
| 219 | `faiss-cpu` >=1.7.0 → >=1.14.3 |
| 216 | `sentence-transformers` >=2.3.0 → >=5.6.1 |
| 226 | `python-json-logger` 3.2.1 → 4.1.0 |
| 227 | `sqlglot` >=25.0.0 → >=30.13.0 |
| 228 | `structlog` 24.4.0 → 26.1.0 |

The schema-service ones (215–219) only raise a floor on an already-unpinned
requirement, so they change nothing at build time — verified: that service
already resolves to `sentence-transformers 5.6.1`, `faiss-cpu 1.14.3`,
`trino 0.338.0`, `numpy 2.5.1` on Python 3.13.

Check 226 and 228 against `shared/observability/python` before merging —
`python-json-logger` 4.x and `structlog` 26.x are major bumps and that module
imports both.

## Superseded by the hardening branch

| PR | Status |
|---|---|
| 213, 214 | `python` 3.11-slim → **3.14**-slim. The hardening branch moves to **3.13**-slim instead. |
| 217 | `numpy` >=1.21.0 → >=2.5.1. Was failing only because numpy 2.5 needs Python ≥3.12; fine on the 3.13 base. |
| 225 | `pip-minor-patch` group, 21 updates. Was failing on `openai==2.44.0` conflicting with the pinned `litellm`; the branch bumps `openai` to 2.48.0 and `litellm` to 1.93.0. |

**On 3.13 rather than 3.14:** PR 213's build failed with
`Unknown compiler(s): [['c++'], ...]` — a dependency had no 3.14 wheel and fell
back to a source build. 3.13.14 and 3.14.6 clear exactly the same seven CPython
CVEs (the eighth, CVE-2026-15308, has no fix below 3.15), so 3.14 buys no
security benefit while carrying materially worse ML wheel coverage. Revisit when
`autogluon`, `faiss-cpu` and `torch` all publish cp314 wheels.

Close 213/214/217 and rebase 225, or let dependabot recreate them against the
new baseline.

## Needs real work — do not merge blind

### PRs 238 + 239 — React 18 → 19

These must be merged **together**. Dependabot split React (238) and React DOM
(239) into separate PRs, and merging either alone gives:

```
npm error While resolving: react-dom@18.3.1
npm error Found: react@19.2.7
```

That ERESOLVE is the split, not an incompatibility — MUI v5.18's peer range is
`^17.0.0 || ^18.0.0 || ^19.0.0`, so MUI does not block React 19.

The actual risk is `react-scripts@5.0.1`, which is unmaintained and predates
React 19. Budget time for a real test pass, or migrate off Create React App
first.

### PR 224 — react-plotly.js 2.6.0 → 4.0.0

Blocked by a peer dependency the PR does not include: 4.0.0 requires
`plotly.js >=3.0.0`, and the repo pins `plotly.js-dist-min@^2.26.0`. Bump
plotly.js to v3 in the same PR, and re-check chart rendering — v3 dropped
several v2 APIs.

### PR 222 — postcss-preset-env 10.4.0 → 11.3.2

CI shows the Playwright admin-panel test timing out. The same test also fails on
PR 224, which suggests a pre-existing flake rather than a regression from either
bump. Confirm by running E2E on `main` before attributing it to this PR.

### PR 220 — npm-minor-patch group, 7 updates

Should be routine; recheck once CI is fixed.

---

## Why this recurs

The `security-scan` job in `build-and-push-images.yml` is `continue-on-error:
true` and only scans already-pushed tags, so a stale dependency with a CRITICAL
never blocked anything. `.github/workflows/sbom-and-scan.yml` now fails the
build on fixable CRITICAL/HIGH findings, which turns "dependabot PRs are stale"
into a visible build failure instead of a silent scan result.

Consider also enabling auto-merge for the GitHub Actions and patch-level groups
once CI is green, so this backlog does not rebuild.
