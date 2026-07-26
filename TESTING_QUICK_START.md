# Testing Quick Start (5 Minutes)

## One Command: Full Test Suite

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Wait for startup
sleep 15

# Run all tests
echo "=== UNIT TESTS ===" && \
python3 -c "from shared.observability.python import logging, metrics, health; print('✓ Imports OK')" && \
python3 -m py_compile shared/observability/python/*.py && echo "✓ Syntax OK" && \
echo -e "\n=== INTEGRATION TESTS ===" && \
docker-compose ps | grep "Up" && echo -e "\n✓ All services running" && \
echo -e "\n=== E2E TESTS ===" && \
curl -s http://localhost:8002/healthz | jq '.status' && echo "✓ Nexus health OK" && \
curl -s http://localhost:8001/healthz | jq '.status' && echo "✓ Schema health OK" && \
curl -s http://localhost:8002/metrics | head -3 && echo "✓ Metrics OK" && \
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length' && echo "✓ Prometheus OK" && \
curl -s http://localhost:9187/metrics | head -1 && echo "✓ Postgres exporter OK" && \
echo -e "\n=== LOAD TEST ===" && \
for i in {1..5}; do curl -s http://localhost:8002/healthz > /dev/null & done && \
wait && echo "✓ Load test OK" && \
echo -e "\n✅ ALL TESTS PASSED"

# Cleanup
docker-compose down
```

---

## Test Matrix (Copy & Paste Each Section)

### Test 1: Can You Import?
```bash
python3 -c "from shared.observability.python import logging; print('✓')"
python3 -c "from shared.observability.python import metrics; print('✓')"
python3 -c "from shared.observability.python import health; print('✓')"
```
**Expected:** 3 checkmarks ✓

### Test 2: Do Services Start?
```bash
cd docker
docker-compose up -d postgres schema-service nexus
sleep 10
docker-compose ps | grep "Up"
```
**Expected:** 3 containers with "Up" status

### Test 3: Do Health Probes Work?
```bash
curl http://localhost:8002/healthz | jq .
curl http://localhost:8001/healthz | jq .
curl http://localhost:8002/readyz | jq .
```
**Expected:** JSON responses like `{"status":"alive","service":"nexus"}`

### Test 4: Do Metrics Export?
```bash
curl -s http://localhost:8002/metrics | grep -c "http_requests_total"
curl -s http://localhost:8001/metrics | grep -c "HELP"
```
**Expected:** 2 matches (numbers > 0)

### Test 5: Are Logs JSON?
```bash
docker logs nexus 2>&1 | jq '.' | head -1
docker logs schema-service 2>&1 | jq '.' | head -1
```
**Expected:** Valid JSON with fields like `timestamp`, `level`, `service`

### Test 6: Is Prometheus Scraping?
```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
```
**Expected:** A number (6+)

### Test 7: Is Postgres Exporter Working?
```bash
curl -s http://localhost:9187/metrics | grep "pg_" | head -1
```
**Expected:** A line starting with `pg_`

### Test 8: Can You Query?
```bash
curl -X POST http://localhost:8002/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"nl_query":"test"}' | jq .
```
**Expected:** Valid JSON response

### Test 9: Did Query Generate Metrics?
```bash
curl -s http://localhost:8002/metrics | grep "http_requests_total" | wc -l
```
**Expected:** A number (increases with each request)

### Test 10: Can Prometheus Query Metrics?
```bash
curl -s 'http://localhost:9090/api/v1/query?query=http_requests_total' | jq '.data.result | length'
```
**Expected:** A number (1+)

---

## Troubleshooting (If Tests Fail)

| Problem | Check | Fix |
|---------|-------|-----|
| `curl: failed to connect` | Service running? | `docker-compose ps` |
| `jq: parse error` | Service responding? | `curl http://localhost:8002/healthz` |
| `Module not found` | Python path OK? | `cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard` |
| `No metrics` | Service instrumented? | `grep metrics docker/*/main.py` |
| `Prometheus targets: 0` | Prometheus running? | `docker-compose ps \| grep prometheus` |
| `Postgres exporter down` | Postgres up first? | `docker-compose up postgres postgres-exporter` |

---

## Full Test Report (3 Minutes)

```bash
#!/bin/bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

echo "=== Observability Test Report ==="
echo "Time: $(date)"
echo ""

# Count passed/failed
PASS=0
FAIL=0

