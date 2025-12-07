# Database Migration Scripts

This directory contains SQL migration scripts organized by type.

## 📁 Directory Structure

```
sql/
├── ddl/   # Data Definition Language (Schema changes) - RUN AUTOMATICALLY
│   ├── 01-nexus-schema.sql
│   ├── 02-demo-schema.sql
│   ├── 05-query-history-enhancement.sql
│   └── 06-saved-queries-crud-enhancement.sql
│
└── dml/   # Data Manipulation Language (Demo data) - RUN MANUALLY
    ├── 03-demo-data.sql
    └── 04-demo-data-extended.sql
```

---

## 🔧 DDL (Data Definition Language)

**Location**: `sql/ddl/`  
**Runs**: Automatically on `docker compose up`  
**Purpose**: Schema changes required for application functionality

### What's Included:
- Table creation (CREATE TABLE)
- Schema modifications (ALTER TABLE)
- Index creation
- Constraint definitions

### Why Required:
- Application code expects specific table structures
- Missing columns = runtime errors
- Must run before application starts

---

## 📊 DML (Data Manipulation Language)

**Location**: `sql/dml/`  
**Runs**: Manually (opt-in only)  
**Purpose**: Demo data for development/testing

### What's Included:
- INSERT statements for sample data
- Large demo datasets
- Test data for UI demonstrations

### Why Optional:
- Not required for application to function
- Can be slow (thousands of INSERT statements)
- Not needed in production
- Developers can choose minimal or full dataset

---

## 🚀 Usage

### Automatic (Default Behavior)

When you run `docker compose up`, **only DDL runs automatically**:

```bash
docker compose -f docker/docker-compose.yml up -d
# ✅ DDL runs automatically
# ❌ DML skipped (no demo data)
```

### With Demo Data (Manual)

To include demo data, set `RUN_DML=true`:

```bash
# Option 1: Run db-init manually with demo data
docker compose run --rm -e RUN_DML=true db-init

# Option 2: Set in docker-compose.yml environment
# db-init:
#   environment:
#     RUN_DML: "true"
```

### Run Specific File Manually

```bash
# Run a specific DDL file
cat sql/ddl/05-query-history-enhancement.sql | \
  docker exec -i dashboard-postgres psql -U nexus_service -d dashboard

# Run a specific DML file
cat sql/dml/04-demo-data-extended.sql | \
  docker exec -i dashboard-postgres psql -U nexus_service -d dashboard
```

---

## 📝 Migration File Naming Convention

Files are executed in alphabetical order:

```
01-xxx.sql    # Initial schema
02-xxx.sql    # Core tables
03-xxx.sql    # Basic data
04-xxx.sql    # Extended data
05-xxx.sql    # Schema enhancements
06-xxx.sql    # Feature additions
```

---

## ✅ Best Practices

### When Adding New Migrations

1. **Schema changes** → Add to `ddl/`
   - ALTER TABLE
   - CREATE TABLE
   - ADD COLUMN
   - CREATE INDEX

2. **Data inserts** → Add to `dml/`
   - INSERT INTO
   - UPDATE (bulk data)
   - Demo/test data

### Making Migrations Idempotent

Always use:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `ON CONFLICT DO NOTHING` for INSERTs

Example:
```sql
-- Good (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Bad (fails on re-run)
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

---

## 🔍 Troubleshooting

### "Column does not exist" errors

**Problem**: Database schema is out of date  
**Solution**: Run DDL migrations

```bash
docker compose run --rm db-init
```

### Migrations taking too long

**Problem**: Large DML files slow down startup  
**Solution**: This is why DML is separated! DDL runs fast, DML is optional.

### Need to reset database

```bash
# Stop services
docker compose down

# Delete database volume
docker volume rm docker_postgres_data

# Start fresh (DDL runs automatically)
docker compose up -d
```

---

## 🎯 Benefits of DDL/DML Separation

| Benefit | Description |
|---------|-------------|
| **Faster Startup** | App starts in seconds, not minutes |
| **Production Ready** | Prod environments don't need demo data |
| **Developer Choice** | Devs can choose minimal or full dataset |
| **CI/CD Friendly** | Tests run fast without huge datasets |
| **Clear Intent** | Schema changes clearly separated from data |

---

## 📚 Related Files

- `docker/migrate.sh` - Migration execution script
- `docker/docker-compose.yml` - Defines db-init service
- `docker/.env` - Database credentials

---

**Questions?** Check the main README or ask the team!

