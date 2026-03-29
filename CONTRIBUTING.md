# Contributing to Actyze

Thank you for your interest in contributing to Actyze, an open-source AI-native analytics platform. This guide will help you get started.

Actyze is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/actyze/dashboard.git
   cd dashboard
   ```

2. Set up your environment file:
   ```bash
   cd docker && cp .env.example .env
   ```

3. Fill in your LLM API key (Anthropic, OpenAI, etc.) in the `.env` file.

4. Start the platform:
   ```bash
   docker-compose --profile local up -d
   ```

5. Access the application:
   - **Frontend:** http://localhost:3000
   - **API:** http://localhost:8000

## Development Setup

### Frontend

- Requires **Node 18**
- ```bash
  cd frontend
  npm install
  npm start
  ```

### Backend

- Requires **Python 3.11**
- ```bash
  cd nexus
  pip install -r requirements.txt
  python main.py
  ```

## Making Changes

1. Fork the repository and create a branch from `main`.
2. Use the following branch naming conventions:
   - `feat/description` for new features
   - `fix/description` for bug fixes
   - `docs/description` for documentation changes
3. Write commit messages following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `chore:` for maintenance tasks
4. Push your branch and open a pull request against `main`.

## Contributor License Agreement

- First-time contributors must sign the CLA via the **CLA Assistant** bot on their first pull request.
- The CLA enables dual licensing: AGPL for the community edition and a commercial license for enterprise deployments.
- You retain copyright of your contributions.

## Code Style

- **JavaScript:** ESLint (configured in `frontend/`)
- **Python:** [ruff](https://docs.astral.sh/ruff/) for linting, [black](https://black.readthedocs.io/) for formatting

## Testing

- **Frontend:**
  ```bash
  cd frontend
  npm test
  ```

- **Backend:**
  ```bash
  cd nexus
  pytest
  ```

All tests must pass before a pull request can be merged.

## Semantic Layer Contributions

The semantic layer is where community help matters most. Here are the key areas where you can contribute:

- **Synonym packs:** YAML files mapping business terms to column names (e.g., `synonyms/ecommerce.yaml`). These help the AI understand domain-specific vocabulary.
- **Relationship heuristics:** Naming convention patterns for JOIN inference, enabling automatic discovery of table relationships.
- **Verified query templates:** Pre-approved SQL for common questions, providing reliable answers for frequently asked queries.
- **KPI definition packs:** Standard metrics per industry, giving teams ready-to-use business metric definitions.

## Adding a Trino Connector

1. Create catalog properties in `docker/trino/catalog/`.
2. Document the connector in `docker/trino/README.md`.
3. Test with docker-compose:
   ```bash
   cd docker
   docker-compose --profile local up -d
   ```

## Project Structure

- `docker/`: Contains Docker Compose files and Docker-specific documentation (e.g., `DEPLOYMENT.md`).
- `helm/`: Contains Helm charts and Helm-specific documentation (e.g., `DEPLOYMENT.md`, `VALUES_README.md`).

## Community

- **Discord:** [https://discord.gg/actyze](https://discord.gg/actyze)
- **GitHub Discussions:** Use Discussions for long-form topics, proposals, and Q&A.
- **Monthly community call:** First Thursday of each month.

We look forward to your contributions!
