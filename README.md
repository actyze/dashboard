# Dashboard - Natural Language to SQL

A comprehensive dashboard application that converts natural language queries to SQL using external LLM APIs.

## 🚀 **Architecture**

### **Core Components:**
- **Nexus**: FastAPI orchestration service with intelligent routing
- **Frontend**: React application with Material-UI and Tailwind CSS
- **Schema Service**: FAISS-powered schema recommendations with spaCy NER
- **Trino**: Distributed SQL query engine
- **PostgreSQL**: Operational database for metadata and user management

### **AI Model Options:**
- **External LLM**: OpenAI, Perplexity, Anthropic, Groq, Together.ai, etc. (1-3s inference)

## 📋 **Quick Start**

### **Deployment Options:**

#### 🐳 **Docker Compose (Recommended for Local Development)**
```bash
# Quick start with local environment
./scripts/docker-start.sh local -d

# Access at http://localhost:3000
```
📖 **[Complete Docker Deployment Guide](docker/DEPLOYMENT.md)**

#### ☸️ **Kubernetes with Helm (Production)**
```bash
# Deploy to Kubernetes cluster
helm install dashboard ./helm/dashboard -f ./helm/dashboard/values-dev.yaml -n dashboard
```

#### 🚀 **Pre-built Docker Images (Docker Hub)**
```bash
# Use pre-built images (no build time required)
docker pull actyze/dashboard-frontend:latest
docker pull actyze/dashboard-nexus:latest
docker pull actyze/dashboard-schema-service:latest

# Deploy with pre-built images
./scripts/docker-start.sh local -d
```
📖 **[CI/CD Pipeline Documentation](.github/workflows/README.md)**

### **Prerequisites:**
- Docker & Kubernetes (Kind/AKS)
- Helm 3.x
- kubectl

### **Local Deployment:**
```bash
# Create Kind cluster
kind create cluster --config kind-config-no-gpu.yaml

# Deploy with external LLM
helm install dashboard ./helm/dashboard \
  --namespace dashboard \
  --create-namespace \
  --values ./helm/dashboard/values-dev.yaml \
  --values ./helm/dashboard/values-dev-secrets.yaml
```

## 🎯 **Key Features**

- **Intelligent Schema Detection**: FAISS + spaCy NER for improved table recommendations
- **External LLM Integration**: Support for multiple providers (OpenAI, Perplexity, Anthropic, Groq)
- **Production Ready**: Kubernetes-native with health checks and monitoring
- **Security**: SQL injection prevention, RBAC, API key management
- **Performance**: 1-3s external LLM inference
- **User Preferences**: Schema boosting for personalized recommendations
- **File Upload**: Import CSV/Excel files into user-managed tables
- **Metadata Catalog**: Organization-level metadata descriptions for improved context

## 📁 **Project Structure**

```
dashboard/
├── nexus/                  # FastAPI orchestration service
├── frontend/               # React dashboard application
├── schema-service/         # FAISS schema recommendations
├── docker/                 # Docker Compose setup & documentation
└── helm/                   # Kubernetes charts & documentation
```

## 🔧 **Configuration**

### **External LLM Setup:**
See [EXTERNAL_LLM_SETUP.md](EXTERNAL_LLM_SETUP.md) for complete configuration guide.

### **Helm Values:**
See [helm/dashboard/VALUES_README.md](helm/dashboard/VALUES_README.md) for deployment options.

## 🧪 **Testing**

```bash
# Test natural language query (requires authentication token)
curl -X POST http://localhost:8000/api/generate-sql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"nl_query": "Show customers from California"}'

# Expected response with generated SQL
```

## 📊 **Performance**

| Component | Response Time | Memory | Notes |
|-----------|---------------|--------|-------|
| External LLM | 1-3s | Minimal | OpenAI, Perplexity, Anthropic, etc. |
| Schema Service | < 100ms | 1-2GB | FAISS vector search |
| Nexus API | < 200ms | 512MB-1GB | Orchestration and caching |
| Trino Queries | Varies | 2-4GB | Depends on query complexity |

## 🛠️ **Development**

```bash
# Build services locally using Docker Compose
cd docker && docker compose build

# Run all services
docker compose --profile local up -d

# Run tests
cd frontend && npm test
cd nexus && pytest
```

## 📚 **Documentation**

- [External LLM Setup](EXTERNAL_LLM_SETUP.md)
- [Docker Deployment](docker/DEPLOYMENT.md)
- [Helm Values Guide](helm/dashboard/VALUES_README.md)
- [Database Migrations](DATABASE_MIGRATIONS.md)
- [Schema Service](schema-service/README.md)
- [Nexus API](nexus/API_DOCUMENTATION.md)

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 **License**

MIT License - see LICENSE file for details.