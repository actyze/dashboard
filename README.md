# Actyze

**Open-source AI-native analytics platform.**

Ask questions in plain English, get SQL queries and interactive charts. Connect any database. Self-host in 2 minutes.

## Key Features

- **Natural language to SQL** -- ask questions in plain English, get SQL and visualizations
- **Semantic intelligence layer** -- relationship graph, verified queries, synonyms, KPI definitions
- **Voice AI assistant** -- interact with your data using voice
- **Federated querying via Trino** -- connect PostgreSQL, MySQL, Snowflake, BigQuery, and more
- **Scheduled KPIs (gold layer)** -- pre-aggregate metrics on a schedule (1-24h), materialized as real queryable tables
- **Interactive dashboards** -- Plotly-powered charts with drill-down and filtering
- **100+ LLM providers** -- use Claude, GPT, Llama, Mistral, or any provider via LiteLLM
- **Self-hosted** -- your data never leaves your infrastructure

## Quick Start

```bash
git clone https://github.com/actyze/dashboard.git
cd dashboard/docker
cp .env.example .env
# Edit .env — add your LLM API key (Anthropic, OpenAI, etc.)
docker-compose --profile local up -d
```

- Frontend: http://localhost:3000
- API: http://localhost:8000

## Architecture

```
Frontend (React) --> Nexus API (FastAPI) --> Trino --> Your Databases
                         |
                   Schema Service (FAISS)
                         |
                   LLM Provider (Claude, GPT, etc.)
```

| Component | Technology |
|---|---|
| Frontend | React 18, Material-UI |
| Backend (Nexus) | FastAPI, Python 3.11 |
| Schema Service | FAISS vector search, spaCy NER |
| Query Engine | Trino (federated SQL) |
| Database | PostgreSQL |
| LLM Gateway | LiteLLM (100+ providers) |

## Documentation

- [Docker Deployment Guide](docker/README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

[AGPL v3](LICENSE)
