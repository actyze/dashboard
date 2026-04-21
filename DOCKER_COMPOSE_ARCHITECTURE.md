# Docker Compose Architecture Guide

## Overview

The Docker Compose setup is designed for **local development only** with smart defaults and flexible external service support.

## Service Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    STARTUP ORDER                             │
└─────────────────────────────────────────────────────────────┘

1. postgres (PostgreSQL 15)
   └─> Waits until healthy (pg_isready check)
       │
2. trino (Query Engine)
   ├─> depends_on: postgres (optional)
   └─> Waits until healthy (curl /v1/info)
       │
3. ┌──────────────────────────────────────┐
   │ These services can start in parallel │
   └──────────────────────────────────────┘
   │
   ├─> nexus (Main Backend - FastAPI)
   │   ├─> depends_on: postgres (optional)
   │   ├─> depends_on: trino (optional)
   │   ├─> Runs embedded migrations on startup ✅
   │   └─> Calls schema-service at runtime (no dependency)
   │
   └─> schema-service (FAISS Table Recommender)
       ├─> depends_on: trino (optional)
       ├─> Loads TPC-H: true (for local dev) ✅
       ├─> Has fallback intent examples (no nexus dependency)
       └─> Waits for Trino, then loads all schemas
           │
4. frontend (React UI)
   └─> depends_on: nexus (required)
       └─> Waits until Nexus is healthy

5. Prediction Workers (profile-gated, no startup dependencies)
   ├─> prediction-worker-xgboost   (profile: predictions)
   ├─> prediction-worker-lightgbm  (profile: predictions)
   └─> prediction-worker-autogluon (profile: predictions-timeseries)
       Workers read from Trino and write to Postgres directly.
       Nexus discovers workers via health checks at runtime.
```

## Service Details

### 1. PostgreSQL (`postgres`)

**Purpose**: Operational database for Nexus service

**Key Features**:
- ✅ Image: `postgres:15-alpine`
- ✅ Port: `5432`
- ✅ Database: `dashboard`
- ✅ User: `nexus_service`
- ✅ Health check: `pg_isready` every 10s
- ✅ Volume: `postgres_data` (persistent)

**Dependencies**: None (starts first)

**Profile**: `local`, `postgres-only`

**Migration Strategy**:
- ❌ **NO** auto-init scripts from `/docker-entrypoint-initdb.d`
- ✅ Migrations run by **Nexus service** via embedded Python script
- ✅ Located in: `nexus/db/migrations/`

### 2. Trino (`trino`)

**Purpose**: Distributed SQL query engine

**Key Features**:
- ✅ Custom image: `dashboard-trino:latest`
- ✅ Port: `8081` → `8080` (container)
- ✅ Catalogs: `postgres`, `tpch`, `memory`
- ✅ Health check: `curl /v1/info` every 30s
- ✅ Memory: 2-3GB

**Dependencies**: 
- `postgres` (optional, `required: false`)
- Works with external Trino if postgres not available

**Profile**: `local`, `trino-only`

**Configuration**:
```yaml
depends_on:
  postgres:
    condition: service_healthy
    required: false  # Can work without local postgres
```

### 3. Nexus (`nexus`)

**Purpose**: Main orchestration service (FastAPI)

**Key Features**:
- ✅ Port: `8000`
- ✅ **Runs database migrations automatically on startup** ✅
- ✅ Health check: `curl /health` every 30s
- ✅ Memory: 512-768MB

**Dependencies**:
- `postgres` (optional) - Uses external if not available
- `trino` (optional) - Uses external if not available
- `schema-service` - Called at runtime (no startup dependency)

**Profile**: `local` only

**Critical Behavior**:
```python
# In nexus/main.py lifespan function
async def lifespan(app: FastAPI):
    # Step 1: Run migrations FIRST ✅
    await run_migrations()  
    
    # Step 2: Start application
    yield
