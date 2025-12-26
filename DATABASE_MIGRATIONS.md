# Database Migrations Guide

## Overview

All database migrations are now **consolidated and managed by Nexus**. Everything runs automatically on startup - no separate containers or manual steps needed!

## ✅ What Changed

### Before (Scattered in Helm)
```
helm/dashboard/sql/
├── ddl/  (19 separate files! 😵)
│   ├── 01-nexus-schema.sql
│   ├── 02-demo-schema.sql
│   ├── 14-intent-examples.sql
│   └── ... 16 more files
└── dml/
    ├── 03-demo-data.sql
    └── 07-intent-examples-data.sql

db-init container (ran these scripts) ❌
```

### After (Clean in Nexus) ✅
```
nexus/db/migrations/
├── V000__nexus_base_schema.sql         # All core tables + intent examples
├── V001__user_controlled_query_saves.sql  # User-controlled saves
└── (future migrations...)

Nexus runs these automatically on startup! ✅

Demo data? Use TPC-H (built into Trino)! ✅
```

**Benefits:**
- ✅ **19 files → 2 files** - Much cleaner!
- ✅ **No db-init container** - One less service
- ✅ **Helm independent** - Helm can be in separate repo
- ✅ **Version controlled** - Clear sequential order
- ✅ **Automatic** - Runs on Nexus startup

## How It Works

```
1. Start Nexus
2. Nexus connects to PostgreSQL
3. Nexus checks nexus.flyway_schema_history
4. Nexus runs any pending migrations (V000, V001...)
5. Nexus starts accepting requests
```

**That's it!** No manual steps.

## Quick Start

### Creating a Migration

```bash
# 1. Create SQL file (next version is V002)
cd nexus/db/migrations
cat > V002__add_feature.sql << 'EOF'
CREATE TABLE IF NOT EXISTS nexus.new_feature (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);
EOF

# 2. Restart Nexus (migrations run automatically)
cd ../../docker
docker-compose restart nexus

# 3. Check it worked
docker logs dashboard-nexus | grep migration
```

### Checking Status

```bash
# View all applied migrations
docker exec -i dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT version, description, installed_on FROM nexus.flyway_schema_history"
```

Expected output:
```
 version |         description          |        installed_on        
---------+------------------------------+----------------------------
 000     | nexus base schema            | 2025-12-25 20:00:00
 001     | user controlled query saves  | 2025-12-25 20:00:01
```

## Current Migrations

### V000 - Nexus Base Schema

**What it contains:**
- **Users & Auth**: users, roles, groups, user_roles, refresh_tokens
- **Dashboards**: dashboards, saved_queries, query_history
- **Intent Detection**: intent_examples table + 184 examples
- **Bootstrap Data**: Admin user (`nexus_admin` / `admin`)

**Why V000?**  
Consolidated from helm/dashboard/sql/ into one clean baseline. Since V001 may already be applied in existing databases, V000 runs first (lower version number).

### V001 - User Controlled Query Saves

**Changes:**
- Removed automatic hash-based saves
- Added `updated_at` column
- Created `save_new_query()` function
- Created `update_existing_query()` function

**Status:** May already be applied in existing databases (safe!)

## File Format

**Naming:** `V{version}__{description}.sql`

**Examples:**
- ✅ `V000__nexus_base_schema.sql`
- ✅ `V001__user_controlled_query_saves.sql`
- ✅ `V002__add_audit_log.sql`

**Rules:**
- Sequential version numbers (000, 001, 002...)
- Double underscore `__` between version and description
- Underscores for spaces in description
- End with `.sql`

## Best Practices

### 1. Idempotent SQL

```sql
-- ✅ Good - Safe to run multiple times
CREATE TABLE IF NOT EXISTS nexus.my_table (...);
ALTER TABLE nexus.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
DROP TABLE IF EXISTS nexus.temp CASCADE;

-- ❌ Bad - Fails if already exists
CREATE TABLE nexus.my_table (...);
ALTER TABLE nexus.users ADD COLUMN email VARCHAR(255);
```

