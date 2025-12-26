# Docker Compose Quick Reference

## TL;DR

✅ **Docker Compose = Local Development ONLY**  
✅ **TPC-H = ALWAYS `true` for local** (hardcoded default)  
✅ **Migrations = Automatic** (Nexus runs them on startup)  
✅ **Total Memory = ~4.5-7.5GB**

## Service Startup Order

```
1. postgres (10s)          ← Database starts first
   ↓
2. trino (30s)             ← Query engine connects to postgres
   ↓
3. ┌─ nexus (45s)         ← Main backend (runs migrations ✅)
   └─ schema-service (120s) ← Table recommender (loads TPC-H ✅)
   ↓
4. frontend (60s)          ← React UI
```

## TPC-H Configuration

**File:** `docker/docker-compose.yml` (line 103)

```yaml
schema-service:
  environment:
    INCLUDE_TPCH: ${INCLUDE_TPCH:-true}  # ✅ Always true for local!
```

**Override (not recommended):**
```bash
# .env file
INCLUDE_TPCH=false
```

**Why always true?**
- Local development needs sample data
- TPC-H perfect for testing natural language queries
- Built into Trino (no setup)

## Key Dependencies

```yaml
postgres:
  depends_on: []  # Starts first

trino:
  depends_on:
    - postgres (optional, required: false)

nexus:
  depends_on:
    - postgres (optional, required: false)
    - trino (optional, required: false)
  # schema-service: Called at runtime (no dependency)

schema-service:
  depends_on:
    - trino (optional, required: false)
  # NO postgres dependency (has fallback intent examples)

frontend:
  depends_on:
    - nexus (required)  # Waits for Nexus to be healthy
```

**Why `required: false`?**
- Allows using external Postgres/Trino
- Services start even if local DB not available
- Flexible for different environments

## Database Migrations

**Location:** `nexus/db/migrations/`

```
V000__nexus_base_schema.sql           ← Core schema (users, dashboards, intent_examples)
V001__user_controlled_query_saves.sql ← User-controlled saves
```

**Flow:**
```
Nexus starts
  → Connects to Postgres
  → Creates nexus.flyway_schema_history
  → Reads V*.sql files
  → Applies new migrations
  → Starts FastAPI app
```

**Check migration status:**
```bash
docker exec -it dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT version, description, success FROM nexus.flyway_schema_history;"
```

## Ports

| Service | External | Internal | Purpose |
|---------|----------|----------|---------|
| **postgres** | 5432 | 5432 | PostgreSQL DB |
| **trino** | 8081 | 8080 | SQL Query Engine |
| **nexus** | 8000 | 8000 | Main Backend API |
| **schema-service** | 8001 | 8000 | Table Recommender |
| **frontend** | 3000 | 80 | React UI |

## Profiles

### `local` (default)
```bash
docker-compose up -d
```
Starts: postgres + trino + nexus + schema-service + frontend

### `external`
```bash
docker-compose --profile external up -d
```
Starts: nexus + schema-service + frontend (uses external DBs)

### `postgres-only`
```bash
docker-compose --profile postgres-only up -d
```
Starts: postgres + nexus + schema-service + frontend (external Trino)

## Common Commands

### Start Everything
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f nexus
docker-compose logs -f schema-service
```

### Check TPC-H is Loaded
```bash
docker-compose logs schema-service | grep -E "(include_tpch|Catalogs:)"
# Expected:
# Loading schemas (include_tpch=True, excluded=['system', 'jmx', 'memory', 'tpcds'])
# Catalogs: 2 (postgres, tpch) ✅
```

### Restart with Clean Database
```bash
docker-compose down -v  # ⚠️ Deletes all data!
docker-compose up -d
```

### Check Service Health
```bash
docker-compose ps
# All services should show "healthy"
```

### Verify Migrations Ran
```bash
docker exec dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT version, description, installed_on, success FROM nexus.flyway_schema_history ORDER BY installed_rank;"
```

### Test TPC-H is Available
```bash
docker exec dashboard-trino trino --execute "SHOW SCHEMAS FROM tpch"
# Expected: sf1, sf10, sf100, sf1000, sf10000, sf100000, tiny
```

### Check Intent Examples Loaded
```bash
docker exec dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT intent, COUNT(*) FROM nexus.intent_examples GROUP BY intent;"
```

## Resource Usage

| Service | Memory | Startup Time |
|---------|--------|--------------|
| **postgres** | 512M-1G | 10s |
| **trino** | 2-3G | 30s |
| **nexus** | 512-768M | 45s |
| **schema-service** | 1.5-2.5G | 120s (first time) |
| **frontend** | 128-256M | 30s |
| **TOTAL** | ~4.5-7.5GB | ~2 min |

## Troubleshooting

### Issue: Service won't start
```bash
# Check dependencies
docker-compose ps

# View logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Issue: Migrations failed
```bash
# Check Nexus logs
docker-compose logs nexus | grep -i "migration\|error"

# Check what migrations are applied
docker exec dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT * FROM nexus.flyway_schema_history WHERE success = false;"
```

### Issue: TPC-H not showing
```bash
# Verify env var
docker exec dashboard-schema-service env | grep INCLUDE_TPCH
# Should be: INCLUDE_TPCH=true

# Restart schema service
docker-compose restart schema-service
docker-compose logs -f schema-service
```

### Issue: Out of memory
```bash
# Check memory usage
docker stats

# Increase Docker Desktop memory limit to 8GB+
```

## Summary

**Docker Compose Setup:**
- ✅ TPC-H enabled by default (always `true`)
- ✅ Automatic migrations (no manual SQL)
- ✅ Flexible dependencies (works with external services)
- ✅ Health checks ensure proper startup order
- ✅ Clean separation of concerns

**For Production:**
- Use Helm charts (separate TPC-H config per environment)
- `values-dev.yaml`: `includeTpch: true`
- `values-production.yaml`: `includeTpch: false`

---

📖 **Full Details:** See `DOCKER_COMPOSE_ARCHITECTURE.md`

