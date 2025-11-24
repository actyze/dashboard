#!/bin/bash
set -e

# Substitute environment variables in postgres catalog configuration using sed
sed -e "s/\${POSTGRES_HOST}/${POSTGRES_HOST}/g" \
    -e "s/\${POSTGRES_PORT}/${POSTGRES_PORT}/g" \
    -e "s/\${POSTGRES_DB}/${POSTGRES_DB}/g" \
    -e "s/\${POSTGRES_USER}/${POSTGRES_USER}/g" \
    -e "s/\${POSTGRES_PASSWORD}/${POSTGRES_PASSWORD}/g" \
    /etc/trino/catalog/postgres.properties.template > /etc/trino/catalog/postgres.properties

# Execute the original Trino entrypoint
exec /usr/lib/trino/bin/run-trino

