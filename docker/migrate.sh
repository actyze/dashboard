#!/bin/sh
# Use loose error checking so one failed script doesn't stop the others
# or crash the container
set +e

echo "Checking database connection..."
until pg_isready -h postgres; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "Starting database migration..."

# Check if there are any SQL files
if ls /sql/*.sql >/dev/null 2>&1; then
  for file in /sql/*.sql; do
    echo "  Applying $file..."
    psql -f "$file" || echo "Warning: Failed to execute $file"
  done
else
  echo "No SQL files found in /sql directory"
fi

echo "Database migration process finished"

# Exit successfully so docker-compose knows we're done
exit 0
