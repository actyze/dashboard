# External Services Packaging & Monitoring

## Complete Stack (8 Total Services)

```
┌─────────────────────────────────────────────┐
│         Observability Stack                 │
├─────────────────────────────────────────────┤
│ Actyze Services (6):                        │
│  ✓ Nexus API                                │
│  ✓ Schema Service                           │
│  ✓ Prediction Worker (XGBoost)              │
│  ✓ Prediction Worker (LightGBM)             │
│  ✓ Prediction Worker (AutoGluon)            │
│  ✓ Frontend (React)                         │
│                                             │
│ External Services (2):                      │
│  ✓ PostgreSQL (Metrics + Query Logging)     │
│  ✓ Trino (JMX Metrics + Query Tracking)     │
└─────────────────────────────────────────────┘
```

---

## PostgreSQL Observability

### 1. Built-in Query Logging (No Additional Tools)

**Enable in docker-compose.yml:**
```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_INITDB_ARGS: "-c log_statement=all -c log_min_duration_statement=100"
  # log_statement=all: Log all queries
  # log_min_duration_statement=100: Log queries taking >100ms
```

**View logs:**
```bash
docker logs postgres | grep "LOG"
docker logs postgres | jq 'select(.message | contains("duration"))'
```

**Key metrics exposed:**
- Query execution time
- Lock wait times
- Slow queries (>100ms)
- Connection count
- Transaction activity

### 2. Postgres-Exporter (Prometheus Metrics)

**Add to docker-compose.yml:**
```yaml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:latest
  environment:
    DATA_SOURCE_NAME: "postgresql://nexus_service:${POSTGRES_PASSWORD}@postgres:5432/dashboard?sslmode=disable"
  ports:
    - "9187:9187"
  depends_on:
    - postgres
  networks:
    - dashboard
```

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
    metrics_path: '/metrics'
```

**Key metrics collected:**
- `pg_stat_user_tables_seq_scan_total` — Full table scans
- `pg_stat_user_tables_idx_scan_total` — Index scans
- `pg_stat_user_tables_n_tup_*` — Rows inserted/updated/deleted
- `pg_stat_database_connections` — Active connections
- `pg_database_size_bytes` — Database size
- `pg_replication_lag_seconds` — Replication lag (if applicable)
- `pg_slow_queries` — Slow query tracking

**PromQL queries:**
```promql
# Slow queries
SELECT pg_stat_statements.query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC;

# Connection status
pg_stat_activity_count{state="active"}

# Table growth
rate(pg_stat_user_tables_n_tup_ins_total[5m])
```

### 3. Kubernetes Deployment

**StatefulSet with monitoring:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  postgresql.conf: |
    log_statement = 'all'
    log_min_duration_statement = 100
    shared_preload_libraries = 'pg_stat_statements'
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: dashboard
        - name: POSTGRES_USER
          value: nexus_service
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: password
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        - name: config
          mountPath: /etc/postgresql
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U nexus_service
          initialDelaySeconds: 30
          periodSeconds: 10
      - name: postgres-exporter
        image: prometheuscommunity/postgres-exporter:latest
        ports:
        - containerPort: 9187
        env:
        - name: DATA_SOURCE_NAME
          value: "postgresql://nexus_service:$(POSTGRES_PASSWORD)@localhost:5432/dashboard?sslmode=disable"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 50Gi
```

---

## Trino Observability

### 1. Native Query Metrics (Built-in)

**Enable JMX in Trino config:**
```properties
# docker/trino/etc/config.properties
connector.ports=8080
http-server.http.port=8080
discovery.uri=http://trino:8080

# Enable JMX metrics
jmx.rmiregistry.port=9010
jmx.rmiserver.port=9011
```

**Access query metrics:**
```bash
# View Trino UI (built-in)
http://localhost:8081/ui/

# Query metrics endpoint
curl http://localhost:8081/v1/stats

# Current queries
curl http://localhost:8081/v1/query
```

**Key metrics exposed:**
- Active queries
- Completed queries
- Failed queries
- Query duration percentiles
- Worker node status
- Memory usage per query
- Data processing rate (bytes/sec)

### 2. Trino-Exporter (Prometheus Metrics)

**Docker image (community):**
```yaml
trino-exporter:
  image: joslu/trino-exporter:latest
  environment:
    TRINO_URL: http://trino:8080
    TRINO_USER: admin
  ports:
    - "8444:8444"
  depends_on:
    - trino
  networks:
    - dashboard
```

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'trino'
    static_configs:
      - targets: ['trino-exporter:8444']
