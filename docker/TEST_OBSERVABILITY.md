# Test Observability Stack (Using Existing Scripts)

## Start Everything (One Command)

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard/docker

# Start all services (builds images if needed)
./start.sh

# Or with options:
./start.sh --no-build              # Skip building, use existing images
./start.sh --logs                  # Follow logs after starting
./start.sh --profile postgres-only # Use external Trino only
./start.sh --help                  # See all options
```

**Available Profiles:**
- `local` (default) — Local PostgreSQL + Local Trino
- `external` — External PostgreSQL + External Trino only
- `postgres-only` — Local PostgreSQL + External Trino
- `trino-only` — External PostgreSQL + Local Trino

**Expected Output:**
```
🚀 Starting Dashboard Local Development Environment...
📦 Starting services with profile: local
🔨 Building images locally...
⏳ Waiting for services to be healthy...
✅ Dashboard is ready!

🌐 Access URLs:
  📱 Frontend:      http://localhost:3000
  🔧 Nexus API:     http://localhost:8000
  🤖 Schema API:    http://localhost:8001
  🗄️  Trino:         http://localhost:8081
  🐘 PostgreSQL:    localhost:5432
```

---

## Test Observability (While Running)

### Quick Tests (While `./start.sh` is running)

**In another terminal:**

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

# Test 1: Health Probes
echo "=== Health Probes ===" && \
curl http://localhost:8000/healthz | jq . && \
curl http://localhost:8001/healthz | jq .

# Test 2: Metrics Export
echo -e "\n=== Metrics ===" && \
curl http://localhost:8000/metrics | head -5 && \
curl http://localhost:8001/metrics | head -5

# Test 3: Structured Logs
echo -e "\n=== Logs ===" && \
docker logs dashboard-nexus 2>&1 | jq '.' | head -3 && \
docker logs dashboard-schema-service 2>&1 | jq '.' | head -3

# Test 4: Prometheus Scraping
echo -e "\n=== Prometheus ===" && \
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'

# Test 5: Database Monitoring
echo -e "\n=== PostgreSQL Exporter ===" && \
curl http://localhost:9187/metrics | head -1

# Test 6: Make a Query
echo -e "\n=== Test Query ===" && \
curl -X POST http://localhost:8000/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"nl_query":"top 10 users"}' | jq '.status'

# Test 7: Check Metrics Updated
echo -e "\n=== Query Metrics ===" && \
curl http://localhost:8000/metrics | grep "http_requests_total" | head -1
```

**Expected Results:**
```
✓ Health Probes: {"status":"alive",...}
✓ Metrics: # HELP http_requests_total...
✓ Logs: {"timestamp":"...", "level":"INFO",...}
✓ Prometheus: 6 (or higher - number of targets)
✓ PostgreSQL: pg_stat_database_connections...
✓ Query Response: "success"
✓ Metrics Updated: http_requests_total{...} 123
```

---

## Full Observability Validation (1 Minute)

```bash
#!/bin/bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

echo "=== Observability Validation ==="
echo ""

PASS=0
FAIL=0

# Test 1: Services Running
docker ps | grep -E "nexus|schema-service|postgres" > /dev/null && \
  echo "✓ Services running" && ((PASS++)) || echo "✗ Services not running" && ((FAIL++))

# Test 2: Nexus Health
curl -s http://localhost:8000/healthz | jq . > /dev/null 2>&1 && \
  echo "✓ Nexus health" && ((PASS++)) || echo "✗ Nexus health failed" && ((FAIL++))

# Test 3: Schema Health
curl -s http://localhost:8001/healthz | jq . > /dev/null 2>&1 && \
  echo "✓ Schema health" && ((PASS++)) || echo "✗ Schema health failed" && ((FAIL++))

# Test 4: Metrics Export
curl -s http://localhost:8000/metrics | grep -q "http_requests_total" && \
  echo "✓ Metrics export" && ((PASS++)) || echo "✗ Metrics missing" && ((FAIL++))

# Test 5: Logs JSON
docker logs dashboard-nexus 2>&1 | jq . > /dev/null 2>&1 && \
  echo "✓ Logs are JSON" && ((PASS++)) || echo "✗ Logs not JSON" && ((FAIL++))

# Test 6: Prometheus
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length' | grep -q "[0-9]" && \
  echo "✓ Prometheus targets" && ((PASS++)) || echo "✗ Prometheus targets" && ((FAIL++))

# Test 7: Database Exporter
curl -s http://localhost:9187/metrics | grep -q "pg_" && \
  echo "✓ Postgres exporter" && ((PASS++)) || echo "✗ Postgres exporter" && ((FAIL++))

# Test 8: Query Works
curl -s -X POST http://localhost:8000/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"nl_query":"test"}' | jq . > /dev/null 2>&1 && \
  echo "✓ Query execution" && ((PASS++)) || echo "✗ Query failed" && ((FAIL++))

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ ALL TESTS PASSED" || echo "❌ SOME TESTS FAILED"
```

