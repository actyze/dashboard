# Trino Catalog Templates

## Active Catalogs

These templates are **currently enabled** and will be generated on startup:

- ✅ `postgres.properties.tpl` - PostgreSQL database
- ✅ `memory.properties.tpl` - In-memory temporary tables
- ✅ `tpch.properties.tpl` - Sample TPC-H benchmark data

## How to Add More Catalogs

### Option 1: Use Example Templates

Copy an example template from `examples/` directory and rename it (remove `.example`):

```bash
# Enable MySQL
cp examples/mysql.properties.tpl.example mysql.properties.tpl

# Enable Snowflake
cp examples/snowflake.properties.tpl.example snowflake.properties.tpl
```

### Option 2: Create Your Own Template

Create a new `.tpl` file in this directory:

```bash
# Create MongoDB catalog
cat > mongodb.properties.tpl << 'EOF'
connector.name=mongodb
mongodb.connection-url=mongodb://${MONGO_HOST}:${MONGO_PORT}
mongodb.credentials=${MONGO_USER}:${MONGO_PASSWORD}@admin
EOF
```

### Environment Variables

Add corresponding environment variables to `docker-compose.yml`:

```yaml
trino:
  environment:
    MONGO_HOST: mongodb-server
    MONGO_PORT: 27017
    MONGO_USER: admin
    MONGO_PASSWORD: ${MONGO_PASSWORD}
```

### Rebuild and Restart

```bash
docker-compose -f docker/docker-compose.yml build trino
docker-compose -f docker/docker-compose.yml up -d trino
```

## How It Works

1. On startup, `docker-entrypoint.sh` scans this directory
2. For each `.tpl` file found, it:
   - Replaces `${VARIABLE}` with environment variable values using `envsubst`
   - Generates a `.properties` file in `/etc/trino/catalog/`
3. Trino starts with all generated catalogs available

## Available Connectors

See example templates in `examples/` directory or visit:
https://trino.io/docs/current/connector.html

