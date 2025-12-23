# Trino Docker Configuration

## 📋 Overview

Simple, template-based catalog configuration for Trino - **no dependencies, no complex scripts**.

- ✅ **Simple `.tpl` template files** - one per catalog
- ✅ **Built-in `envsubst`** - automatic environment variable substitution
- ✅ **No Python/YAML required** - just plain property files
- ✅ **Easy to add/remove** catalogs

## 🚀 Quick Start

### Current Active Catalogs

These are **enabled by default**:
- ✅ PostgreSQL (`postgres`)
- ✅ Memory (`memory`) - for testing
- ✅ TPCH (`tpch`) - sample data

### Adding a New Catalog

**Example: Enable MySQL**

1. **Copy example template**:
```bash
cp docker/trino/catalog-templates/examples/mysql.properties.tpl.example \
   docker/trino/catalog-templates/mysql.properties.tpl
```

2. **Add environment variables** to `docker-compose.yml`:
```yaml
trino:
  environment:
    MYSQL_HOST: mysql-server
    MYSQL_PORT: 3306
    MYSQL_DB: mydb
    MYSQL_USER: myuser
    MYSQL_PASSWORD: ${MYSQL_PASSWORD}
```

3. **Rebuild and restart**:
```bash
docker-compose -f docker/docker-compose.yml build trino
docker-compose -f docker/docker-compose.yml up -d trino
```

That's it! ✨

## 📂 File Structure

```
docker/trino/
├── catalog-templates/
│   ├── postgres.properties.tpl     # ← Active (PostgreSQL)
│   ├── memory.properties.tpl       # ← Active (in-memory)
│   ├── tpch.properties.tpl         # ← Active (sample data)
│   ├── README.md                   # Documentation
│   └── examples/                   # ← Example templates
│       ├── mysql.properties.tpl.example
│       ├── snowflake.properties.tpl.example
│       └── mongodb.properties.tpl.example
├── docker-entrypoint.sh            # Startup script (uses envsubst)
├── Dockerfile                      # Builds Trino image
├── config.properties               # Trino server config
└── README.md                       # This file
```

## 🔄 How It Works

1. **Startup**: `docker-entrypoint.sh` runs
2. **Scan**: Finds all `*.tpl` files in `catalog-templates/`
3. **Substitute**: Uses `envsubst` to replace `${VAR}` with environment values
4. **Generate**: Creates `.properties` files in `/etc/trino/catalog/`
5. **Start**: Trino starts with all catalogs configured

```
postgres.properties.tpl
     ↓
envsubst (replaces ${POSTGRES_HOST}, etc.)
     ↓
/etc/trino/catalog/postgres.properties
     ↓
Trino starts with postgres catalog available
```

## 🔌 Available Connectors

### Currently Included Examples

| Connector | Example Template | Use Case |
|-----------|-----------------|----------|
| MySQL | `mysql.properties.tpl.example` | Relational database |
| Snowflake | `snowflake.properties.tpl.example` | Cloud data warehouse |
| MongoDB | `mongodb.properties.tpl.example` | NoSQL database |

### Other Popular Connectors

Create your own `.tpl` file for any of these:

| Category | Connectors |
|----------|------------|
| **Relational** | Oracle, SQL Server, MariaDB, Redshift |
| **NoSQL** | Cassandra, Redis, Elasticsearch |
| **Cloud** | BigQuery, Redshift, Synapse, Athena |
| **Data Lakes** | Iceberg, Delta Lake, Hudi |
| **Object Storage** | S3 (Hive), Azure Blob, GCS |

**Full list**: https://trino.io/docs/current/connector.html

## 📝 Creating Custom Templates

### Example: Add Oracle

1. **Create template** `catalog-templates/oracle.properties.tpl`:
```properties
connector.name=oracle
connection-url=jdbc:oracle:thin:@${ORACLE_HOST}:${ORACLE_PORT}:${ORACLE_SID}
connection-user=${ORACLE_USER}
connection-password=${ORACLE_PASSWORD}
```

2. **Add environment variables**:
```yaml
trino:
  environment:
    ORACLE_HOST: oracle-server
    ORACLE_PORT: 1521
    ORACLE_SID: ORCL
    ORACLE_USER: system
    ORACLE_PASSWORD: ${ORACLE_PASSWORD}
```

3. **Rebuild and restart**

## 🛠️ Troubleshooting

### Check Generated Catalogs

```bash
docker exec dashboard-trino ls -la /etc/trino/catalog/
```

### View Generated Properties

```bash
docker exec dashboard-trino cat /etc/trino/catalog/postgres.properties
```

### Check Startup Logs

```bash
docker logs dashboard-trino | grep -A 10 "Catalog Generation"
```

### Verify Catalogs in Trino

```bash
docker exec dashboard-trino trino --execute "SHOW CATALOGS;"
```

### Test Query

```bash
docker exec dashboard-trino trino --execute "SELECT COUNT(*) FROM postgres.demo_ecommerce.customers;"
```

## 🔒 Security Best Practices

1. ✅ **Never hardcode passwords** - use environment variables
2. ✅ **Use `.env` file** - for local secrets (git-ignored)
3. ✅ **Use secrets management** - for production (Vault, AWS Secrets Manager)
4. ✅ **Limit permissions** - use read-only database users when possible
5. ✅ **Rotate credentials** - regularly update passwords

## 🆚 Comparison with Helm

Both Docker and Helm now use similar approaches:

| Feature | Docker | Helm |
|---------|--------|------|
| Config Files | `.tpl` templates | YAML in `values.yaml` |
| Syntax | Properties | YAML |
| Env Vars | `${VAR}` | `${ENV:VAR}` |
| Tool | `envsubst` | Kubernetes ConfigMap |
| Add Catalog | Add `.tpl` file | Edit `values.yaml` |

## 📚 Additional Resources

- [Trino Connectors Documentation](https://trino.io/docs/current/connector.html)
- [Trino Configuration Reference](https://trino.io/docs/current/admin/properties.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [envsubst Manual](https://www.gnu.org/software/gettext/manual/html_node/envsubst-Invocation.html)

## 💡 Tips

### Tip 1: Disable a Catalog Temporarily

Rename the template file:
```bash
mv catalog-templates/mysql.properties.tpl catalog-templates/mysql.properties.tpl.disabled
```

### Tip 2: Multiple Environments

Use different `.env` files:
```bash
# Development
docker-compose --env-file .env.dev up

# Staging
docker-compose --env-file .env.staging up
```

### Tip 3: Test Template Without Rebuild

```bash
# Export env vars
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432

# Test substitution
envsubst < catalog-templates/postgres.properties.tpl
```