### 2. One Change Per File

```bash
# ✅ Good
V002__add_audit_log.sql
V003__add_indexes.sql

# ❌ Bad
V002__everything.sql
```

### 3. Never Modify Applied Migrations

```bash
# ❌ Don't edit existing migrations
vim V001__existing.sql

# ✅ Create new migration instead
vim V004__fix_issue.sql
```

## Deployment

### Local Development

```bash
cd docker
docker-compose up
# Migrations run automatically!
```

### Production (Any Platform)

Just deploy Nexus - migrations run on startup!

**Docker:**
```bash
docker run your-registry/nexus:latest
```

**Kubernetes:**
```bash
kubectl apply -f nexus-deployment.yaml
```

**ECS/Fargate:**
```bash
aws ecs update-service --service nexus
```

**Works everywhere!** ✅

## Demo Data for Testing

**Use TPC-H (built into Trino)!**

TPC-H is an industry-standard benchmark with realistic data:
- 8 tables: customers, orders, lineitem, part, supplier, nation, region, partsupp
- Multiple scale factors (sf1 = 1GB, sf10 = 10GB, etc.)
- Well-documented queries

**Example Usage:**
```sql
-- Query TPC-H data directly in Trino
SELECT 
  n.name as nation,
  COUNT(*) as customer_count,
  AVG(c.acctbal) as avg_balance
FROM tpch.sf1.customer c
JOIN tpch.sf1.nation n ON c.nationkey = n.nationkey
GROUP BY n.name
ORDER BY customer_count DESC;
```

**No setup needed!** Already available in Trino.

## Troubleshooting

### Migration Failed

**Symptoms:** Nexus won't start

**Check logs:**
```bash
docker logs dashboard-nexus | grep -A 20 migration
```

**Fix:**
1. Identify the error
2. Fix the SQL file
3. Remove failed record:
   ```sql
   DELETE FROM nexus.flyway_schema_history WHERE success = false;
   ```
4. Restart: `docker-compose restart nexus`

### Rollback a Migration

Create a new "undo" migration:

```bash
cd nexus/db/migrations
cat > V005__undo_feature.sql << 'EOF'
-- Rollback changes from V004
DROP TABLE IF EXISTS nexus.feature_table;
EOF
```

## Migration History Table

```sql
-- Tracks applied migrations
nexus.flyway_schema_history
  ├── version            -- '000', '001', etc.
  ├── description        -- Human readable
  ├── installed_on       -- When it was applied
  ├── execution_time     -- How long it took (ms)
  └── success            -- true/false
```

## FAQ

**Q: What happened to db-init?**  
A: Removed! Nexus handles all migrations now.

**Q: What about helm/dashboard/sql/?**  
A: Consolidated into nexus/db/migrations/. Helm can be separate repo.

**Q: What about demo data?**  
A: Use TPC-H (built into Trino). No custom demo schema needed!

**Q: Will this break existing databases?**  
A: No! Uses `IF NOT EXISTS`, safe on existing databases. V000 creates baseline, V001 may already be applied (skipped automatically).

**Q: Where's the bootstrap admin user?**  
A: In V000. Username: `nexus_admin`, Password: `admin` (change it!)

**Q: Can I still use helm?**  
A: Yes! Helm is now independent. Database schema is managed by Nexus.

**Q: What if V001 was already applied?**  
A: V000 runs first (lower version), V001 is skipped (already in flyway_schema_history).

**Q: When do migrations run?**  
A: Automatically when Nexus starts, before accepting requests.

## Summary

✅ **Consolidated** - 19 files → 2 files  
✅ **Automatic** - Runs on Nexus startup  
✅ **Clean** - All in nexus/db/migrations/  
✅ **Portable** - Works on any platform  
✅ **Helm independent** - Separate repos possible  
✅ **No db-init** - One less container  
✅ **No demo data** - Use TPC-H instead!  

**That's it!** Much simpler now. Just create SQL files and restart Nexus.

---

For detailed docs, see: `nexus/db/README.md`