# Test 1: Imports
python3 -c "from shared.observability.python import logging, metrics, health" 2>/dev/null && \
  echo "✓ PASS: Imports" && ((PASS++)) || echo "✗ FAIL: Imports" && ((FAIL++))

# Test 2: Compilation
python3 -m py_compile shared/observability/python/*.py 2>/dev/null && \
  echo "✓ PASS: Compilation" && ((PASS++)) || echo "✗ FAIL: Compilation" && ((FAIL++))

# Test 3: Services
RUNNING=$(docker-compose ps 2>/dev/null | grep -c "Up")
[ "$RUNNING" -ge 3 ] && echo "✓ PASS: Services running ($RUNNING)" && ((PASS++)) || \
  echo "✗ FAIL: Services ($RUNNING running)" && ((FAIL++))

# Test 4: Health probes
curl -s http://localhost:8002/healthz > /dev/null 2>&1 && \
  echo "✓ PASS: Health probes" && ((PASS++)) || echo "✗ FAIL: Health probes" && ((FAIL++))

# Test 5: Metrics
curl -s http://localhost:8002/metrics | grep -q "http_requests_total" && \
  echo "✓ PASS: Metrics export" && ((PASS++)) || echo "✗ FAIL: Metrics export" && ((FAIL++))

# Test 6: Logs
docker logs nexus 2>&1 | jq . > /dev/null 2>&1 && \
  echo "✓ PASS: Structured logs" && ((PASS++)) || echo "✗ FAIL: Structured logs" && ((FAIL++))

# Test 7: Prometheus
curl -s http://localhost:9090/api/v1/targets > /dev/null 2>&1 && \
  echo "✓ PASS: Prometheus" && ((PASS++)) || echo "✗ FAIL: Prometheus" && ((FAIL++))

# Test 8: Exporters
curl -s http://localhost:9187/metrics > /dev/null 2>&1 && \
  echo "✓ PASS: Postgres exporter" && ((PASS++)) || echo "✗ FAIL: Postgres exporter" && ((FAIL++))

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ SUCCESS" || echo "❌ FAILURES DETECTED"
```

---

## What You're Testing

| Service | What | Port | Command |
|---------|------|------|---------|
| **Nexus** | Health | 8002 | `curl http://localhost:8002/healthz` |
| | Metrics | 8002 | `curl http://localhost:8002/metrics` |
| | Logs | - | `docker logs nexus` |
| **Schema** | Health | 8001 | `curl http://localhost:8001/healthz` |
| | Metrics | 8001 | `curl http://localhost:8001/metrics` |
| **Workers** | Health | 8400+ | `curl http://localhost:8400/healthz` |
| | Metrics | 8400+ | `curl http://localhost:8400/metrics` |
| **Postgres** | Metrics | 9187 | `curl http://localhost:9187/metrics` |
| **Trino** | Metrics | 8444 | `curl http://localhost:8444/metrics` |
| **Prometheus** | Targets | 9090 | `curl http://localhost:9090/api/v1/targets` |
| **Grafana** | UI | 3001 | `http://localhost:3001` |

---

## Success Criteria (All Must Pass)

- ✅ All 6 services health probes return 200
- ✅ All services export Prometheus metrics
- ✅ All logs are valid JSON format
- ✅ Prometheus scraping 6+ targets
- ✅ Postgres exporter responding
- ✅ Trino exporter responding (if running)
- ✅ Queries work end-to-end
- ✅ Metrics increment on queries

---

## CI/CD Integration

```yaml
# .github/workflows/test-observability.yml
name: Test Observability
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: docker/setup-buildx-action@v1
      - name: Start services
        run: docker-compose -f docker/docker-compose.yml up -d
      - name: Wait for startup
        run: sleep 15
      - name: Test imports
        run: python3 -c "from shared.observability.python import logging, metrics, health"
      - name: Test health probes
        run: curl -s http://localhost:8002/healthz | jq .
      - name: Test metrics
        run: curl -s http://localhost:8002/metrics | grep http_requests_total
      - name: Test logs
        run: docker logs nexus 2>&1 | jq '.' | head -1
```

---

## Expected Test Execution Time

| Level | Time | Tests |
|-------|------|-------|
| Unit Tests | 10s | Imports, Compilation |
| Integration Tests | 15s | Services start, Health probes |
| E2E Tests | 20s | Metrics, Logs, Prometheus |
| Load Tests | 15s | Concurrent requests |
| **Total** | **~60s** | **8 test suites** |

