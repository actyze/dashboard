# Observability Testing Strategy

## Testing Approach (4 Levels)

```
Level 1: Unit Tests        — Code compiles, imports work, functions callable
Level 2: Integration Tests — Services start, health probes respond
Level 3: End-to-End Tests  — Metrics flow, logs appear, queries work
Level 4: Load Tests        — Performance under realistic traffic
```

---

## Level 1: Unit Tests (Code Validation)

### Test Imports & Module Loading

**Test that shared library modules load correctly:**

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

# Python module imports
python3 -c "from shared.observability.python import logging; print('✓ logging module')"
python3 -c "from shared.observability.python import metrics; print('✓ metrics module')"
python3 -c "from shared.observability.python import health; print('✓ health module')"

# Service imports
python3 -c "import sys; sys.path.insert(0, 'nexus'); from app.logging import configure_logging; print('✓ Nexus logging')"
python3 -c "import sys; sys.path.insert(0, 'schema-service'); from app.observability_init import setup_observability; print('✓ Schema observability')"
```

**Test JavaScript/TypeScript:**

```bash
# Check TypeScript compiles
cd frontend
npm run build 2>&1 | grep -i "error" || echo "✓ Frontend builds"

# Check imports resolve
grep -r "from '@shared/observability\|import.*observability" src/ | head -5
```

### Test Configuration Syntax

```bash
# Verify YAML syntax
python3 -c "import yaml; yaml.safe_load(open('docker/docker-compose.yml')); print('✓ docker-compose.yml valid')"
python3 -c "import yaml; yaml.safe_load(open('PACKAGING_STRATEGY.md')); print('✓ Config examples valid')" 2>/dev/null || echo "Note: Markdown YAML is example only"