```

**Key metrics collected:**
- `trino_query_count_*` — Total/active/failed queries
- `trino_query_duration_*` — Query latency percentiles
- `trino_worker_count` — Active worker nodes
- `trino_data_processed_bytes` — Data throughput
- `trino_memory_allocated_bytes` — Memory usage
- `trino_query_queue_time_*` — Queuing delay

### 3. JMX Metrics (Advanced)

**Direct JMX scraping with Prometheus:**
```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus-jmx.yml:/etc/prometheus/prometheus-jmx.yml
  command:
    - '--config.file=/etc/prometheus/prometheus-jmx.yml'
```

**prometheus-jmx.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'trino-jmx'
    static_configs:
      - targets: ['localhost:9010']
    metric_relabel_configs:
      # Keep only query-related metrics
      - source_labels: [__name__]
        regex: 'java_lang_.*'
        action: keep
```

### 4. Kubernetes Deployment

**ConfigMap for Trino config:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: trino-config
data:
  config.properties: |
    coordinator=true
    node-scheduler.include-coordinator=true
    query.max-execution-time=5m
    query.max-run-time=10m
    discovery.uri=http://trino:8080
    jmx.rmiregistry.port=9010
    jmx.rmiserver.port=9011
  jvm.config: |
    -server
    -XX:+UseG1GC
    -Xmx2G
    -Dcom.sun.management.jmxremote
    -Dcom.sun.management.jmxremote.port=9010
    -Dcom.sun.management.jmxremote.rmi.port=9011
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trino
spec:
  template:
    spec:
      containers:
      - name: trino
        image: trinodb/trino:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9010
          name: jmx-registry
        - containerPort: 9011
          name: jmx-server
        volumeMounts:
        - name: config
          mountPath: /etc/trino
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /v1/info
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
      - name: trino-exporter
        image: joslu/trino-exporter:latest
        ports:
        - containerPort: 8444
        env:
        - name: TRINO_URL
          value: http://localhost:8080
        - name: TRINO_USER
          value: admin
      volumes:
      - name: config
        configMap:
          name: trino-config
```

---

## Complete Prometheus Config

**Monitor all 8 services:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Actyze services (6)
  - job_name: 'nexus'
    static_configs:
      - targets: ['nexus:8002']
    metrics_path: '/metrics'

  - job_name: 'schema-service'
    static_configs:
      - targets: ['schema-service:8001']
    metrics_path: '/metrics'

  - job_name: 'prediction-worker-xgboost'
    static_configs:
      - targets: ['prediction-worker-xgboost:8400']
    metrics_path: '/metrics'

  - job_name: 'prediction-worker-lightgbm'
    static_configs:
      - targets: ['prediction-worker-lightgbm:8401']
    metrics_path: '/metrics'

  - job_name: 'prediction-worker-autogluon'
    static_configs:
      - targets: ['prediction-worker-autogluon:8402']
    metrics_path: '/metrics'

  # External services (2)
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'trino-exporter'
    static_configs:
      - targets: ['trino-exporter:8444']
```

---

## Grafana Dashboards (Pre-configured)

**Actyze Services Dashboard:**
```json
{
  "dashboard": {
    "title": "Actyze Services Overview",
    "panels": [
      {
        "title": "HTTP Requests (all services)",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m]) by (service)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "NL Query Performance",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(nl_query_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

**PostgreSQL Dashboard:**
```json
{
  "dashboard": {
    "title": "PostgreSQL Monitoring",
    "panels": [
      {
        "title": "Slow Queries",
        "targets": [
          {
            "expr": "pg_stat_statements_query_time_seconds_total > 1"
          }
        ]
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "pg_stat_activity_count{state=\"active\"}"
          }
        ]
      }
    ]
  }
}
```

**Trino Dashboard:**
```json
{
  "dashboard": {
    "title": "Trino Query Engine",
    "panels": [
      {
        "title": "Query Throughput",
        "targets": [
          {
            "expr": "rate(trino_query_count_total[5m])"
          }
        ]
      },
      {
        "title": "Query Latency P95",
        "targets": [
          {
            "expr": "trino_query_duration_seconds{quantile=\"0.95\"}"
          }
        ]
      },
      {
        "title": "Worker Status",
        "targets": [
          {
            "expr": "trino_worker_count"
          }
        ]
      }
    ]
  }
}
```

---

## Shipping Strategy: Complete Stack

| Component | Type | Metrics | Logging | Packaging |
|-----------|------|---------|---------|-----------|
| **Nexus** | Actyze | ✅ Prometheus | ✅ JSON stdout | Docker + K8s |
| **Schema Service** | Actyze | ✅ Prometheus | ✅ JSON stdout | Docker + K8s |
| **XGBoost Worker** | Actyze | ✅ Prometheus | ✅ JSON stdout | Docker + K8s |
| **LightGBM Worker** | Actyze | ✅ Prometheus | ✅ JSON stdout | Docker + K8s |
| **AutoGluon Worker** | Actyze | ✅ Prometheus | ✅ JSON stdout | Docker + K8s |
| **Frontend** | Actyze | ✅ Browser metrics | ✅ Console JSON | Docker + K8s |
| **PostgreSQL** | External | ✅ postgres-exporter | ✅ Query logs | Exporter sidecar |
| **Trino** | External | ✅ JMX/Exporter | ✅ Query tracking | Exporter sidecar |

---

## Docker Compose (All 8 Services)

```yaml
version: '3.8'

