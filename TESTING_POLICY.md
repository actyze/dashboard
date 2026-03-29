# Testing Policy — Tile Cache & Refresh Feature

## Environment Setup

```bash
cd docker/
./start.sh --profile local
```

- **Frontend:** http://localhost:3000
- **Nexus API:** http://localhost:8000
- **Login:** Use the admin credentials you configured during setup

---

## Pre-flight Checks

Before testing, verify the migration ran:

```sql
-- Connect to PostgreSQL (localhost:5432)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'nexus' AND table_name IN ('tile_cache', 'refresh_jobs');
```

Verify the refresh API is registered:

```bash
curl -s http://localhost:8000/docs | grep -o 'refresh'
# or visit http://localhost:8000/docs and look for /api/refresh/* routes
```

---

## Test Scenarios

### 1. First-Time Tile Load (Live → Cache Write-Through)

**Steps:**
1. Log in as `your_admin_user`
2. Create a new dashboard
3. Add a new SQL tile with a simple query (e.g., `SELECT 1 AS value, 'hello' AS label`)
4. Observe tile renders immediately with live Trino result (no "No data yet" spinner)

**Verify:**
- Tile shows data right after creation (not a pending/empty state)
- Check cache was written:
  ```bash
  curl -H "Authorization: Bearer <token>" \
    http://localhost:8000/api/refresh/tile/<tile_id>/cache
  ```
  Should return `cache_hit: true`

**Expected:** Data appears instantly from live query. Background cache is populated silently.

---

### 2. Subsequent Dashboard Load (Cache-First)

**Steps:**
1. After test 1, navigate away from the dashboard
2. Navigate back to the same dashboard

**Verify:**
- Tile loads instantly from cache (no Trino spinner)
- Tile shows a "cached" (green) badge
- No Trino queries fired (check nexus logs: `docker-compose logs -f nexus`)

**Expected:** Instant load from cache. No live Trino call.

---

### 3. Tile Edit → Live Re-execution

**Steps:**
1. Edit an existing tile's SQL (e.g., change `SELECT 1` to `SELECT 42 AS value, 'world' AS label`)
2. Save the tile

**Verify:**
- Old data clears
- Tile shows loading spinner briefly
- New live result appears immediately (shows `42`, not `1`)
- Cache is invalidated then re-populated:
  ```bash
  curl -H "Authorization: Bearer <token>" \
    http://localhost:8000/api/refresh/tile/<tile_id>/cache
  ```
  Should show the updated query results

**Expected:** Live execution with updated SQL, result cached immediately.

---

### 4. Stale Cache → Background Refresh

**Steps:**
1. Create a tile with a short refresh interval (e.g., 15 minutes)
2. Wait for the cache TTL to expire (or manually update `expires_at` in DB):
   ```sql
   UPDATE nexus.tile_cache SET expires_at = NOW() - INTERVAL '1 minute'
   WHERE tile_id = '<tile_id>';
   ```
3. Reload the dashboard

**Verify:**
- Stale data renders immediately with a "stale" (yellow) badge
- Background refresh is auto-enqueued
- After refresh completes, badge updates to "cached" (green)

**Expected:** Stale data shown instantly, background refresh silently updates it.

---

### 5. Manual Refresh (Single Tile)

**Steps:**
1. Click the 3-dot menu on a tile → "Refresh"

**Verify:**
- Tile shows a loading spinner
- After job completes, tile re-renders from fresh cache
- Spinner disappears

**Expected:** Manual refresh enqueues a job, polls until done, reloads from cache.

---

### 6. Manual Refresh (Full Dashboard)

**Steps:**
1. Click the "Refresh All" button in the action bar

**Verify:**
- Action bar shows progress ("Refreshing tiles... 2/5")
- All tiles reload from fresh cache when done
- Progress indicator disappears

**Expected:** Dashboard-level refresh fans out to per-tile jobs.

---

### 7. Multi-Pod Job Distribution (Advanced)

**Steps:**
1. Scale nexus to 2+ replicas:
   ```bash
   docker-compose up -d --scale nexus=2
   ```
2. Create a dashboard with 5+ tiles
3. Trigger a full dashboard refresh

**Verify:**
- Check logs of both nexus containers — jobs should be split across pods
- No duplicate tile executions (SKIP LOCKED ensures exclusivity)

---

### 8. Crash Recovery

**Steps:**
1. Trigger a dashboard refresh
2. While jobs are `running`, kill the nexus container:
   ```bash
   docker-compose kill nexus
   ```
3. Restart nexus:
   ```bash
   docker-compose up -d nexus
   ```

**Verify:**
- Check nexus startup logs for "Recovering stuck jobs"
- Stuck `running` jobs reset to `pending`
- Jobs re-process successfully

---

### 9. Error Handling — Failed Tile Query

**Steps:**
1. Create a tile with invalid SQL (e.g., `SELECT * FROM nonexistent_table`)

**Verify:**
- Tile shows an error message (not an infinite spinner)
- Error message is descriptive
- Other tiles are unaffected
- Cache stores the error state:
  ```bash
  curl http://localhost:8000/api/refresh/tile/<tile_id>/cache
  ```
  Should show `refresh_status: "failed"` or no cache entry

---

### 10. Public Dashboard (Read-Only)

**Steps:**
1. Share a dashboard as public
2. Open the public URL in an incognito browser

**Verify:**
- Cached tiles render from cache
- No refresh is auto-enqueued (public viewers shouldn't trigger Trino)
- No "Refresh" buttons visible

---

## API Smoke Tests

Run these against `http://localhost:8000` with a valid auth token:

```bash
TOKEN="<your_jwt_token>"
DASH_ID="<dashboard_id>"
TILE_ID="<tile_id>"

# 1. Cache status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/refresh/dashboard/$DASH_ID/cache-status"

# 2. Trigger dashboard refresh
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/refresh/dashboard/$DASH_ID"

# 3. Get tile cache
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/refresh/tile/$TILE_ID/cache"

# 4. Write-through cache
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dashboard_id":"'$DASH_ID'","sql_query":"SELECT 1","query_results":{"columns":["v"],"rows":[[1]]},"execution_time":0.1}' \
  "http://localhost:8000/api/refresh/tile/$TILE_ID/cache"

# 5. Invalidate cache
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/refresh/tile/$TILE_ID/invalidate"

# 6. List recent jobs
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/refresh/jobs"
```

---

## Regression Checklist

- [ ] Existing dashboards with no cache load tiles live (not blank)
- [ ] New tiles show data immediately after creation
- [ ] Edited tiles re-execute with updated SQL
- [ ] Stale cache shows data with stale badge, auto-refreshes
- [ ] Manual single-tile refresh works
- [ ] Manual full-dashboard refresh works with progress
- [ ] Public dashboards render cached data without triggering refresh
- [ ] Tile deletion cleans up properly (no orphaned data in UI)
- [ ] Dashboard export (PDF/PNG) works with cached tile data
- [ ] Query Explorer (non-dashboard) queries are unaffected by caching
