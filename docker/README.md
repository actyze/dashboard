# Docker Local Development

This directory contains a **simplified Docker setup** for local development and testing.

## 🚀 Quick Start

```bash
# 1. Setup environment
cp env.example .env
# Edit .env with your API keys (see LLM_PROVIDERS.md for all options)

# 2. Start all services (builds images locally)
./start.sh

# 3. Access the dashboard
open http://localhost:3000
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Nexus API      │    │   PostgreSQL    │
│   (nginx:3000)  │───▶│   (FastAPI:8002) │───▶│   (postgres:5432)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Full Environment (`docker-compose.full.yml`)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
                              │
                              ▼
                       ┌──────────────────┐
                       │  Schema Service  │
                       │  (FAISS:8001)    │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  External Trino  │
                       │  (PepsiCo:443)   │
                       └──────────────────┘

## 📋 **Environment Variables**

Copy `env.example` to `.env` and configure:

```bash
# LLM Configuration - Supports ANY provider!
# See LLM_PROVIDERS.md for detailed configuration examples
PERPLEXITY_API_KEY=your-api-key-here
EXTERNAL_LLM_PROVIDER=perplexity  # or anthropic, openai, groq, etc.
EXTERNAL_LLM_AUTH_TYPE=bearer     # or x-api-key, api-key
EXTERNAL_LLM_EXTRA_HEADERS=       # Provider-specific headers (JSON)

# Database Configuration
POSTGRES_PASSWORD=dashboard_password
POSTGRES_USER=dashboard_user
POSTGRES_DB=dashboard

# Trino Configuration (External)
TRINO_HOST=your-trino-host
TRINO_PORT=443
TRINO_USER=your-username
TRINO_PASSWORD=your-password
```

### 🤖 **LLM Provider Configuration**

Actyze supports **any LLM provider** with flexible authentication:

- **Anthropic Claude** - Excellent SQL generation (recommended)
- **OpenAI GPT-4** - Industry standard
- **Perplexity** - Fast with reasoning capabilities
- **Groq** - Ultra-fast open-source models
- **Together AI** - Wide selection of models
- **Custom** - Any OpenAI-compatible endpoint

**See [LLM_PROVIDERS.md](./LLM_PROVIDERS.md) for detailed configuration examples** for each provider.

## 🔄 Development Workflow

1. **Code Changes**: Edit source code in your IDE
2. **Rebuild**: `./start.sh` (automatically rebuilds changed services)
3. **Test**: Use frontend or API directly
4. **Debug**: Check logs with `docker-compose logs -f`
5. **Reset**: `./stop.sh --clean && ./start.sh` for fresh start

## 📋 Commands

### **Flexible Database Setup**
```bash
# Local databases (PostgreSQL + Trino) - Default
./start.sh

# External databases only (bring your own)
./start.sh --profile external

# Mixed: Local PostgreSQL + External Trino
./start.sh --profile postgres-only

# Other options
./start.sh --no-build      # Skip building, use existing images
./start.sh --logs          # Build, start and follow logs
```

### **External Database Configuration**
```bash
# 1. Copy template and configure external databases
cp env.example .env
vim .env

# 2. Update for external PostgreSQL
POSTGRES_HOST=your-external-postgres-host
POSTGRES_PORT=5432
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password

# 3. Update for external Trino
TRINO_HOST=your-external-trino-host
TRINO_PORT=443
TRINO_USER=your-trino-username
TRINO_PASSWORD=your-trino-password
TRINO_SSL=true

# 4. Start with external profile
./start.sh --profile external
```

### **Service Management**
```bash
# Stop services  
./stop.sh                  # Stop (preserve data)
./stop.sh --clean          # Stop and remove all data

# Monitor services
docker-compose ps          # Service status
docker-compose logs -f     # Follow all logs
docker-compose logs nexus  # Specific service logs
```

## 🔍 **Service Ports**

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React application with nginx proxy |
| Nexus API | 8002 | FastAPI backend service |
| Schema Service | 8001 | FAISS schema recommendations (full env only) |
| PostgreSQL | 5432 | Database server |

## 🧪 **Testing**

Test your deployment:
```bash
# Test local environment
./scripts/test-docker-deployment.sh local

# Test full environment
./scripts/test-docker-deployment.sh full
```

## 🔄 **Migration from Kubernetes**

The Docker Compose setup mirrors the Helm/Kubernetes deployment:

- **Same environment variables**
- **Same service architecture**
- **Same external integrations**
- **Same database schemas**

You can develop locally with Docker and deploy to production with Kubernetes seamlessly.

## 📚 **Additional Resources**

- **[Complete Docker Deployment Guide](DEPLOYMENT.md)** - Comprehensive setup guide
- **[Helm Deployment Guide](../helm/README.md)** - Kubernetes deployment
- **[Main README](../README.md)** - Project overview

## 🆘 **Troubleshooting**

### Common Issues

1. **Port conflicts**: Check `lsof -i :3000` and stop conflicting services
2. **Memory issues**: Increase Docker Desktop memory to 8GB+
3. **Database issues**: Check logs with `docker logs dashboard-postgres-local`
4. **API issues**: Verify environment variables in `.env.docker`

### Getting Help

1. Check service logs: `./scripts/docker-start.sh logs -f`
2. Check service status: `./scripts/docker-start.sh status`
3. Run tests: `./scripts/test-docker-deployment.sh local`
4. Clean restart: `./scripts/docker-start.sh clean && ./scripts/docker-start.sh local -d`
