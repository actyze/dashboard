# Monitoring External Services

This document covers monitoring strategies for external services that Actyze depends on: PostgreSQL, Trino, Redis, and other systems.

## PostgreSQL Monitoring

### Default Connection Metrics

The observability module automatically exposes:

```prometheus
# Active database connections
db_connections_active

# Idle connections
db_connections_idle
```

### Prometheus PostgreSQL Exporter

Use the official postgres_exporter to monitor your PostgreSQL instance:

#### Installation

```bash
# Docker
docker run -d \
  --name postgres_exporter \
  -e DATA_SOURCE_NAME="postgresql://user:password@postgres:5432/actyze?sslmode=disable" \
  prometheuscommunity/postgres-exporter:latest

# Docker Compose
version: '3.8'
services:
  postgres_exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      DATA_SOURCE_NAME: "postgresql://user:password@postgres:5432/actyze?sslmode=disable"
    ports:
      - "9187:9187"
    depends_on:
      - postgres
```

#### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Key Metrics to Monitor

```prometheus
# Connection pool health
pg_stat_activity_count              # Active connections by state
pg_stat_activity_max_tx_duration_seconds  # Longest transaction

# Query performance
pg_stat_statements_mean_time        # Average query duration
pg_slow_queries                     # Queries exceeding threshold

# Index health
pg_stat_user_indexes_idx_scan       # Index usage
pg_stat_user_indexes_idx_tup_read   # Index tuples read

# Table health
pg_stat_user_tables_n_live_tup      # Live rows
pg_stat_user_tables_seq_scan        # Full table scans
pg_stat_user_tables_last_vacuum     # Vacuum tracking

# Replication (if used)
pg_replication_lag_bytes            # Replication lag
pg_replication_slots_restart_lsn     # Slot state
```

### Health Check Configuration

In your service startup, add a PostgreSQL health check:

```python
from observability.python import HealthChecker
import asyncpg

health_checker = HealthChecker()

async def check_postgres():
    try:
        conn = await asyncpg.connect(
            host="postgres",
            port=5432,
            user="actyze",
            password="<password>",
            database="actyze",
            timeout=5
        )
        await conn.fetchval("SELECT 1")
        await conn.close()
        return True
    except Exception as e:
        logger.error("postgres_health_check_failed", error=str(e))
        return False

health_checker.register("postgres", check_postgres)
```

### Alerting Rules

```yaml
groups:
  - name: postgres
    rules:
      - alert: PostgresConnectionPoolExhausted
        expr: pg_stat_activity_count >= 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL connection pool near capacity"

      - alert: PostgresSlowQueries
        expr: rate(pg_stat_statements_mean_time[5m]) > 1000  # ms
        for: 10m
        labels:
          severity: warning

      - alert: PostgresHighSeqScans
        expr: rate(pg_stat_user_tables_seq_scan[5m]) > 10
        for: 5m
        labels:
          severity: info

      - alert: PostgresReplicationLag
        expr: pg_replication_lag_bytes > 1073741824  # 1GB
        for: 2m
        labels:
          severity: critical

      - alert: PostgresVacuumNeeded
        expr: time() - pg_stat_user_tables_last_vacuum > 86400  # 24h
        for: 1h
        labels:
          severity: warning
```

### Useful Queries

```sql
-- Active connections by user
SELECT usename, count(*) as connections
FROM pg_stat_activity
GROUP BY usename
ORDER BY connections DESC;

-- Long-running queries
SELECT pid, now() - pg_stat_activity.query_start as duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 minute'
ORDER BY duration DESC;

-- Unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_blks_read DESC;

-- Table size
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Trino Monitoring

### Trino Metrics Exposure

Trino exposes metrics on port 8989 by default. Add to your Prometheus config:

```yaml
scrape_configs:
  - job_name: 'trino'
    static_configs:
      - targets: ['localhost:8989']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### JMX Configuration for Enhanced Metrics

To enable JMX metrics on Trino:

```bash
# In Trino docker-compose or K8s environment:
TRINO_JVM_ADDITIONAL_SYSTEM_PROPERTIES="\
  -Dcom.sun.management.jmxremote=true \
  -Dcom.sun.management.jmxremote.port=9010 \
  -Dcom.sun.management.jmxremote.rmi.port=9010 \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dcom.sun.management.jmxremote.ssl=false"
```

### JMX Exporter Setup

Use the JMX exporter to expose Trino's JMX metrics as Prometheus metrics:

```yaml
# jmx-config.yml for Trino
lowercaseOutputName: true
lowercaseOutputLabelNames: true
rules:
  # Query metrics
  - pattern: "com.facebook.presto.execution<name=QueryManager><>(QueryStartTime|UserErrorCount|InternalErrorCount|QueuedQueries|RunningQueries|SubmittedQueries)"
    name: "trino_query_$1"
    type: GAUGE

  # Memory metrics
  - pattern: "com.facebook.presto.memory<name=MemoryPool, type=(.+)><>(FreeBytes|MaxBytes|ReservedBytes|ReservedRevocableBytes)"
    name: "trino_memory_${2}"
    labels:
      pool: "$1"

  # Connector metrics
  - pattern: "com.facebook.presto.connector.(.+)<name=(.+)><>(.*)"
    name: "trino_connector_$3"
    labels:
      connector: "$1"
      name: "$2"
```

Start the JMX exporter:

```bash
java -javaagent:jmx_exporter.jar=9990:jmx-config.yml -jar trino-server-all.jar
```

### Key Metrics to Monitor