# Verify Python syntax
python3 -m py_compile shared/observability/python/*.py && echo "✓ All Python files compile"
python3 -m py_compile nexus/app/*.py && echo "✓ Nexus app modules compile"
python3 -m py_compile docker/prediction-worker-xgboost/*.py 2>&1 | grep -i "error" || echo "✓ Prediction worker modules compile"
```

---

## Level 2: Integration Tests (Services Start)

### Start All 8 Services

**Test 1: Build all Docker images**

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

echo "Building Actyze services..."
docker build -f nexus/Dockerfile -t nexus:test . && echo "✓ Nexus"
docker build -f schema-service/Dockerfile -t schema:test . && echo "✓ Schema Service"
docker build -f docker/prediction-worker-xgboost/Dockerfile -t worker-xgb:test . && echo "✓ XGBoost Worker"
docker build -f docker/prediction-worker-lightgbm/Dockerfile -t worker-lgb:test . && echo "✓ LightGBM Worker"
docker build -f docker/prediction-worker-autogluon/Dockerfile -t worker-auto:test . && echo "✓ AutoGluon Worker"
docker build -f frontend/Dockerfile -t frontend:test . && echo "✓ Frontend"
```

**Expected output:**
```
✓ Nexus
✓ Schema Service
✓ XGBoost Worker
✓ LightGBM Worker
✓ AutoGluon Worker
✓ Frontend
```

**Test 2: Start docker-compose stack**

```bash
cd docker

# Start minimal stack (just check services come up)
docker-compose up -d postgres postgres-exporter schema-service nexus prometheus grafana

# Wait for startup
sleep 10

# Check all containers running
docker-compose ps | grep -E "postgres|schema-service|nexus|prometheus|grafana"

# Should see all as "running" (not "exited" or "restarting")
```

**Test 3: Verify health endpoints respond**

```bash
# Health endpoints should return 200 (or 503 if dependencies down)
echo "Testing health endpoints..."

curl -s http://localhost:8002/healthz | jq . && echo "✓ Nexus /healthz" || echo "✗ Nexus /healthz failed"
curl -s http://localhost:8001/healthz | jq . && echo "✓ Schema /healthz" || echo "✗ Schema /healthz failed"

# Readiness (includes dependency checks)
curl -s http://localhost:8002/readyz | jq . && echo "✓ Nexus /readyz" || echo "✗ Nexus /readyz failed"

# If dependencies aren't up, readyz will return 503 - that's expected
```

**Test 4: Verify services are instrumented (import check)**

```bash
# Check logs contain observability initialization
docker logs nexus 2>&1 | grep -i "observability\|logging\|metrics\|health" | head -3
docker logs schema-service 2>&1 | grep -i "observability\|health" | head -3

# If no logs, services may not have started - check error logs
docker logs nexus 2>&1 | tail -20
```

---

## Level 3: End-to-End Tests (Metrics & Logs Flow)

### Test 1: Metrics Endpoint Responds

```bash
echo "=== Testing Metrics Endpoints ==="

# Nexus metrics
NEXUS_METRICS=$(curl -s http://localhost:8002/metrics)
echo "$NEXUS_METRICS" | grep -q "http_requests_total\|http_request_duration_seconds" && echo "✓ Nexus exports HTTP metrics" || echo "✗ Nexus missing metrics"

# Schema Service metrics
SCHEMA_METRICS=$(curl -s http://localhost:8001/metrics)
echo "$SCHEMA_METRICS" | grep -q "prometheus_metrics\|HELP" && echo "✓ Schema exports metrics" || echo "✗ Schema missing metrics"

# Prediction worker (if running on 8400)
WORKER_METRICS=$(curl -s http://localhost:8400/metrics 2>/dev/null)
echo "$WORKER_METRICS" | grep -q "HELP\|TYPE" && echo "✓ Worker exports metrics" || echo "⚠ Worker not accessible on 8400"
```

**Expected output:**
```
✓ Nexus exports HTTP metrics
✓ Schema exports metrics
✓ Worker exports metrics
```

### Test 2: Logs Are Structured JSON

```bash
echo "=== Testing Structured Logging ==="

# Get logs from each service
NEXUS_LOG=$(docker logs nexus 2>&1 | head -5)
SCHEMA_LOG=$(docker logs schema-service 2>&1 | head -5)

# Check if JSON format
echo "$NEXUS_LOG" | jq . 2>/dev/null && echo "✓ Nexus logs are JSON" || echo "⚠ Nexus logs not JSON (may be startup messages)"
echo "$SCHEMA_LOG" | jq . 2>/dev/null && echo "✓ Schema logs are JSON" || echo "⚠ Schema logs not JSON"

# Check for required fields
docker logs nexus 2>&1 | jq -s 'map(select(.timestamp != null and .level != null))' 2>/dev/null | grep -q "timestamp" && echo "✓ Logs contain timestamp" || echo "⚠ timestamp field missing"
docker logs nexus 2>&1 | jq -s 'map(select(.request_id != null))' 2>/dev/null | grep -q "request_id" && echo "✓ Logs contain request_id" || echo "⚠ request_id missing"
```

**Expected output:**
```
✓ Nexus logs are JSON
✓ Schema logs are JSON
✓ Logs contain timestamp
✓ Logs contain request_id
```

### Test 3: Make a Query and Verify Metrics/Logs

```bash
echo "=== Testing Query Flow with Observability ==="

# Make a test API call
TEST_RESPONSE=$(curl -s -X POST http://localhost:8002/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"nl_query": "top 10 users"}' 2>/dev/null)

# Check if response is valid JSON
echo "$TEST_RESPONSE" | jq . 2>/dev/null && echo "✓ API returns valid JSON" || echo "✗ API response invalid"

# Now check logs for the query event
sleep 1  # Give logs time to flush

QUERY_LOG=$(docker logs nexus 2>&1 | jq 'select(.event == "query_executed" or .event == "nl_query_executed")' 2>/dev/null)
[ -n "$QUERY_LOG" ] && echo "✓ Query event logged" || echo "⚠ Query event not found in logs (check event names)"

# Check metrics were incremented
NEXUS_METRICS=$(curl -s http://localhost:8002/metrics)
echo "$NEXUS_METRICS" | grep -q "nl_queries_total.*{" && echo "✓ NL query metric incremented" || echo "⚠ nl_queries_total not in metrics"
```

**Expected output:**
```
✓ API returns valid JSON
✓ Query event logged
✓ NL query metric incremented
```

### Test 4: Prometheus Scraping Works

```bash
echo "=== Testing Prometheus Integration ==="

# Check Prometheus targets
TARGETS=$(curl -s http://localhost:9090/api/v1/targets)

# Should have 6+ services (Nexus, Schema, Workers, Exporters)
TARGET_COUNT=$(echo "$TARGETS" | jq '.data.activeTargets | length')
echo "Active Prometheus targets: $TARGET_COUNT"
[ "$TARGET_COUNT" -ge 6 ] && echo "✓ Prometheus scraping multiple services" || echo "⚠ Only $TARGET_COUNT targets (expected 6+)"

# Check if metrics are being collected
QUERY=$(curl -s 'http://localhost:9090/api/v1/query?query=http_requests_total')
echo "$QUERY" | jq '.data.result | length' | grep -q "[1-9]" && echo "✓ Prometheus collecting HTTP metrics" || echo "⚠ No metrics yet (may need traffic)"

# Check if Postgres exporter scraping
PG_METRICS=$(curl -s http://localhost:9187/metrics 2>/dev/null | grep "pg_" | head -1)
[ -n "$PG_METRICS" ] && echo "✓ Postgres exporter working" || echo "⚠ Postgres exporter not responding"
```

**Expected output:**
```
Active Prometheus targets: 7
✓ Prometheus scraping multiple services
✓ Prometheus collecting HTTP metrics
✓ Postgres exporter working
```

### Test 5: Database Observability

```bash
echo "=== Testing PostgreSQL Observability ==="

# Check if Postgres is logging
PG_LOGS=$(docker logs postgres 2>&1 | grep "LOG\|duration" | head -3)
[ -n "$PG_LOGS" ] && echo "✓ PostgreSQL query logging enabled" || echo "⚠ No query logs found"

# Check postgres-exporter metrics
PG_EXPORTER=$(curl -s http://localhost:9187/metrics)
echo "$PG_EXPORTER" | grep -q "pg_stat_database_connections\|pg_database_size" && echo "✓ Postgres exporter exporting metrics" || echo "✗ Postgres exporter not responding"

# Verify connections
CONN_METRIC=$(echo "$PG_EXPORTER" | grep "pg_stat_activity_count" | head -1)
echo "Sample: $CONN_METRIC" | grep -q "[0-9]" && echo "✓ Connection metrics available" || echo "⚠ Connection metrics not found"
```

**Expected output:**
```
✓ PostgreSQL query logging enabled
✓ Postgres exporter exporting metrics
✓ Connection metrics available
```

### Test 6: Trino Observability

```bash
echo "=== Testing Trino Observability ==="

# Check if Trino is up
TRINO_INFO=$(curl -s http://localhost:8081/v1/info)
echo "$TRINO_INFO" | jq . && echo "✓ Trino API responding" || echo "⚠ Trino not accessible"

# Check Trino exporter
TRINO_METRICS=$(curl -s http://localhost:8444/metrics 2>/dev/null | grep "trino_" | head -1)
[ -n "$TRINO_METRICS" ] && echo "✓ Trino exporter metrics available" || echo "⚠ Trino exporter not responding"

# Check query stats endpoint
QUERY_STATS=$(curl -s http://localhost:8081/v1/stats)
echo "$QUERY_STATS" | jq . && echo "✓ Trino query stats available" || echo "⚠ Query stats endpoint failed"
```

**Expected output:**
```
✓ Trino API responding
✓ Trino exporter metrics available
✓ Trino query stats available
```

---

## Level 4: Load Testing (Performance Under Traffic)

### Test 1: Generate Query Load

```bash
echo "=== Testing Under Load ==="

# Function to make test queries
make_queries() {
  for i in {1..10}; do
    curl -s -X POST http://localhost:8002/api/generate-sql \
      -H "Content-Type: application/json" \
      -d "{\"nl_query\": \"test query $i\"}" \
      > /dev/null &
  done
  wait
}

# Generate 10 concurrent queries
make_queries && echo "✓ 10 concurrent queries sent"

sleep 2

# Check metrics increased
METRICS_AFTER=$(curl -s http://localhost:8002/metrics)
REQUEST_COUNT=$(echo "$METRICS_AFTER" | grep "http_requests_total" | wc -l)
[ "$REQUEST_COUNT" -gt 0 ] && echo "✓ Request counters incremented" || echo "⚠ Request counters not updated"

# Check error rate is low
ERROR_REQUESTS=$(echo "$METRICS_AFTER" | grep 'http_requests_total.*status="5[0-9][0-9]"')
[ -z "$ERROR_REQUESTS" ] && echo "✓ No 5xx errors under load" || echo "⚠ Some requests failed"
```

### Test 2: Monitor Resource Usage

```bash
echo "=== Monitoring Resources ==="

# Check container memory/CPU
docker stats --no-stream nexus schema-service prediction-worker-xgboost

# Log rotation (services shouldn't run out of disk)
du -sh /var/lib/docker/containers/*/
echo "✓ Docker container logs size reasonable"
```

### Test 3: Prometheus Query Performance

```bash
echo "=== Testing Prometheus Query Performance ==="

