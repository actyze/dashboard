# Start Docker & Services (Mac)

## Step 1: Start Docker Desktop

**On Mac:**
1. Open **Spotlight Search** (⌘ + Space)
2. Type "Docker"
3. Click "Docker.app" to launch
4. Wait for Docker icon to appear in menu bar (≈30 seconds)

**Or from Terminal:**
```bash
open /Applications/Docker.app
```

**Verify Docker is running:**
```bash
docker ps
# Should show: CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS
# (not an error about daemon)
```

---

## Step 2: Start All Services

**Once Docker is running:**

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard/docker

# Start everything
./start.sh

# Expected output (takes 30-60 seconds):
# 🚀 Starting Dashboard Local Development Environment...
# 📦 Starting services with profile: local
# 🔨 Building images locally...
# ⏳ Waiting for services to be healthy...
# ✅ Dashboard is ready!
```

---

## Step 3: Verify Services Are Up

**In a new terminal:**

```bash
docker ps

# Should show containers like:
# CONTAINER ID   IMAGE              COMMAND                  STATUS
# abc123...      nexus:latest       "python main.py"         Up 2 minutes
# def456...      schema:latest      "python schema_..."      Up 2 minutes
# ghi789...      postgres:15        "docker-entrypoint"      Up 2 minutes
```

---

## Step 4: Test Observability (While Running)

**In another terminal:**

```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard

# Quick health check
curl http://localhost:8000/healthz | jq .

# If this works, all tests should work:
curl http://localhost:8001/healthz | jq .
curl http://localhost:8000/metrics | head -5
curl http://localhost:9090/api/v1/targets | jq .data.activeTargets
```

---

## Troubleshooting

**Docker still won't start:**
```bash
# Check if Docker process exists
ps aux | grep Docker

# Check system requirements
system_profiler SPSoftwareDataType | grep "System Version"

# Restart Docker
pkill Docker
sleep 5
open /Applications/Docker.app
```

**Services won't start after Docker is running:**
```bash
# Check Docker is really running
docker info

# Try again
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard/docker
./start.sh --no-build  # Skip rebuild, use existing images

# If error about ports in use
./stop.sh --clean
sleep 10
./start.sh
```

**Port conflicts:**
```bash
# Check what's using port 8000
lsof -i :8000

# Kill it or use different profile
./stop.sh
./start.sh --profile postgres-only
```

---

## Expected Timeline

| Step | Time | Action |
|------|------|--------|
| 1 | 0:00 | Open Docker.app |
| 2 | 0:30 | Docker daemon starts |
| 3 | 0:45 | Run `./start.sh` |
| 4 | 1:30 | Services building |
| 5 | 3:00 | "Dashboard is ready!" ✅ |
| 6 | 3:10 | Test health probes |
| 7 | 3:20 | All tests passing ✅ |

---

## Visual Checklist

```
□ Docker.app open (icon in menu bar)
  
□ Terminal: docker ps (shows containers)

□ Terminal: ./start.sh (from docker/ folder)
  
□ See: "✅ Dashboard is ready!"
  
□ New Terminal: curl http://localhost:8000/healthz | jq .
  
□ See: {"status":"alive",...}
  
□ Run full observability tests
  
□ All tests passing ✅
```

---

## When Everything is Running

**Access:**
- Frontend: http://localhost:3000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Nexus API: http://localhost:8000 (health: /healthz, metrics: /metrics)
- Schema Service: http://localhost:8001 (same endpoints)

**Stop everything:**
```bash
cd /Users/rohitmangal/Documents/Actyze\ Content/dashboard/docker
./stop.sh
```

