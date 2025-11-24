# Dashboard Docker Deployment Guide

> **Note:** All commands in this guide should be executed from the project root directory unless otherwise specified.

This guide explains how to deploy the complete Dashboard application stack using Docker Compose, providing an alternative to Kubernetes/Helm deployment for local development and testing.

## 🏗️ Architecture Overview

The Dashboard application consists of multiple services that can be deployed using Docker Compose:

### Core Services
- **PostgreSQL Database**: Stores application data and demo datasets
- **FastAPI Nexus Service**: Main backend API with LLM integration
- **React Frontend**: User interface with nginx proxy
- **FAISS Schema Service**: Provides intelligent schema recommendations

### External Integrations
- **External Trino**: PepsiCo Trino cluster for real data queries
- **External LLM**: Perplexity API for SQL generation

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+ (or docker-compose 1.29+)
- 8GB+ RAM available for Docker
- Internet connection for external services

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd dashboard
```

### 2. Configure Environment

```bash
# Copy environment template
cp docker/docker.env.example .env.docker

# Edit with your API keys and credentials
nano .env.docker
```

### 3. Start Services

```bash
# For local development (PostgreSQL + Nexus + Frontend)
./scripts/docker-start.sh local -d

# For full environment (includes Schema Service + External Trino)
./scripts/docker-start.sh full -d
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Nexus API**: http://localhost:8002
- **Schema Service**: http://localhost:8001 (full environment only)
- **PostgreSQL**: localhost:5432

## 🔧 Deployment Options

### Local Development Environment

**File**: `docker/docker-compose.local.yml`

**Services**:
- PostgreSQL with demo data
- FastAPI Nexus (using PostgreSQL as mock Trino)
- React Frontend

**Use Case**: Local development, testing, demos without external dependencies

```bash
./scripts/docker-start.sh local -d
```

### Full Production-Like Environment

**File**: `docker/docker-compose.full.yml`

**Services**:
- PostgreSQL with demo data
- FAISS Schema Service
- FastAPI Nexus (with external Trino integration)
- React Frontend

**Use Case**: Testing with real external services, staging environment

```bash
./scripts/docker-start.sh full -d
```

## ⚙️ Configuration

### Environment Variables

Create `.env.docker` from `docker/docker.env.example`:

```bash
# External LLM Configuration
PERPLEXITY_API_KEY=your-api-key-here

# Database Configuration
POSTGRES_PASSWORD=dashboard_password
POSTGRES_USER=dashboard_user
POSTGRES_DB=dashboard

# Trino Configuration (External PepsiCo Trino)
TRINO_HOST=b2b-trinodb-preprod.dps.gw01.aks01.scus.preprod.azure.intra.pepsico.com
TRINO_PORT=443
TRINO_USER=pepconndb01
TRINO_PASSWORD=NgN6w@k8mKM1

# Service Configuration
LOG_LEVEL=INFO
DEBUG=true
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React application with nginx |
| Nexus API | 8002 | FastAPI backend service |
| Schema Service | 8001 | FAISS schema recommendations |
| PostgreSQL | 5432 | Database server |

### Volume Mounts

- `postgres_data`: PostgreSQL data persistence
- `schema_models`: FAISS model cache
- `./helm/dashboard/sql`: Database initialization scripts

## 🛠️ Management Commands

### Using the Management Script

```bash
# Start local development environment
./scripts/docker-start.sh local -d

# Start full environment
./scripts/docker-start.sh full -d

# Stop all services
./scripts/docker-start.sh stop

# Restart services
./scripts/docker-start.sh restart

# View logs
./scripts/docker-start.sh logs -f

# Check status
./scripts/docker-start.sh status

# Build images
./scripts/docker-start.sh build

# Clean up everything
./scripts/docker-start.sh clean
```

### Manual Docker Compose Commands

```bash
# Start local environment
docker-compose -f docker/docker-compose.local.yml up -d

# Start full environment
docker-compose -f docker/docker-compose.full.yml --env-file .env.docker up -d

# View logs
docker-compose -f docker/docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.local.yml down

# Rebuild images
docker-compose -f docker/docker-compose.full.yml build --no-cache
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8002
lsof -i :5432

# Stop conflicting services or change ports in docker/docker-compose files
```

#### 2. Memory Issues
```bash
# Check Docker memory allocation
docker system df
docker stats

# Increase Docker Desktop memory limit to 8GB+
```

#### 3. Database Connection Issues
```bash
# Check PostgreSQL logs
docker logs dashboard-postgres-local

# Verify database initialization
docker exec -it dashboard-postgres-local psql -U dashboard_user -d dashboard -c "\dt"
```

#### 4. External API Issues
```bash
# Check Nexus service logs
docker logs dashboard-nexus-local

# Verify environment variables
docker exec dashboard-nexus-local env | grep EXTERNAL_LLM
```

### Health Checks

All services include health checks. Check status:

```bash
# View all container health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific service health
docker inspect dashboard-nexus-local | grep -A 10 Health
```

### Log Analysis

```bash
# Follow all logs
./scripts/docker-start.sh logs -f

# View specific service logs
docker logs dashboard-nexus-local -f
docker logs dashboard-frontend-local -f
docker logs dashboard-postgres-local -f
```

## 🔄 Development Workflow

### 1. Code Changes

```bash
# After making code changes, rebuild affected services
docker-compose -f docker/docker-compose.local.yml build nexus
docker-compose -f docker/docker-compose.local.yml up -d nexus

# Or rebuild everything
./scripts/docker-start.sh build
./scripts/docker-start.sh restart
```

### 2. Database Changes

```bash
# Apply new SQL scripts
docker-compose -f docker/docker-compose.local.yml down
docker volume rm dashboard_postgres_local_data
./scripts/docker-start.sh local -d
```

### 3. Frontend Changes

```bash
# Rebuild frontend after changes
docker-compose -f docker/docker-compose.local.yml build frontend
docker-compose -f docker/docker-compose.local.yml up -d frontend
```

## 🚀 Production Considerations

### Security
- Use proper secrets management instead of environment files
- Enable SSL/TLS for external communications
- Implement proper authentication and authorization
- Regular security updates for base images

### Performance
- Use production-optimized Docker images
- Implement proper resource limits
- Set up monitoring and logging
- Use external managed databases for production

### Scalability
- Consider using Docker Swarm or Kubernetes for production
- Implement load balancing for multiple instances
- Use external caching solutions (Redis)
- Separate read/write database instances

## 📊 Monitoring

### Basic Monitoring

```bash
# Resource usage
docker stats

# Service health
./scripts/docker-start.sh status

# Application logs
./scripts/docker-start.sh logs -f
```

### Advanced Monitoring

For production deployments, consider:
- Prometheus + Grafana for metrics
- ELK Stack for log aggregation
- Health check endpoints monitoring
- Performance monitoring tools

## 🔗 Integration with Helm

This Docker Compose setup mirrors the Helm deployment configuration:

- **Same environment variables**: Consistent configuration across deployments
- **Same service architecture**: Identical service interactions
- **Same external integrations**: Uses same external APIs and services
- **Same database schemas**: Identical data structures and initialization

You can develop locally with Docker and deploy to production with Helm seamlessly.

## 📝 Next Steps

1. **Local Development**: Use `docker-compose.local.yml` for daily development
2. **Integration Testing**: Use `docker-compose.full.yml` to test with external services
3. **Production Deployment**: Migrate to Helm charts for Kubernetes deployment
4. **CI/CD Integration**: Incorporate Docker builds into your CI/CD pipeline

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review service logs using the provided commands
3. Verify environment configuration
4. Check Docker and system resources
