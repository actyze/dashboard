# v0.1.0 — Initial public release

> **Draft — review before tagging. Do not tag with `gh release create` until Rohit approves.**

This is the first public release of Actyze, an open-source, self-hosted AI analytics platform. It is intended as a usable starting point for teams who want natural-language queries, federated SQL, and basic ML predictions on their own infrastructure under AGPL v3.

## Highlights

- **Natural language to SQL** via LiteLLM, with prompt grounding from a FAISS-indexed schema service.
- **Federated querying via Trino** — query across multiple sources in a single SQL statement.
- **Semantic intelligence layer** — persistent relationship graph in PostgreSQL with convention inference, query-history mining, and admin curation for JOIN resolution.
- **Schema exclusion** — global (org-level) hide/show controls for databases, schemas, and tables, integrated with the FAISS index (incremental remove for table-level, full refresh for higher levels).
- **Scheduled KPIs (gold layer)** — pre-aggregate metrics on a 1–24h schedule, materialized as real queryable tables.
- **No-code predictions (experimental)** — Forecast / Classify / Estimate wizard backed by XGBoost, LightGBM, and AutoGluon worker containers. KPI- or query-sourced training data; auto-retrain triggers.
- **Voice-driven queries** — speech input for natural-language questions in the UI.
- **Interactive dashboards** — Plotly charts with drill-down and filtering.
- **Docker Compose deployment** with profiles for local, external Trino, and postgres-only setups.
- **Helm charts** for Kubernetes deployment.

## Supported databases

Federation is delivered through Trino. The repo ships catalog templates for:

- PostgreSQL
- MongoDB
- Snowflake
- TPC-H (built-in for local dev)
- Memory connector (in-process testing)

Examples are also included for MySQL. Any Trino connector can be added by dropping a `*.properties` file into the catalog directory; see `docker/trino/` and the contributing guide.

## Supported LLMs

LLM access is brokered via LiteLLM and an external-LLM configuration layer, so 100+ providers are reachable. Documented and tested in the repo:

- Anthropic Claude (recommended for SQL generation)
- OpenAI (GPT-4o family)
- Perplexity
- Groq
- Together AI
- Google Gemini
- Any OpenAI-compatible endpoint via the `custom` provider

See `docker/LLM_PROVIDERS.md` and `EXTERNAL_LLM_SETUP.md`.

## Deployment

- **Docker Compose (recommended for first install):**
  ```bash
  cd docker && cp env.example .env
  # set your LLM API key
  ./start.sh
  ```
  Frontend: http://localhost:3000 · API: http://localhost:8000
- **Profiles:** `local` (default), `external` (BYO Trino + Postgres), `postgres-only` (local Postgres + external Trino), `predictions` and `predictions-timeseries` to enable ML workers.
- **Kubernetes:** Helm charts under `helm/` (Kind config files included for local development).
- **Default credentials:** `nexus_admin` / `admin`. **Change before exposing the instance.**

## Known limitations

- **Default admin password is hardcoded** for first boot. Rotate immediately on any non-local deployment.
- **Predictions are experimental.** AutoGluon time-series is profile-gated and may fall back to XGBoost if not deployed; end-to-end test plan in `PREDICTIVE_INTELLIGENCE_TEST_PLAN.md`.
- **Frontend integration tests** are partial — backend APIs are tested more thoroughly than UI flows in this release.
- **Grace-period and lock-mode behavior** for the licensing/admin paths is implemented but not exhaustively tested in CI; treat as best-effort.
- **Trino catalog auto-discovery** depends on the schema service finishing its initial FAISS load. On large catalogs this can take several minutes after first start.
- **No bundled migrations rollback path** — migrations are forward-only and assumed backwards-compatible per `CLAUDE.md`. Take a snapshot before upgrading.
- **No GPU support guaranteed** for prediction workers in the default Compose; `kind-config-no-gpu.yaml` is provided for CPU-only Kind clusters.

## Next

Planned for upcoming releases:

- Hardened auth defaults and a first-boot password reset flow.
- Broader frontend test coverage (predictions wizard, audit views, schema exclusion UI).
- More Trino catalog templates and synonym/KPI packs (community contributions welcome — see `CONTRIBUTING.md`).
- Tagged releases of the prediction worker images and a documented compatibility matrix.
- Stable upgrade/migration documentation between v0.x releases.

---

**Tagging instructions (after approval):**

```bash
git tag -a v0.1.0 -m "v0.1.0 — Initial public release"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0 — Initial public release" --notes-file RELEASE_NOTES_v0.1.0.md
```
