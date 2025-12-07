#!/bin/sh
# Database migration script
# - DDL (schema changes) run automatically - REQUIRED for app functionality
# - DML (demo data) only runs if RUN_DML=true - OPTIONAL for demo/dev environments
set +e

echo "========================================="
echo "Database Migration Script"
echo "========================================="

# Check database connection
echo "Checking database connection..."
until pg_isready -h postgres; do
  echo "Waiting for postgres..."
  sleep 2
done
echo "✓ Database is ready"
echo ""

# =============================================================================
# DDL Migration (REQUIRED - Schema changes)
# =============================================================================
echo "========================================="
echo "Running DDL migrations (schema changes)"
echo "========================================="

if ls /sql/ddl/*.sql >/dev/null 2>&1; then
  DDL_COUNT=0
  DDL_SUCCESS=0
  DDL_FAILED=0
  
  for file in /sql/ddl/*.sql; do
    DDL_COUNT=$((DDL_COUNT + 1))
    filename=$(basename "$file")
    echo "[$DDL_COUNT] Applying DDL: $filename"
    
    if psql -f "$file" 2>&1 | grep -v "already exists\|duplicate"; then
      DDL_SUCCESS=$((DDL_SUCCESS + 1))
      echo "    ✓ Success"
    else
      DDL_FAILED=$((DDL_FAILED + 1))
      echo "    ⚠ Warning: May have failed (check logs)"
    fi
  done
  
  echo ""
  echo "DDL Summary: $DDL_SUCCESS successful, $DDL_FAILED warnings/failures"
else
  echo "⚠ No DDL files found in /sql/ddl/"
fi

echo ""

# =============================================================================
# DML Migration (OPTIONAL - Demo data)
# =============================================================================
if [ "$RUN_DML" = "true" ]; then
  echo "========================================="
  echo "Running DML migrations (demo data)"
  echo "========================================="
  
  if ls /sql/dml/*.sql >/dev/null 2>&1; then
    DML_COUNT=0
    
    for file in /sql/dml/*.sql; do
      DML_COUNT=$((DML_COUNT + 1))
      filename=$(basename "$file")
      echo "[$DML_COUNT] Applying DML: $filename"
      
      # DML can take a while for large datasets
      if psql -f "$file"; then
        echo "    ✓ Success"
      else
        echo "    ✗ Failed (non-critical, demo data only)"
      fi
    done
    
    echo ""
    echo "DML applied: $DML_COUNT file(s)"
  else
    echo "⚠ No DML files found in /sql/dml/"
  fi
else
  echo "========================================="
  echo "Skipping DML migrations (demo data)"
  echo "========================================="
  echo "To run demo data inserts, set: RUN_DML=true"
  echo ""
  echo "Manual command:"
  echo "  docker compose run --rm -e RUN_DML=true db-init"
fi

echo ""
echo "========================================="
echo "Migration Complete"
echo "========================================="

# Exit successfully so docker-compose knows we're done
exit 0