```

**Migration Files**:
```
nexus/db/migrations/
├── V000__nexus_base_schema.sql         # Core schema + intent examples
└── V001__user_controlled_query_saves.sql  # User-controlled saves
```

**Migration Process**:
1. Nexus starts
2. Connects to PostgreSQL
3. Creates `nexus.flyway_schema_history` table if not exists
4. Reads all `V*.sql` files from `nexus/db/migrations/`
5. Checks which versions are already applied
6. Applies new migrations in order
7. Records in `flyway_schema_history`
8. Starts FastAPI application

### 4. Schema Service (`schema-service`)

**Purpose**: FAISS-based table/column recommendations

**Key Features**:
- ✅ Port: `8001` → `8000` (container)
- ✅ **TPC-H: Always TRUE for local** ✅
- ✅ Loads all schemas every 3 hours
- ✅ MPNet embeddings for semantic search
- ✅ Memory: 1.5-2.5GB
- ✅ Volume: `schema_models` (ML model cache)

**Dependencies**:
- `trino` (optional) - Uses external if not available
- **NO dependency on `postgres`** - Has fallback intent examples

**Profile**: All profiles (always runs)

**TPC-H Configuration**:
```yaml
environment:
  INCLUDE_TPCH: ${INCLUDE_TPCH:-true}  # ✅ Always true for local!
```

**Why no Postgres dependency?**
- Intent examples loaded from database at runtime
- Has hardcoded fallback examples if DB not ready
- Makes startup more resilient

**Startup Process**:
1. Schema service starts
2. Downloads MPNet model (first time only)
3. Connects to Trino
4. Loads all catalogs: `postgres`, `tpch` ✅
5. Excludes: `system`, `jmx`, `memory`, `tpcds`
6. Generates FAISS embeddings
7. Tries to load intent examples from `nexus.intent_examples` (falls back if not available)
8. Ready to serve recommendations

### 5. Frontend (`frontend`)

**Purpose**: React UI (Nginx-served)

**Key Features**:
- ✅ Port: `3000` → `80` (container)
- ✅ Health check: `curl /` every 30s
- ✅ Memory: 128-256MB

**Dependencies**:
- `nexus` (required) - Waits for Nexus to be healthy

**Profile**: `local` only

## Profiles

Docker Compose uses **profiles** for flexible deployment:

### `local` Profile (Default)
**All services run locally:**
```bash
docker-compose up
# or
./start.sh
```

**Starts:**
- ✅ postgres (local)
- ✅ trino (local)
- ✅ nexus
- ✅ schema-service
- ✅ frontend

### `external` Profile
**Use external databases only:**
```bash
docker-compose --profile external up
# or
./start.sh --profile external
```

**Starts:**
- ✅ schema-service (connects to external Trino)
- ✅ nexus (connects to external Postgres + Trino)
- ✅ frontend

**Requires environment variables:**
```bash
POSTGRES_HOST=your-external-postgres.com
POSTGRES_PORT=5432
TRINO_HOST=your-external-trino.com
TRINO_PORT=443
TRINO_SSL=true
```

### `postgres-only` Profile
**Local Postgres + External Trino:**
```bash
docker-compose --profile postgres-only up
```

**Starts:**
- ✅ postgres (local)
- ✅ nexus (uses local Postgres, external Trino)
- ✅ schema-service (uses external Trino)
- ✅ frontend

### `predictions` Profile
**Add ML prediction workers (XGBoost + LightGBM):**
```bash
docker compose --profile local --profile predictions up
```

**Starts** (in addition to core services):
- ✅ prediction-worker-xgboost (port 8401, ~512MB)
- ✅ prediction-worker-lightgbm (port 8402, ~512MB)

### `predictions-timeseries` Profile
**Add AutoGluon time-series forecasting:**
```bash
docker compose --profile local --profile predictions-timeseries up
```

**Starts** (in addition to core services):
- ✅ prediction-worker-autogluon (port 8403, ~2GB)

> **Note:** AutoGluon image is ~3.9GB. Only start when testing time-series forecasting.

### Combined: All prediction workers
```bash
docker compose --profile local --profile predictions --profile predictions-timeseries up
```

## TPC-H Configuration (Local Only)

**✅ TPC-H is ALWAYS enabled for Docker Compose (local development)**

```yaml
# docker/docker-compose.yml (line 103)
schema-service:
  environment:
    INCLUDE_TPCH: ${INCLUDE_TPCH:-true}  # ✅ Default: true