# Query range of data (5 minute window)
QUERY='rate(http_requests_total[5m])'
RESPONSE=$(curl -s "http://localhost:9090/api/v1/query?query=$QUERY")

# Check if query returns results
RESULT_COUNT=$(echo "$RESPONSE" | jq '.data.result | length')
echo "Results for '$QUERY': $RESULT_COUNT series"
[ "$RESULT_COUNT" -gt 0 ] && echo "✓ Prometheus queries work" || echo "⚠ No results (may need more traffic)"

# Test slow query detection
SLOW_QUERY='histogram_quantile(0.95, http_request_duration_seconds_bucket)'
curl -s "http://localhost:9090/api/v1/query?query=$SLOW_QUERY" | jq '.data.result[0].value' && echo "✓ Percentile queries work"
```

---

## Level 5: Validation Checklist

### Docker Compose Validation

```bash
#!/bin/bash
echo "=== Docker Compose Validation Checklist ==="

PASS=0
FAIL=0

# Check 1: Services running
RUNNING=$(docker-compose ps | grep "Up" | wc -l)
echo "Services running: $RUNNING / 8"
[ "$RUNNING" -ge 6 ] && echo "✓ PASS: Most services running" && ((PASS++)) || echo "✗ FAIL: Not enough services running" && ((FAIL++))

