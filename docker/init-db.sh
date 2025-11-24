#!/bin/bash
# Initialize PostgreSQL database with required schemas and data
# This script runs the SQL initialization files if they haven't been executed yet

set -e

echo "🔍 Checking if database initialization is needed..."

# Wait for PostgreSQL to be ready
until docker exec dashboard-postgres pg_isready -U ${POSTGRES_USER:-nexus_service} -d ${POSTGRES_DB:-dashboard} > /dev/null 2>&1; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Check if nexus schema exists
SCHEMA_EXISTS=$(docker exec dashboard-postgres psql -U ${POSTGRES_USER:-nexus_service} -d ${POSTGRES_DB:-dashboard} -tAc "SELECT 1 FROM pg_namespace WHERE nspname='nexus'" 2>/dev/null || echo "0")

if [ "$SCHEMA_EXISTS" = "1" ]; then
  echo "✅ Database already initialized (nexus schema exists)"
else
  echo "🔨 Initializing database..."
  
  # Execute SQL initialization scripts in order
  echo "  📝 Creating nexus schema..."
  docker exec dashboard-postgres psql -U ${POSTGRES_USER:-nexus_service} -d ${POSTGRES_DB:-dashboard} -f /docker-entrypoint-initdb.d/nexus-schema.sql
  
  echo "  📝 Creating demo schema..."
  docker exec dashboard-postgres psql -U ${POSTGRES_USER:-nexus_service} -d ${POSTGRES_DB:-dashboard} -f /docker-entrypoint-initdb.d/demo-schema.sql
  
  echo "  📝 Loading demo data..."
  docker exec dashboard-postgres psql -U ${POSTGRES_USER:-nexus_service} -d ${POSTGRES_DB:-dashboard} -f /docker-entrypoint-initdb.d/demo-data.sql
  
  echo "✅ Database initialization complete"
fi

