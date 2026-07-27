# Versioning & Releases

The single source of truth for how Actyze is versioned and released. Tracked in [#211](https://github.com/actyze/dashboard/issues/211).

## TL;DR

- **SemVer** (`MAJOR.MINOR.PATCH`).
- **Lockstep**: every Actyze-owned image shares **one** version, and that version is the Helm chart's `appVersion`. They move together.
- **Baseline: `0.1.0`.** We are pre-1.0.
- **Pin, never float**: the user-facing Helm chart and Compose file pin images to immutable version tags — never `latest`.

## Semantic Versioning

We follow [SemVer 2.0.0](https://semver.org). For Actyze, the parts mean:

| Bump | When |
|------|------|
| **MAJOR** | Breaking change a deployer must act on — incompatible API/contract change, a config/values key renamed or removed, or a non-backwards-compatible database migration. |
| **MINOR** | Backwards-compatible feature or capability. |
| **PATCH** | Backwards-compatible bug fix or security fix. No new features. |

**Pre-1.0 note:** while on `0.x`, treat **MINOR** (`0.MINOR.x`) as the line that may carry both features and occasional unavoidable breaking changes, and **PATCH** (`0.x.PATCH`) as fixes only. We move to `1.0.0` when the API/values surface is declared stable.

These map onto Conventional Commit PR titles (enforced in CI): `feat:` → MINOR, `fix:` → PATCH, `feat!:`/`BREAKING CHANGE:` → MAJOR.

## Lockstep versioning

Actyze ships several images from this monorepo:

- `actyze/dashboard-frontend`
- `actyze/dashboard-nexus`
- `actyze/dashboard-schema-service`
- `actyze/prediction-worker-xgboost`
- `actyze/prediction-worker-lightgbm`
- `actyze/prediction-worker-autogluon`

**They are versioned in lockstep**: a release tags **all** of them with the same `vX.Y.Z`, even if a given image didn't change that cycle. That one version is also the Helm chart's `appVersion` and the default image tag everywhere. This is the simplest model for a young project and makes "what version am I running?" answerable by a single number. (We can split images onto independent version streams later if lockstep becomes limiting — see #211.)

## Chart `version` vs `appVersion`

Per the Helm spec these are independent:

- **`appVersion`** = the Actyze release the chart deploys. Equals the image tag (lockstep). Bump on every app release.
- **`version`** = the chart package's own version. Bump on **any** chart change (templates or values), following SemVer for the chart itself (a renamed/removed values key is a chart MAJOR).

Default image tags in the chart resolve to `.Chart.AppVersion`, so `Chart.yaml` stays the single source of truth and users can still override per-image.

## Image tag policy

- **User-facing artifacts** (the `helm-charts` chart, the `dashboard-docker` compose file) **pin to immutable version tags** (e.g. `0.1.0`) with `pullPolicy: IfNotPresent`. Never `latest` or branch tags like `main-llm-flex` — those are non-reproducible, can't be rolled back, and silently change under a running deployment.
- **Third-party images** (Postgres, Trino) pin to explicit upstream tags (e.g. `postgres:15-alpine`, `trinodb/trino:477`).
- `latest`/branch tags are fine for kicking the tyres locally, but production deployments **must** pin.

## Release process

1. **Contribute** — PRs use Conventional Commit titles (`feat:`, `fix:`, …). CI lints the title; `release-drafter` auto-labels the PR and keeps a draft release up to date.
2. **Cut the release** — a maintainer publishes the drafted GitHub Release, which creates the `vX.Y.Z` tag.
3. **Build & publish** — `release-build.yml` builds and pushes all six images tagged `X.Y.Z` (+ `latest`/`stable` for non-prereleases).
4. **Bump & pin the deployables** — set `appVersion: X.Y.Z` in both chart copies and pin the `dashboard-docker` compose defaults to `X.Y.Z`; bump chart `version`.
5. **Publish the chart** — release the Helm chart (see #211 for `chart-releaser` automation).

A release should be owned by one person for the cycle (the "release shepherd"). Conventional Commits + release-drafter mean the changelog assembles itself.

## The two Helm chart copies — sync rule

There are intentionally **two** copies of the chart, and we are **not** consolidating them right now:

- **`actyze/helm-charts` → `dashboard/`** — the **canonical, user-facing** chart. End users deploy Actyze internally from here.
- **`actyze/dashboard` → `.helm-charts/dashboard/`** — an in-repo copy used only by the DigitalOcean **demo** deploy workflow.

**Rule:** these two must be kept **in sync**. Any change to one (templates, values, `Chart.yaml` version/appVersion, image tags) must be mirrored to the other in the same change set. The user-facing `helm-charts` copy is authoritative when they disagree. Sync is **manual for now** — automating it is tracked in #211; until then, treat "did I update both copies?" as part of every chart change's review checklist.

## Support window

While pre-1.0: the **latest released minor** is supported; security fixes are backported one minor where practical. We'll formalize an LTS line if adoption needs it.

## Known blocker before the first release

`release-build.yml` is currently stale and **must be fixed before cutting `v0.1.0`**:

- It builds only `[frontend, nexus, schema-service]` — the **3 prediction workers are missing** from the matrix.
- It points at non-existent paths: `docker/Dockerfile.frontend` (real: `frontend/Dockerfile`) and `models/schema-service/Dockerfile` (real: `schema-service/Dockerfile`).

Tracked in #211.
