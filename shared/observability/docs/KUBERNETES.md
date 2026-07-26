# Kubernetes Observability

This document describes observability configuration for Actyze services running on Kubernetes.

## Health Probes

Kubernetes uses health probes to manage pod lifecycle and traffic routing.

### Liveness Probe (`/healthz`)

Determines if a pod should be restarted. Kubernetes restarts the pod if liveness fails.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nexus
spec:
  containers:
  - name: nexus
    image: actyze:latest
    ports:
    - containerPort: 8002
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8002
        scheme: HTTP
      initialDelaySeconds: 30    # Wait before first check
      periodSeconds: 10          # Check every 10 seconds
      timeoutSeconds: 5          # Max 5 seconds per check
      failureThreshold: 3        # Restart after 3 failures
      successThreshold: 1        # Single success = alive
```

### Readiness Probe (`/readyz`)

Determines if a pod is ready to receive traffic. Kubernetes removes unready pods from service load balancers.

```yaml
readinessProbe:
  httpGet:
    path: /readyz
    port: 8002
    scheme: HTTP
  initialDelaySeconds: 15        # Wait before first check
  periodSeconds: 5               # Check every 5 seconds
  timeoutSeconds: 5              # Max 5 seconds per check
  failureThreshold: 2            # Remove from LB after 2 failures
  successThreshold: 1            # Single success = ready
```

### Startup Probe (for slow-starting services)

For services that take >30 seconds to initialize:

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8002
  periodSeconds: 10
  failureThreshold: 30           # Allow up to 5 minutes (30 * 10s)
```

### Complete Health Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nexus
spec:
  containers:
  - name: nexus
    image: actyze:latest
    ports:
    - containerPort: 8002
      name: http

    # Liveness: is the process alive?
    livenessProbe:
      httpGet:
        path: /healthz
        port: http
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3

    # Readiness: is the service initialized and ready?
    readinessProbe:
      httpGet:
        path: /readyz
        port: http
      initialDelaySeconds: 15
      periodSeconds: 5
      timeoutSeconds: 5
      failureThreshold: 2

    # Startup: allow time for initialization
    startupProbe:
      httpGet:
        path: /healthz
        port: http
      periodSeconds: 10
      failureThreshold: 30
```

## Metrics Collection with Prometheus

### Prometheus ServiceMonitor (using Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: actyze
  namespace: actyze
spec:
  selector:
    matchLabels:
      app: actyze
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    relabelings:
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod
    - sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: namespace
```

### Prometheus Scrape Job (without Operator)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: actyze-metrics
  labels:
    app: actyze
spec:
  selector:
    app: actyze
  ports:
  - name: metrics
    port: 8002
    targetPort: 8002
---
# In prometheus.yml
global:
  scrape_interval: 30s
scrape_configs:
- job_name: actyze
  kubernetes_sd_configs:
  - role: pod
    namespaces:
      names:
      - actyze
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_label_app]
    action: keep
    regex: actyze
  - source_labels: [__meta_kubernetes_pod_name]
    target_label: pod
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
```

## Log Collection and Routing

### Fluent Bit DaemonSet Configuration

Deploy Fluent Bit to collect logs from all pod stdout:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: actyze
data:
  fluent-bit.conf: |
    [SERVICE]
        Daemon Off
        Flush 1
        Log_Level info
        Parsers_File parsers.conf

    [INPUT]
        Name tail
        Path /var/log/containers/actyze_*.log
        Parser docker
        Tag actyze.*
        Refresh_Interval 5
        Mem_Buf_Limit 50MB
        Skip_Long_Lines On

    [FILTER]
        Name parser
        Match actyze.*
        Key_Name log
        Parser json
        Reserve_Data On

    [FILTER]
        Name kubernetes
        Match actyze.*
        Kube_URL https://kubernetes.default.svc:443
        Kube_CA_File /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix actyze.

    [OUTPUT]
        Name stdout
        Match *
        Format json_lines

    # Optional: Send to Loki
    # [OUTPUT]
    #     Name loki
    #     Match actyze.*
    #     Host loki
    #     Port 3100
    #     Labels job=actyze, namespace=$namespace, pod=$pod_name
    #     Auto_Kubernetes_Labels on

  parsers.conf: |
    [PARSER]
        Name docker
        Format json
        Time_Key time
        Time_Format %Y-%m-%dT%H:%M:%S.%L%z
        Time_Keep On

    [PARSER]
        Name json
        Format json
        Time_Key timestamp
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: actyze
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    metadata:
      labels:
        app: fluent-bit
    spec:
      serviceAccountName: fluent-bit
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:2.1
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: config
          mountPath: /fluent-bit/etc/
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: config
        configMap:
          name: fluent-bit-config
```

### Fluent Bit RBAC

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fluent-bit
  namespace: actyze

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fluent-bit
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: fluent-bit
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: fluent-bit
subjects:
- kind: ServiceAccount
  name: fluent-bit
  namespace: actyze
