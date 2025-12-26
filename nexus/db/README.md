# Database Migrations

All database migrations are managed by Nexus and run automatically on startup.

## Directory Structure

```
db/
├── migrations/                              # SQL migration files (run automatically)
│   ├── V000__nexus_base_schema.sql         # Base schema (users, dashboards, intent_examples)
│   └── V001__user_controlled_query_saves.sql  # User-controlled query saves
└── README.md                               # This file
```

## How It Works

**On Nexus Startup:**
1. Connect to PostgreSQL ✅
2. Check `nexus.flyway_schema_history` for applied migrations
3. Run any pending migrations in order (V000, V001, V002...)
4. Start FastAPI service ✅

**All automatic!** No manual steps needed.

## Migration Files

### V000 - Nexus Base Schema (Baseline)

**File:** `V000__nexus_base_schema.sql`  
**Size:** ~600 lines  
**Creates:**
- Core schema (`nexus`)
- Users & authentication (users, roles, groups, refresh_tokens)
- RBAC (user_roles, user_groups, group_roles)
- Dashboards & queries (dashboards, saved_queries, query_history)
- Intent detection (intent_examples table + 184 examples)
- Bootstrap admin user (username: `nexus_admin`, password: `admin`)
- Default roles (ADMIN, EDITOR, VIEWER)

**Status:** ✅ Consolidated from helm/dashboard/sql/

### V001 - User Controlled Query Saves

**File:** `V001__user_controlled_query_saves.sql`  
**Changes:**
- Removed automatic hash-based query saves
- Added `updated_at` column to query_history
- Created `save_new_query()` function
- Created `update_existing_query()` function
- Recreated `query_history_with_users` view

**Status:** ✅ Already applied in existing databases

## Demo Data for Testing

**Use TPC-H instead of custom demo data!**

TPC-H is an industry-standard benchmark with realistic data:
- Tables: customers, orders, lineitem, part, supplier, nation, region
- Well-documented and widely used
- Already available in Trino

**Setup TPC-H in Trino:**
```bash
# TPC-H is built into Trino
# Access it via: tpch.sf1.* (scale factor 1 = ~1GB)

# Example query:
SELECT 
  c.name as customer_name,
  SUM(o.totalprice) as total_revenue
FROM tpch.sf1.customer c
JOIN tpch.sf1.orders o ON c.custkey = o.custkey
GROUP BY c.name
ORDER BY total_revenue DESC
LIMIT 10;
```

**No setup needed!** TPC-H is ready to use in Trino.

## Creating New Migrations

### 1. Create SQL File

```bash
cd nexus/db/migrations

# Next version is V002
cat > V002__add_audit_log.sql << 'EOF'
-- Add audit log table
CREATE TABLE IF NOT EXISTS nexus.audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES nexus.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON nexus.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON nexus.audit_log(created_at);
EOF
```

### 2. Test Locally

```bash
cd ../../docker
docker-compose restart nexus

# Check logs
docker logs dashboard-nexus | grep migration
```

### 3. Verify

```bash
# Check migration was applied
docker exec -i dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT version, description, installed_on FROM nexus.flyway_schema_history"
```

Expected output:
```
 version |         description          |        installed_on        
---------+------------------------------+----------------------------
 000     | nexus base schema            | 2025-12-25 20:00:00
 001     | user controlled query saves  | 2025-12-25 20:00:01
 002     | add audit log                | 2025-12-25 21:30:00
```

## Naming Convention

**Format:** `V{version}__{description}.sql`

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

Always use `IF EXISTS` / `IF NOT EXISTS`:

```sql
-- ✅ Safe to run multiple times
CREATE TABLE IF NOT EXISTS nexus.my_table (...);
ALTER TABLE nexus.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
DROP TABLE IF EXISTS nexus.temp CASCADE;
CREATE OR REPLACE FUNCTION nexus.my_function() ...;

-- ❌ Fails if already exists
CREATE TABLE nexus.my_table (...);
ALTER TABLE nexus.users ADD COLUMN email VARCHAR(255);
```

### 2. Use Transactions

Each migration runs in a transaction automatically. If any statement fails, the entire migration rolls back.

### 3. Test Locally First

```bash
# Always test before committing
docker-compose restart nexus
docker logs dashboard-nexus | grep -i migration
```

### 4. Never Modify Applied Migrations

Once a migration is applied in production, **never modify it**. Create a new migration instead.

## Troubleshooting

### Migration Failed

**Check logs:**
```bash
docker logs dashboard-nexus | grep -A 20 migration
```

**Fix:**
1. Identify the error in logs
2. Fix the SQL file  
3. Remove failed record:
   ```sql
   DELETE FROM nexus.flyway_schema_history WHERE success = false;
   ```
4. Restart: `docker-compose restart nexus`

### Check Applied Migrations

```bash
docker exec -i dashboard-postgres psql -U nexus_service -d dashboard \
  -c "SELECT * FROM nexus.flyway_schema_history ORDER BY installed_rank"
```

### Rollback (Manual)

Create a new "undo" migration:

```bash
cd nexus/db/migrations
cat > V003__rollback_audit_log.sql << 'EOF'
-- Undo changes from V002
DROP TABLE IF EXISTS nexus.audit_log CASCADE;
EOF
```

## Migration vs Helm

**Before (Helm):**
```
helm/dashboard/sql/
├── ddl/
│   ├── 01-nexus-schema.sql
│   ├── 02-demo-schema.sql
│   ├── 14-intent-examples.sql
│   └── ... (19 files!)
└── dml/
    ├── 03-demo-data.sql
    └── 07-intent-examples-data.sql
```

**Now (Nexus):**
```
nexus/db/migrations/
├── V000__nexus_base_schema.sql        # ← Consolidated from helm!
└── V001__user_controlled_query_saves.sql

For testing: Use TPC-H (built into Trino)!
```

**Benefits:**
- ✅ **Cleaner** - Consolidated into fewer files
- ✅ **Version controlled** - Clear migration order
- ✅ **Automatic** - Runs on Nexus startup
- ✅ **Portable** - Works on any platform
- ✅ **Independent** - Helm can be in separate repo
- ✅ **No demo data maintenance** - TPC-H is standard

## FAQ

**Q: What happened to helm/dashboard/sql/?**  
A: Consolidated into `nexus/db/migrations/`. Helm will be in a separate repo soon.

**Q: Do I need db-init anymore?**  
A: No! Removed from docker-compose. Nexus handles everything.

**Q: What about demo data?**  
A: Use TPC-H (built into Trino). No custom demo schema needed!

**Q: Will this work with existing databases?**  
A: Yes! Uses `IF NOT EXISTS`, safe to run on existing databases.

**Q: What if V001 was already applied?**  
A: V000 will run first (lower version number), then V001 is skipped (already applied).

**Q: Where is the bootstrap admin user?**  
A: In V000. Username: `nexus_admin`, Password: `admin` (change it!)

## Summary

✅ **All migrations in one place** - `nexus/db/migrations/`  
✅ **Automatic execution** - Runs on Nexus startup  
✅ **Clean structure** - Consolidated from 19 files to 2  
✅ **Version controlled** - Clear sequential order  
✅ **Helm independent** - No dependency on helm charts  
✅ **No demo data needed** - Use TPC-H (built into Trino)  

**Next migration:** Create `V002__your_feature.sql`

---

For a quick guide, see: `/DATABASE_MIGRATIONS.md`
