#!/bin/bash

# Start Trino with sample databases and test data

echo "🚀 Starting Trino with Sample Databases"
echo "======================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to trino directory
cd "$(dirname "$0")"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose-trino.yml down

# Start the services
echo "🔄 Starting Trino, PostgreSQL, and MySQL..."
docker-compose -f docker-compose-trino.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker exec trino-postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check MySQL
if docker exec trino-mysql mysqladmin ping -h localhost -u mysql -pmysql > /dev/null 2>&1; then
    echo "✅ MySQL is ready"
else
    echo "❌ MySQL is not ready"
fi

# Check Trino
if curl -s http://localhost:8080/v1/info > /dev/null 2>&1; then
    echo "✅ Trino is ready"
else
    echo "❌ Trino is not ready yet, may need more time..."
fi

echo ""
echo "🎉 Trino Setup Complete!"
echo "========================"
echo "Trino Web UI: http://localhost:8080"
echo "PostgreSQL: localhost:5432 (user: postgres, password: postgres, db: sampledb)"
echo "MySQL: localhost:3306 (user: mysql, password: mysql, db: ecommerce)"
echo ""
echo "Available Catalogs:"
echo "- postgresql (sales, hr, analytics, inventory schemas)"
echo "- mysql (ecommerce schema with user accounts, reviews, etc.)"
echo "- memory (for temporary tables)"
echo ""
echo "Test Trino connection:"
echo "docker exec -it trino-coordinator trino --server localhost:8080 --catalog postgresql --schema sales"
echo ""
echo "Sample queries to try:"
echo "SHOW CATALOGS;"
echo "SHOW SCHEMAS FROM postgresql;"
echo "SHOW TABLES FROM postgresql.sales;"
echo "SELECT * FROM postgresql.sales.customers LIMIT 5;"
echo "SELECT * FROM mysql.ecommerce.user_accounts LIMIT 5;"
