# Docker Local Development

This directory contains a **simplified Docker setup** for local development and testing.

## 🚀 Quick Start

```bash
# 1. Setup environment
cp env.example .env
# Edit .env with your API keys (especially PERPLEXITY_API_KEY)

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

Copy `docker.env.example` to `.env.docker` and configure:

```bash
# External LLM Configuration
PERPLEXITY_API_KEY=your-api-key-here

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

## 🔄 Development Workflow

1. **Code Changes**: Edit source code in your IDE
2. **Rebuild**: `./start.sh` (automatically rebuilds changed services)
3. **Test**: Use frontend or API directly
4. **Debug**: Check logs with `docker-compose logs -f`
5. **Reset**: `./stop.sh --clean && ./start.sh` for fresh start

### Quick Commands
```bash
# Rebuild specific service after code changes
docker-compose build nexus
docker-compose up -d nexus

# Rebuild everything
./start.sh

# View logs
docker-compose logs -f nexus     # Specific service
docker-compose logs -f           # All services

# Restart specific service
docker-compose restart nexus
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

- **[Complete Docker Deployment Guide](../DOCKER_DEPLOYMENT.md)** - Comprehensive setup guide
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