```

### Loki Stack (Log Aggregation)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: actyze
data:
  loki-config.yaml: |
    auth_enabled: false
    
    ingester:
      chunk_idle_period: 3m
      max_chunk_age: 1h
      max_streams_per_user: 10000
      chunk_retain_period: 1m
      max_chunk_retention_period: 5m
      lifecycler:
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
    
    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
    
    schema_config:
      configs:
      - from: 2020-10-24
        store: boltdb-shipper
        object_store: filesystem
        schema: v11
        index:
          prefix: index_
          period: 24h
    
    server:
      http_listen_port: 3100
      log_level: info
    
    storage_config:
      boltdb_shipper:
        active_index_directory: /loki/boltdb-shipper-active
        cache_location: /loki/boltdb-shipper-cache
        shared_store: filesystem
      filesystem:
        directory: /loki/chunks

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: actyze
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:2.9.0
        ports:
        - containerPort: 3100
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: storage
          mountPath: /loki
      volumes:
      - name: config
        configMap:
          name: loki-config
      - name: storage
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: actyze
spec:
  selector:
    app: loki
  ports:
  - port: 3100
    targetPort: 3100
```

### Prometheus + Loki ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: actyze-rules
  namespace: actyze
spec:
  groups:
  - name: actyze
    interval: 30s
    rules:
    # Alert on high error rate
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value | humanizePercentage }}"

    # Alert on slow queries
    - alert: SlowQueries
      expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 10
      for: 10m
      annotations:
        summary: "Slow query latency"
        description: "p95 latency is {{ $value | humanizeDuration }}"

    # Alert on prediction worker degradation
    - alert: PredictionWorkerDegraded
      expr: service_health_status{service=~"prediction_worker_.*"} == 0
      for: 2m
      annotations:
        summary: "Prediction worker {{ $labels.service }} unhealthy"

    # Alert on LLM token consumption spike
    - alert: LLMTokenConsumptionSpike
      expr: rate(llm_tokens_total[5m]) > 10000
      for: 5m
      annotations:
        summary: "High LLM token consumption"
        description: "Token rate is {{ $value | humanize }} tokens/sec"
```

## Complete Kubernetes Deployment

```yaml
---
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: actyze

---
# ConfigMap for service environment
apiVersion: v1
kind: ConfigMap
metadata:
  name: actyze-config
  namespace: actyze
data:
  LOG_LEVEL: "INFO"
  LOG_FORMAT: "json"
  POSTGRES_HOST: "postgres.actyze.svc.cluster.local"

---
# Secret for credentials (use in production with sealed-secrets or external-secrets)
apiVersion: v1
kind: Secret
metadata:
  name: actyze-secrets
  namespace: actyze
type: Opaque
stringData:
  POSTGRES_PASSWORD: "changeme"
  REDIS_PASSWORD: "changeme"
  TRINO_PASSWORD: "changeme"

---
# Nexus Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexus
  namespace: actyze
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: nexus
  template:
    metadata:
      labels:
        app: nexus
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8002"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: nexus
        image: actyze:latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8002

        env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: actyze-config
              key: LOG_LEVEL
        - name: LOG_FORMAT
          valueFrom:
            configMapKeyRef:
              name: actyze-config
              key: LOG_FORMAT
        - name: POSTGRES_HOST
          valueFrom:
            configMapKeyRef:
              name: actyze-config
              key: POSTGRES_HOST
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: actyze-secrets
              key: POSTGRES_PASSWORD
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: actyze-secrets
              key: REDIS_PASSWORD

        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"

        # Liveness probe
        livenessProbe:
          httpGet:
            path: /healthz
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness probe
        readinessProbe:
          httpGet:
            path: /readyz
            port: http
          initialDelaySeconds: 15
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 2

        # Startup probe for longer initialization
        startupProbe:
          httpGet:
            path: /healthz
            port: http
          periodSeconds: 10
          failureThreshold: 30

---
# Nexus Service
apiVersion: v1
kind: Service
metadata:
  name: nexus
  namespace: actyze
  labels:
    app: nexus
spec:
  selector:
    app: nexus
  ports:
  - name: http
    port: 8002
    targetPort: 8002
  type: LoadBalancer

---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nexus-hpa
  namespace: actyze
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nexus
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Health Probe Troubleshooting

```bash
# Check pod status
kubectl get pods -n actyze -o wide
kubectl describe pod nexus -n actyze

# View probe events
kubectl logs -n actyze nexus --previous  # if pod was restarted

# Test health endpoints locally
kubectl port-forward -n actyze svc/nexus 8002:8002
curl http://localhost:8002/healthz
curl http://localhost:8002/readyz
curl http://localhost:8002/metrics

# Check probe configuration
kubectl get pods -n actyze nexus -o jsonpath='{.spec.containers[0].livenessProbe}'
```

## Production Best Practices

1. **Probe Configuration**:
   - Set `initialDelaySeconds` based on your service startup time
   - Use low `periodSeconds` (5-10s) for readiness probes
   - Set `timeoutSeconds` lower than probe period
   - Adjust `failureThreshold` based on tolerance for transient failures

2. **Resource Requests/Limits**:
   - Set CPU and memory requests for proper scheduling
   - Set limits to prevent resource exhaustion
   - Use HPA to scale based on metrics

3. **Log Routing**:
   - Use Fluent Bit DaemonSet for log collection
   - Forward to Loki for log aggregation and querying
   - Index by pod name, namespace, and service for searchability

4. **Monitoring**:
   - Use Prometheus Operator for ServiceMonitor configuration
   - Set up PrometheusRule for alerting
   - Monitor both application and infrastructure metrics

5. **Graceful Shutdown**:
   - Set `terminationGracePeriodSeconds` to allow cleanup
   - Return 503 from readiness probe during graceful shutdown

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md) - Database and Trino monitoring
- [API-REFERENCE.md](API-REFERENCE.md) - Observability API reference