```prometheus
# Query health
trino_query_submitted_total         # Total queries submitted
trino_query_completed_total         # Completed queries
trino_query_failed_total            # Failed queries
trino_query_duration_seconds        # Query execution time

# Memory usage
trino_memory_free_bytes             # Free memory
trino_memory_max_bytes              # Total memory
trino_memory_reserved_bytes         # Reserved memory

# Cluster coordination
trino_coordinator_exchanging_queued # Queued exchange fragments
trino_coordinator_splits_assigned   # Assigned splits
```

### Health Check Configuration

```python
async def check_trino():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://trino:8080/v1/info", timeout=5) as resp:
                return resp.status == 200
    except Exception as e:
        logger.error("trino_health_check_failed", error=str(e))
        return False

health_checker.register("trino", check_trino)
```

### Alerting Rules

```yaml
groups:
  - name: trino
    rules:
      - alert: TrinoHighQueryFailureRate
        expr: rate(trino_query_failed_total[5m]) / rate(trino_query_submitted_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: TrinoMemoryPressure
        expr: (trino_memory_reserved_bytes + trino_memory_free_bytes) / trino_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical

      - alert: TrinoSlowQueries
        expr: histogram_quantile(0.95, rate(trino_query_duration_seconds_bucket[5m])) > 30
        for: 10m
        labels:
          severity: warning

      - alert: TrinoCoordinatorUnresponsive
        expr: up{job="trino"} == 0
        for: 2m
        labels:
          severity: critical
```

## Redis Monitoring

### Redis Exporter

Use the official redis_exporter:

```bash
# Docker
docker run -d \
  --name redis_exporter \
  -p 9121:9121 \
  oliver006/redis_exporter \
  --redis-addr=redis://redis:6379

# Docker Compose
version: '3.8'
services:
  redis_exporter:
    image: oliver006/redis_exporter:latest
    environment:
      REDIS_ADDR: "redis://redis:6379"
    ports:
      - "9121:9121"
    depends_on:
      - redis
```

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Key Metrics to Monitor

```prometheus
# Connection health
redis_connected_clients            # Active client connections
redis_blocked_clients              # Blocked clients

# Memory usage
redis_used_memory_bytes            # Memory in use
redis_maxmemory_bytes              # Max memory limit
redis_evicted_keys_total           # Evicted keys

# Performance
redis_commands_processed_total     # Total commands
redis_keyspace_hits_total          # Cache hits
redis_keyspace_misses_total        # Cache misses
redis_avg_ttl_ms                   # Average TTL

# Replication
redis_role                         # master/slave role
redis_slave_offset                 # Replication offset
```

### Health Check Configuration

```python
import redis

redis_client = redis.AsyncRedis(host='redis', port=6379)

async def check_redis():
    try:
        await redis_client.ping()
        return True
    except Exception as e:
        logger.error("redis_health_check_failed", error=str(e))
        return False

health_checker.register("redis", check_redis)
```

### Alerting Rules

```yaml
groups:
  - name: redis
    rules:
      - alert: RedisMemoryExceeded
        expr: redis_used_memory_bytes >= redis_maxmemory_bytes * 0.9
        for: 5m
        labels:
          severity: warning

      - alert: RedisHighEvictionRate
        expr: rate(redis_evicted_keys_total[5m]) > 100
        for: 5m
        labels:
          severity: warning

      - alert: RedisCacheMissRateHigh
        expr: rate(redis_keyspace_misses_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) > 0.3
        for: 10m
        labels:
          severity: info

      - alert: RedisReplicationLag
        expr: redis_slave_offset < redis_master_repl_offset - 1000000
        for: 2m
        labels:
          severity: critical
```

## Composite Health Monitoring

Register all external services in your service's readiness probe:

```python
@app.on_event("startup")
async def register_health_checks():
    health_checker.register("postgres", check_postgres)
    health_checker.register("trino", check_trino)
    health_checker.register("redis", check_redis)
    health_checker.register("schema_service", lambda: check_http_endpoint("http://schema-service:8001/healthz"))

@app.get("/readyz")
async def readiness():
    """Service is ready only if all dependencies are healthy."""
    result = await health_checker.check_all()
    status = 200 if result.healthy else 503
    return result.to_dict(), status
```

## Multi-Service Monitoring Stack (docker-compose)

```yaml
version: '3.8'
services:
  # Actyze services
  nexus:
    image: actyze:latest
    ports:
      - "8002:8002"
    environment:
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
      TRINO_HOST: trino

  # Data services
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: actyze
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  trino:
    image: trinodb/trino:latest
    ports:
      - "8080:8080"

  # Monitoring exporters
  postgres_exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://postgres:postgres@postgres:5432/actyze?sslmode=disable"
    ports:
      - "9187:9187"

  redis_exporter:
    image: oliver006/redis_exporter
    command:
      - --redis-addr=redis://redis:6379
    ports:
      - "9121:9121"

  # Prometheus
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    command:
      - --config.file=/etc/prometheus/prometheus.yml

  # Grafana
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
```

### prometheus.yml for Multi-Service Monitoring

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'actyze-nexus'
    static_configs:
      - targets: ['localhost:8002']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'trino'
    static_configs:
      - targets: ['localhost:8989']
```

## Troubleshooting External Service Monitoring

```bash
# Check if exporter is reachable
curl http://localhost:9187/metrics | head -20

# Test database connection from Prometheus container
docker exec prometheus curl postgres_exporter:9187/probe

# View health check status in Prometheus UI
# Target: http://localhost:9090 -> Status -> Targets
```

## See Also

- [KUBERNETES.md](KUBERNETES.md) - Monitoring in Kubernetes environments
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [API-REFERENCE.md](API-REFERENCE.md) - Observability API reference
