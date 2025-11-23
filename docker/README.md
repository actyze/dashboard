# Docker Configuration Files

This directory contains all Docker-related configuration files for the Dashboard application.

## 📁 File Structure

### 🐳 **Docker Compose Files**

#### **Primary Deployment Files**
- **`docker-compose.local.yml`** - Local development environment
  - PostgreSQL + Nexus + Frontend
  - Uses PostgreSQL as mock Trino
  - Minimal external dependencies
  - **Use for**: Daily development, testing, demos

- **`docker-compose.full.yml`** - Full production-like environment
  - PostgreSQL + Schema Service + Nexus + Frontend
  - Connects to external Trino and LLM services
  - Complete feature set
  - **Use for**: Integration testing, staging

#### **Reference Files**
- **`docker-compose.legacy.yml`** - Original Java backend setup (deprecated)
- **`docker-compose.nexus-only.yml`** - Nexus service only (for testing)

### 🏗️ **Dockerfiles**
- **`Dockerfile.frontend`** - React frontend with nginx
- **`Dockerfile.fastapi`** - FastAPI service (legacy, use nexus/Dockerfile)

### ⚙️ **Configuration Files**
- **`docker.env.example`** - Environment variables template
- **`nginx.conf`** - Nginx configuration for frontend service

## 🚀 **Quick Start**

### Local Development
```bash
# From repository root
./scripts/docker-start.sh local -d
```

### Full Environment
```bash
# From repository root
cp docker/docker.env.example .env.docker
# Edit .env.docker with your API keys
./scripts/docker-start.sh full -d
```

## 🔧 **Service Architecture**

### Local Environment (`docker-compose.local.yml`)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Nexus API      │    │   PostgreSQL    │
│   (nginx:3000)  │───▶│   (FastAPI:8002) │───▶│   (postgres:5432)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Full Environment (`docker-compose.full.yml`)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Nexus API      │    │   PostgreSQL    │
│   (nginx:3000)  │───▶│   (FastAPI:8002) │───▶│   (postgres:5432)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
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
```

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

## 🛠️ **Development Workflow**

### 1. Start Development Environment
```bash
./scripts/docker-start.sh local -d
```

### 2. Make Code Changes
```bash
# Rebuild specific service
docker-compose -f docker/docker-compose.local.yml build nexus
docker-compose -f docker/docker-compose.local.yml up -d nexus

# Or rebuild everything
./scripts/docker-start.sh build
./scripts/docker-start.sh restart
```

### 3. View Logs
```bash
./scripts/docker-start.sh logs -f
```

### 4. Stop Services
```bash
./scripts/docker-start.sh stop
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