---

## Service Ports & Endpoints

| Service | Port | Endpoint | Test |
|---------|------|----------|------|
| **Frontend** | 3000 | http://localhost:3000 | UI loads |
| **Nexus API** | 8000 | http://localhost:8000 | REST API |
| | | /healthz | `curl http://localhost:8000/healthz` |
| | | /readyz | `curl http://localhost:8000/readyz` |
| | | /metrics | `curl http://localhost:8000/metrics` |
| **Schema Service** | 8001 | http://localhost:8001 | FAISS service |
| | | /healthz | `curl http://localhost:8001/healthz` |
| | | /metrics | `curl http://localhost:8001/metrics` |
| **Prediction Workers** | 8400+ | (background workers) | Model training |
| **Trino** | 8081 | http://localhost:8081/ui | Query engine |
| **PostgreSQL** | 5432 | postgres://user:pass@localhost | Database |
| **Postgres Exporter** | 9187 | http://localhost:9187/metrics | DB metrics |
| **Prometheus** | 9090 | http://localhost:9090 | Metrics collector |
| **Grafana** | 3001 | http://localhost:3001 | Visualization |

---

## View Observability Data

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker logs dashboard-nexus -f
docker logs dashboard-schema-service -f

# Filter for events
docker logs dashboard-nexus 2>&1 | jq 'select(.event == "query_executed")'

# Recent logs only
docker logs dashboard-nexus --tail 20
```

### Metrics
```bash
# View raw Prometheus format
curl http://localhost:8000/metrics

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=http_requests_total'

# View in Grafana
http://localhost:3001
# Data source: http://prometheus:9090
```

### Database Queries
```bash
# Connect to PostgreSQL
psql -h localhost -U nexus_service -d dashboard

# View query logs
docker logs dashboard-postgres 2>&1 | grep "LOG"
```

---

## Stop Everything

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard/docker

# Stop services (keep data)
./stop.sh

# Full cleanup (remove volumes)
./stop.sh --clean

# Or manually
docker-compose down
docker-compose down -v  # Remove volumes too
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `.env file not found` | `./start.sh` creates from `env.example`, edit if needed |
| Services won't start | Check Docker: `docker ps -a` |
| Ports in use | `./stop.sh --clean` and wait 10s |
| Logs not showing | Wait 30s for startup, then: `docker logs dashboard-nexus` |
| Metrics empty | Make a query first: `curl http://localhost:8000/healthz` |
| Prometheus no targets | Wait 30s for scrape: `curl http://localhost:9090/api/v1/targets` |

---

## What Gets Started

With `./start.sh`:

✅ PostgreSQL (5432)
✅ PostgreSQL Exporter (9187)
✅ Trino (8081)
✅ Nexus API (8000)
✅ Schema Service (8001)
✅ Prediction Workers (8400+)
✅ Frontend (3000)
✅ Prometheus (9090)
✅ Grafana (3001)

**Total: 9+ containers**

---

## Next Steps

1. **View Observability:**
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001
   - Nexus health: `curl http://localhost:8000/healthz`

2. **Make Queries & See Metrics:**
   - POST to http://localhost:8000/api/generate-sql
   - Watch metrics increment: `curl http://localhost:8000/metrics`

3. **Check Logs:**
   - `docker logs dashboard-nexus | jq '.'`
   - Look for `timestamp`, `level`, `service`, `request_id`

4. **See Database Health:**
   - `curl http://localhost:9187/metrics | grep pg_stat`

5. **When Done:**
   - `./stop.sh` (keep data)
   - `./stop.sh --clean` (full cleanup)