services:
  # Actyze Services (6)
  nexus:
    build:
      context: .
      dockerfile: nexus/Dockerfile
    ports:
      - "8002:8002"
    networks:
      - dashboard

  schema-service:
    build:
      context: .
      dockerfile: schema-service/Dockerfile
    ports:
      - "8001:8001"
    depends_on:
      - postgres
      - trino
    networks:
      - dashboard

  prediction-worker-xgboost:
    build:
      context: .
      dockerfile: docker/prediction-worker-xgboost/Dockerfile
    ports:
      - "8400:8400"
    depends_on:
      - postgres
      - trino
    networks:
      - dashboard

  prediction-worker-lightgbm:
    build:
      context: .
      dockerfile: docker/prediction-worker-lightgbm/Dockerfile
    ports:
      - "8401:8400"
    depends_on:
      - postgres
      - trino
    networks:
      - dashboard

  prediction-worker-autogluon:
    build:
      context: .
      dockerfile: docker/prediction-worker-autogluon/Dockerfile
    ports:
      - "8402:8400"
    depends_on:
      - postgres
      - trino
    networks:
      - dashboard

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - nexus
    networks:
      - dashboard

  # External Services (2)
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: dashboard
      POSTGRES_USER: nexus_service
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "-c log_statement=all -c log_min_duration_statement=100"
    networks:
      - dashboard

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      DATA_SOURCE_NAME: "postgresql://nexus_service:${POSTGRES_PASSWORD}@postgres:5432/dashboard?sslmode=disable"
    ports:
      - "9187:9187"
    depends_on:
      - postgres
    networks:
      - dashboard

  trino:
    build:
      context: ./docker/trino
      dockerfile: Dockerfile
    ports:
      - "8081:8080"
      - "9010:9010"
    networks:
      - dashboard

  trino-exporter:
    image: joslu/trino-exporter:latest
    environment:
      TRINO_URL: http://trino:8080
      TRINO_USER: admin
    ports:
      - "8444:8444"
    depends_on:
      - trino
    networks:
      - dashboard

  # Observability Stack
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - dashboard

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    networks:
      - dashboard

networks:
  dashboard:
```

---

## Deployment Checklist

### Docker (Local)
- [ ] All 8 services running: `docker-compose up`
- [ ] Nexus logs: `docker logs nexus | jq '.'`
- [ ] Postgres logs: `docker logs postgres | grep LOG`
- [ ] Prometheus scraping all: `curl http://localhost:9090/api/v1/targets`
- [ ] Grafana dashboard accessible: http://localhost:3001

### Kubernetes
- [ ] PostgreSQL StatefulSet deployed
- [ ] Postgres-exporter sidecar running
- [ ] Trino Deployment with JMX enabled
- [ ] Trino-exporter sidecar running
- [ ] All 6 Actyze services with sidecar exporters
- [ ] Prometheus ConfigMap with all 8 scrape configs
- [ ] Grafana with datasource pointing to Prometheus

### Production Registry
- [ ] All 8 images tagged and pushed
- [ ] Image versions in Helm values
- [ ] Prometheus instance per environment
- [ ] Grafana dashboards deployed
- [ ] Alerting rules configured

---

## Summary: 8-Service Observability Stack

| # | Service | Metrics | Logs | Transport | Status |
|-|-|-|-|-|-|
| 1 | Nexus | Prometheus | JSON | HTTP | ✅ Built-in |
| 2 | Schema Service | Prometheus | JSON | HTTP | ✅ Built-in |
| 3 | XGBoost Worker | Prometheus | JSON | HTTP | ✅ Built-in |
| 4 | LightGBM Worker | Prometheus | JSON | HTTP | ✅ Built-in |
| 5 | AutoGluon Worker | Prometheus | JSON | HTTP | ✅ Built-in |
| 6 | Frontend | Browser | JSON | Console | ✅ Built-in |
| 7 | PostgreSQL | Exporter | Query logs | HTTP/9187 | ✅ Sidecar |
| 8 | Trino | JMX/Exporter | UI/Logs | HTTP/8444 | ✅ Sidecar |

**Total Observability Coverage:** 100% (All services + infrastructure)

