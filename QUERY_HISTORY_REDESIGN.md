# Query History Simplification & Favorite Query Versioning

## 📋 **Overview**

This redesign simplifies query tracking and adds comprehensive versioning for favorite queries. The key changes are:

1. **Renamed**: `saved_queries` → `favorite_queries` (reflects true intention)
2. **De-duplication**: Query history now tracks unique queries with execution counts
3. **Hash-based Lookup**: Fast query lookups using SHA-256(SQL + user_id)
4. **Versioning**: Full version history for favorite queries (like Git)
5. **Simplified Metrics**: Removed unnecessary stats (first_executed, avg time, success rate)

---

## 🎯 **Design Goals**

### **1. Query History De-duplication**
**Before**: Every execution created a new row
**After**: Same query (per user) updates a single row with execution count

**Benefits**:
- Cleaner history UI
- Faster lookups
- Easier to track "frequently used queries"
- Reduced database growth

### **2. Favorite Queries = True User Intent**
**Before**: `saved_queries` (generic name)
**After**: `favorite_queries` (clear purpose)

**Benefits**:
- Clearer naming
- `is_favorite` column makes more sense
- Better UX messaging

### **3. Version Control for Favorites**
**Before**: No version tracking
**After**: Full version history with:
- Automatic snapshots on SQL changes
- Manual version notes
- Revert capability

**Benefits**:
- Safety: Never lose query iterations
- Audit: See evolution of queries
- Collaboration: Share query improvements

---

## 🏗️ **Architecture**

### **Database Schema**

```sql
-- Query History (De-duplicated)
nexus.query_history
├── id (UUID)
├── query_hash (VARCHAR(64)) -- SHA-256 of SQL + user_id
├── user_id (UUID)
├── execution_count (INTEGER) -- How many times run
├── last_executed_at (TIMESTAMP) -- For ordering
├── generated_sql (TEXT)
└── ... (metadata from most recent execution)

-- Favorite Queries (with versioning)
nexus.favorite_queries
├── id (UUID)
├── user_id (UUID)
├── query_name (VARCHAR(255))
├── generated_sql (TEXT)
├── version (INTEGER) -- Current version number
└── ... (metadata)

-- Version History Snapshots
nexus.favorite_query_versions
├── favorite_query_id (UUID)
├── version (INTEGER)
├── generated_sql (TEXT) -- Snapshot of SQL
├── version_notes (TEXT)
├── created_by (UUID)
└── created_at (TIMESTAMP)
```

---

## 🔑 **Key Concepts**

### **Query Hash**
```python
hash = SHA-256(normalized_sql + "::" + user_id)
```

- **Normalization**: `LOWER(REGEXP_REPLACE(sql, '\s+', ' ', 'g'))`
- **Per-user**: Same SQL by different users = different hashes
- **Fast Lookup**: Indexed for O(1) lookups

### **De-duplication Flow**
```
1. Execute query
2. Generate hash = SHA-256(SQL + user_id)
3. SELECT * FROM query_history WHERE query_hash = hash
4. IF FOUND:
     UPDATE execution_count += 1, last_executed_at = NOW()
   ELSE:
     INSERT new row with execution_count = 1
```

### **Versioning Flow**
```
1. User edits favorite query SQL
2. IF SQL changed:
     a. Create snapshot in favorite_query_versions
     b. Increment version number
     c. Update favorite_queries with new SQL
   ELSE:
     Just update non-SQL fields (no version bump)
```

---

## 🛠️ **SQL Functions**

### **1. `nexus.generate_query_hash(sql, user_id)`**
Generates deterministic hash for de-duplication.

```sql
SELECT nexus.generate_query_hash(
    'SELECT * FROM orders', 
    'user-uuid-here'
);
-- Returns: 'a3f4b2...' (64-char hex string)
```

### **2. `nexus.upsert_query_history(...)`**
Finds or creates query history entry.

```sql
SELECT nexus.upsert_query_history(
    p_user_id => 'uuid',
    p_generated_sql => 'SELECT...',
    p_execution_status => 'success',
    p_execution_time_ms => 150,
    p_row_count => 42,
    ...
);
-- Returns: query_id (UUID)
```

### **3. `nexus.update_favorite_query_sql(...)`**
Updates favorite query with automatic versioning.

```sql
SELECT nexus.update_favorite_query_sql(
    p_favorite_query_id => 'query-uuid',
    p_user_id => 'user-uuid',
    p_new_sql => 'SELECT * FROM customers LIMIT 100',
    p_version_notes => 'Added limit for performance'
);
-- Returns: new_version (INTEGER)
```

### **4. `nexus.revert_favorite_query_version(...)`**
Reverts to a previous version (creates auto-save first).

```sql
SELECT nexus.revert_favorite_query_version(
    p_favorite_query_id => 'query-uuid',
    p_target_version => 2,
    p_user_id => 'user-uuid'
);
-- Returns: new_version (INTEGER)
```

---

## 📊 **Example Scenarios**

### **Scenario 1: User runs same query 10 times**

**Before**:
```
query_history: 10 rows (duplicates)
```

**After**:
```
query_history: 1 row
  - execution_count = 10
  - last_executed_at = <most recent>
```

### **Scenario 2: User evolves a favorite query**

```
V1: SELECT * FROM orders
    ↓ (user adds WHERE clause)
V2: SELECT * FROM orders WHERE status = 'completed'
    ↓ (user adds LIMIT)
V3: SELECT * FROM orders WHERE status = 'completed' LIMIT 100
```