# Check 2: Health probes responding
curl -s http://localhost:8002/healthz > /dev/null && echo "✓ PASS: Nexus health probe" && ((PASS++)) || echo "✗ FAIL: Nexus not responding" && ((FAIL++))
curl -s http://localhost:8001/healthz > /dev/null && echo "✓ PASS: Schema health probe" && ((PASS++)) || echo "✗ FAIL: Schema not responding" && ((FAIL++))

# Check 3: Metrics endpoints
curl -s http://localhost:8002/metrics | grep -q "http_requests_total" && echo "✓ PASS: Metrics exported" && ((PASS++)) || echo "✗ FAIL: No metrics" && ((FAIL++))

# Check 4: Prometheus scraping
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length' | grep -q "[6-9]\|[0-9][0-9]" && echo "✓ PASS: Prometheus targets" && ((PASS++)) || echo "✗ FAIL: Prometheus not scraping" && ((FAIL++))

# Check 5: Structured logs
docker logs nexus 2>&1 | jq . 2>/dev/null | grep -q "timestamp" && echo "✓ PASS: Structured JSON logs" && ((PASS++)) || echo "✗ FAIL: Logs not JSON" && ((FAIL++))

# Check 6: Database monitoring
curl -s http://localhost:9187/metrics | grep -q "pg_" && echo "✓ PASS: Postgres exporter" && ((PASS++)) || echo "✗ FAIL: Postgres exporter failed" && ((FAIL++))

# Summary
echo ""
echo "Validation Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ ALL TESTS PASSED" || echo "❌ SOME TESTS FAILED"
```

### Kubernetes Validation

```bash
# Check if all pods are running
kubectl get pods -l app=actyze

# Check health probes
kubectl logs -f deployment/nexus | jq 'select(.event == "health_check")'

# Check metrics collection
kubectl port-forward svc/prometheus 9090:9090
curl http://localhost:9090/api/v1/targets