```

**Why?**
- ✅ Local development needs sample data for testing
- ✅ TPC-H is perfect for demos and natural language queries
- ✅ No setup required - built into Trino

**Override (not recommended):**
```bash
# .env file
INCLUDE_TPCH=false  # Disable TPC-H even locally
```

**Production (Helm):**
- `values-dev.yaml`: `includeTpch: true` ✅
- `values-production.yaml`: `includeTpch: false` ❌

## Startup Sequence (Detailed)

### Step 1: PostgreSQL Starts (0-10s)
```
postgres:
  └─> Creates database: dashboard
  └─> Creates user: nexus_service
  └─> Listens on: 5432
  └─> Health check: PASS ✅
```

### Step 2: Trino Starts (10-30s)
```
trino:
  └─> Waits for postgres health check
  └─> Configures catalogs:
      ├─> postgres (jdbc:postgresql://postgres:5432/dashboard)
      ├─> tpch (built-in)
      └─> memory (temporary tables)
  └─> Starts coordinator
  └─> Health check: PASS ✅
```

### Step 3: Nexus Starts (30-45s)
```
nexus:
  └─> Waits for postgres & trino (optional)
  └─> Runs embedded migrations:
      ├─> CREATE SCHEMA nexus
      ├─> CREATE TABLE flyway_schema_history
      ├─> Apply V000__nexus_base_schema.sql
      │   ├─> users, roles, groups
      │   ├─> dashboards, tiles
      │   ├─> query_history
      │   ├─> intent_examples ✅
      │   └─> Bootstrap admin user
      ├─> Apply V001__user_controlled_query_saves.sql
      │   ├─> Add query_id (PK)
      │   ├─> Remove hash-based deduplication
      │   └─> Add save_new_query / update_existing_query functions
      └─> Migrations complete ✅
  └─> Starts FastAPI application
  └─> Health check: PASS ✅
```

### Step 4: Schema Service Starts (30-120s)
```
schema-service:
  └─> Waits for trino (optional)
  └─> Downloads MPNet model (first time: ~1 min)
  └─> Connects to Trino
  └─> Loads schemas:
      ├─> INCLUDE_TPCH=true ✅
      ├─> Excluded: system, jmx, memory, tpcds
      ├─> Loaded: postgres.*, tpch.* ✅
      └─> Total: ~86 tables (depends on your data)
  └─> Generates FAISS embeddings
  └─> Loads intent examples from nexus.intent_examples
      └─> (Falls back to hardcoded if not available)
  └─> Health check: PASS ✅
```

### Step 5: Frontend Starts (45-60s)
```
frontend:
  └─> Waits for nexus health check
  └─> Nginx serves React app
  └─> Health check: PASS ✅
```

## Health Checks

Each service has health checks to ensure readiness:

| Service | Health Check | Interval | Start Period |
|---------|--------------|----------|--------------|
| **postgres** | `pg_isready` | 10s | 0s |
| **trino** | `curl /v1/info` | 30s | 0s |
| **nexus** | `curl /health` | 30s | 60s |
| **schema-service** | `curl /health` | 30s | 120s |
| **frontend** | `curl /` | 30s | 30s |

**Start Period**: Grace period before health checks begin failing

## Volumes

### Persistent Data
```yaml
volumes:
  postgres_data:    # PostgreSQL database files
  schema_models:    # ML model cache (MPNet, spaCy)
```

**To reset everything:**
```bash
docker-compose down -v  # ⚠️ Deletes all data!
```

## Networks

All services use a shared bridge network:
```yaml
networks:
  dashboard:
    driver: bridge
    name: dashboard-local
```

**Internal communication:**
- `nexus` → `postgres:5432`
- `nexus` → `trino:8080`
- `nexus` → `schema-service:8000`
- `schema-service` → `trino:8080`
- `frontend` → `nexus:8000`

**External access:**
- `localhost:5432` → postgres
- `localhost:8081` → trino
- `localhost:8000` → nexus
- `localhost:8001` → schema-service
- `localhost:3000` → frontend

## Resource Limits

| Service | Memory (Min) | Memory (Max) | CPU |
|---------|--------------|--------------|-----|
| **postgres** | 512M | 1G | - |
| **trino** | 2G | 3G | - |
| **nexus** | 512M | 768M | - |
| **schema-service** | 1.5G | 2.5G | - |
| **frontend** | 128M | 256M | - |
| **TOTAL** | ~4.5GB | ~7.5GB | - |

## Key Takeaways

### ✅ For Local Development (Docker Compose):

1. **TPC-H is ALWAYS enabled** (`INCLUDE_TPCH=true` by default)
2. **Migrations run automatically** (embedded in Nexus service)
3. **No manual SQL scripts needed** (Flyway-style versioning)
4. **Dependencies are flexible** (`required: false` for external services)
5. **Schema service is independent** (no startup dependency on Nexus)
6. **Clean startup order** (Postgres → Trino → Nexus+Schema → Frontend)

### 🔄 Migration Flow:

```
Nexus starts
    ↓
Connects to Postgres
    ↓
Reads nexus/db/migrations/*.sql
    ↓
Applies only new versions
    ↓
Records in flyway_schema_history
    ↓
Starts FastAPI app
    ↓
Schema service loads intent_examples from nexus.intent_examples
```

### 🚀 Quick Commands:

```bash
# Start everything (local)
docker-compose up -d

# View logs
docker-compose logs -f nexus
docker-compose logs -f schema-service

# Check migration status
docker exec -it dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT * FROM nexus.flyway_schema_history ORDER BY installed_rank;"

# Restart with clean database
docker-compose down -v && docker-compose up -d

# Check TPC-H is loaded
docker-compose logs schema-service | grep "include_tpch"
# Expected: Loading schemas (include_tpch=True, excluded=['system', 'jmx', 'memory', 'tpcds'])

# Check loaded catalogs
docker-compose logs schema-service | grep "Catalogs:"
# Expected: Catalogs: 2 (postgres, tpch) ✅
```

## Troubleshooting

### Issue: "Nexus can't connect to postgres"
**Check:**
```bash
docker-compose logs postgres | grep "ready to accept connections"
docker exec -it dashboard-postgres pg_isready -U nexus_service
```

### Issue: "Schema service can't load schemas"
**Check:**
```bash
docker-compose logs trino | grep "SERVER STARTED"
docker exec -it dashboard-trino trino --execute "SHOW CATALOGS"
```

### Issue: "Migrations failed"
**Check:**
```bash
docker-compose logs nexus | grep "migration"
# Look for specific SQL errors
```

### Issue: "TPC-H not appearing"
**Check:**
```bash
# Verify environment variable
docker exec dashboard-schema-service env | grep INCLUDE_TPCH
# Should show: INCLUDE_TPCH=true

# Check logs
docker-compose logs schema-service | grep -E "(include_tpch|tpch)"
```

## Summary

✅ **Docker Compose = Local Development Only**  
✅ **TPC-H = Always Enabled for Testing**  
✅ **Migrations = Automatic via Nexus**  
✅ **Dependencies = Flexible (optional external services)**  
✅ **Schema Service = Independent & Resilient**  

**This setup is optimized for fast local development with production-like architecture!** 🚀