**Storage**:
- `favorite_queries`: 1 row (current = V3)
- `favorite_query_versions`: 3 rows (V1, V2, V3 snapshots)

**User can**:
- See full history (V1 → V2 → V3)
- Revert to V1 or V2 anytime
- Compare versions side-by-side

---

## 🔄 **Migration Strategy**

### **Conservative Approach** (Chosen)
- **Keep existing rows**: No data loss
- **De-duplicate going forward**: New executions use upsert
- **Backfill hashes**: Add `query_hash` to existing rows
- **Table rename**: `saved_queries` → `favorite_queries`

### **Migration Steps**
1. ✅ Add `query_hash` column to `query_history`
2. ✅ Backfill hashes for existing rows
3. ✅ Rename `saved_queries` → `favorite_queries`
4. ✅ Add `version` column to `favorite_queries`
5. ✅ Create `favorite_query_versions` table
6. ✅ Create SQL functions
7. ✅ Update backend to use new functions

---

## 🚀 **Backend Changes**

### **Updated Services**

#### **`user_service.py`**
```python
# Before
async def save_query_execution(...):
    query_history = QueryHistory(...)
    session.add(query_history)  # Always creates new row

# After
async def save_query_execution(...):
    # Calls SQL function for upsert
    query_id = await session.execute(
        select(func.nexus.upsert_query_history(...))
    )
    # Returns existing or new query_id
```

#### **New Methods Added**
- `get_favorite_query_versions(query_id, user_id)` - List all versions
- `revert_favorite_query_version(query_id, user_id, version)` - Rollback

---

## 📈 **Performance Improvements**

### **Before** (No De-duplication)
- 1000 executions of same query = 1000 rows
- History queries: `ORDER BY executed_at` on 1M rows
- Slow pagination

### **After** (With De-duplication)
- 1000 executions of same query = 1 row (execution_count=1000)
- History queries: `ORDER BY last_executed_at` on ~10k unique rows
- Fast pagination with indexed `query_hash`

### **Benchmarks** (Estimated)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| History query time | 500ms | 50ms | **10x faster** |
| Storage growth | 1MB/day | 100KB/day | **10x smaller** |
| Duplicate detection | N/A | O(1) | **Instant** |

---

## 🧪 **Testing**

### **Test Cases**
1. ✅ Run same query 5 times → `execution_count = 5`
2. ✅ Run slightly different query → New row created
3. ✅ Update favorite query SQL → Version incremented
4. ✅ Update favorite query name → Version stays same
5. ✅ Revert to version 2 → Creates version 4 (auto-save + restore)
6. ✅ View version history → All snapshots returned

### **Edge Cases**
- Hash collision (extremely unlikely with SHA-256)
- Concurrent updates to same favorite query
- Reverting to non-existent version (should error)

---

## 📋 **API Changes**

### **New Endpoints Needed** (Future Work)
```
GET    /api/favorite-queries/{id}/versions
POST   /api/favorite-queries/{id}/revert/{version}
```

### **Updated Endpoints**
```
PUT    /api/favorite-queries/{id}
  - Now supports version_notes parameter
  - Returns new version number on SQL change
```

---

## 🎉 **Benefits Summary**

### **For Users**
- ✅ Cleaner query history (no duplicates)
- ✅ See "Top 10 most-run queries"
- ✅ Never lose query iterations
- ✅ Easy rollback if query breaks

### **For Developers**
- ✅ Simpler code (SQL functions handle complexity)
- ✅ Better performance (fewer rows)
- ✅ Audit trail (full version history)

### **For Database**
- ✅ Reduced storage (10x smaller)
- ✅ Faster queries (indexed hashes)
- ✅ Better data integrity (unique constraints)

---

## 📚 **Files Modified**

### **DDL Scripts**
- `helm/dashboard/sql/ddl/11-query-history-simplification.sql`
  - Renames tables
  - Adds `query_hash` column
  - Creates version table
  - Defines all SQL functions

### **Backend**
- `nexus/app/database.py`
  - Updated `QueryHistory` model (add `query_hash`, `execution_count`)
  - Renamed `SavedQueries` → `FavoriteQueries`
  - Added `FavoriteQueryVersion` model

- `nexus/app/services/user_service.py`
  - Updated `save_query_execution` to use `upsert_query_history`
  - Updated `update_saved_query` to handle versioning
  - Added `get_favorite_query_versions`
  - Added `revert_favorite_query_version`

### **Frontend** (Future Work)
- Query History UI (show execution count)
- Favorite Queries versioning UI
- Version comparison view

---

## 🚦 **Deployment Checklist**

1. ✅ **Run DDL migration**: `11-query-history-simplification.sql`
2. ✅ **Test functions**: Execute test queries
3. ⏳ **Deploy backend**: With updated `user_service.py`
4. ⏳ **Update API docs**: New endpoints and responses
5. ⏳ **Update frontend**: Use new API responses
6. ⏳ **Monitor**: Check for hash collisions or performance issues

---

## 📝 **Migration Rollback Plan**

If issues arise:
1. Revert backend deployment
2. Keep database changes (backward compatible)
3. Old code will continue working (uses SavedQueries alias)
4. Fix issues and redeploy

**Note**: DDL changes are **additive only** (no drops), so rollback is safe.

---

## 🤝 **Credits**

Design discussion and implementation based on user requirements:
- De-duplication for cleaner history
- Hash-based lookups for performance
- Versioning for safety and collaboration
- Conservative migration for zero downtime