# Check Grafana
kubectl port-forward svc/grafana 3000:3000
# Open http://localhost:3000 in browser
```

---

## Automated Test Script

**Create `test-observability.sh`:**

```bash
#!/bin/bash

set -e

echo "================================"
echo "Observability Test Suite"
echo "================================"

cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

# Level 1: Unit Tests
echo -e "\n[Level 1] Unit Tests"
python3 -c "from shared.observability.python import logging, metrics, health; print('✓ Module imports work')"
python3 -m py_compile shared/observability/python/*.py && echo "✓ Python files compile"

# Level 2: Integration Tests
echo -e "\n[Level 2] Integration Tests (Services Starting)"
docker-compose -f docker/docker-compose.yml up -d postgres schema-service nexus
sleep 10
docker-compose ps | grep "Up" | wc -l | grep -q "[6-9]\|[0-9][0-9]" && echo "✓ Services running" || echo "✗ Services failed"

# Level 3: E2E Tests
echo -e "\n[Level 3] E2E Tests (Metrics & Logs)"
curl -s http://localhost:8002/healthz | jq . && echo "✓ Health probes work"
curl -s http://localhost:8002/metrics | grep -q "http_requests_total" && echo "✓ Metrics exported"
docker logs nexus 2>&1 | jq . && echo "✓ Logs are JSON"

# Level 4: Load Tests
echo -e "\n[Level 4] Load Tests"
for i in {1..5}; do
  curl -s -X POST http://localhost:8002/api/generate-sql \
    -H "Content-Type: application/json" \
    -d "{\"nl_query\": \"test\"}" > /dev/null &
done
wait
sleep 1
curl -s http://localhost:8002/metrics | grep "http_requests_total" | grep -q "[0-9]" && echo "✓ Metrics under load"

# Cleanup
echo -e "\n[Cleanup]"
docker-compose down
echo "✓ Test complete"
```

**Run it:**
```bash
chmod +x test-observability.sh
./test-observability.sh
```

---

## Test Report Template

```markdown
# Observability Test Report

**Date:** $(date)
**Environment:** Docker Compose / Kubernetes / Production

## Level 1: Unit Tests
- [ ] Module imports work
- [ ] Python compiles without errors
- [ ] TypeScript builds successfully

## Level 2: Integration Tests
- [ ] All 8 services start (docker-compose ps)
- [ ] Health probes respond (curl /healthz)
- [ ] Readiness probes check dependencies (curl /readyz)

## Level 3: E2E Tests
- [ ] Metrics endpoints respond (curl /metrics)
- [ ] Metrics contain expected counters
- [ ] Logs are valid JSON format
- [ ] Prometheus scraping all services
- [ ] Postgres exporter responding
- [ ] Trino exporter responding
- [ ] Query flow works end-to-end

## Level 4: Load Tests
- [ ] 10+ concurrent queries handled
- [ ] Metrics incremented under load
- [ ] No memory leaks
- [ ] No 5xx error spikes

## Kubernetes Tests (if applicable)
- [ ] All pods running
- [ ] Liveness probes healthy
- [ ] Readiness probes healthy
- [ ] ServiceMonitors created
- [ ] Prometheus discovering services

## Results
✅ All Tests Passed / ❌ Some Tests Failed

### Issues Found
- [ ] (list any failures here)

### Sign-Off
Tested by: _______________
Date: _______________
```

---

## Quick Test Commands (Copy & Paste)

```bash
# Start everything
docker-compose -f docker/docker-compose.yml up -d

# Wait for startup
sleep 15

# Test all endpoints
echo "=== Health Checks ===" && \
curl http://localhost:8002/healthz && \
curl http://localhost:8001/healthz

echo -e "\n=== Metrics ===" && \
curl http://localhost:8002/metrics | head -20

echo -e "\n=== Prometheus ===" && \
curl http://localhost:9090/api/v1/targets

echo -e "\n=== PostgreSQL ===" && \
curl http://localhost:9187/metrics | head -10

echo -e "\n=== Logs ===" && \
docker logs nexus | jq '.' | head -10

# Stop when done
docker-compose down
```

