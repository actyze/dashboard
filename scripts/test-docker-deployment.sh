#!/bin/bash

# Test script for Docker deployment validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test function
test_endpoint() {
    local url=$1
    local service=$2
    local timeout=${3:-10}
    
    print_test "Testing $service at $url"
    
    if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
        print_pass "$service is responding"
        return 0
    else
        print_fail "$service is not responding"
        return 1
    fi
}

# Test JSON endpoint
test_json_endpoint() {
    local url=$1
    local service=$2
    local timeout=${3:-10}
    
    print_test "Testing $service JSON response at $url"
    
    local response=$(curl -s --max-time $timeout "$url" 2>/dev/null)
    if echo "$response" | jq . > /dev/null 2>&1; then
        print_pass "$service returned valid JSON"
        echo "  Response: $(echo "$response" | jq -c .)"
        return 0
    else
        print_fail "$service returned invalid JSON or no response"
        echo "  Response: $response"
        return 1
    fi
}

# Main test function
run_tests() {
    local environment=${1:-"local"}
    local failed_tests=0
    
    echo "=========================================="
    echo "  Dashboard Docker Deployment Tests"
    echo "  Environment: $environment"
    echo "=========================================="
    echo ""
    
    # Wait for services to be ready
    print_info "Waiting 30 seconds for services to initialize..."
    sleep 30
    
    # Test Frontend
    if ! test_endpoint "http://localhost:3000/health" "Frontend"; then
        ((failed_tests++))
    fi
    
    # Test Nexus API
    if ! test_json_endpoint "http://localhost:8002/health" "Nexus API"; then
        ((failed_tests++))
    fi
    
    # Test Frontend API Proxy
    if ! test_json_endpoint "http://localhost:3000/api/health" "Frontend API Proxy"; then
        ((failed_tests++))
    fi
    
    # Test Schema Service (only in full environment)
    if [[ "$environment" == "full" ]]; then
        if ! test_json_endpoint "http://localhost:8001/health" "Schema Service"; then
            ((failed_tests++))
        fi
    fi
    
    # Test PostgreSQL connection
    print_test "Testing PostgreSQL connection"
    local container_name="dashboard-postgres-${environment}"
    if [[ "$environment" == "local" ]]; then
        container_name="dashboard-postgres-local"
    else
        container_name="dashboard-postgres"
    fi
    if docker exec $container_name pg_isready -U dashboard_user -d dashboard > /dev/null 2>&1; then
        print_pass "PostgreSQL is ready"
    else
        print_fail "PostgreSQL is not ready"
        ((failed_tests++))
    fi
    
    # Test database tables
    print_test "Testing database schema"
    local container_name="dashboard-postgres-${environment}"
    if [[ "$environment" == "local" ]]; then
        container_name="dashboard-postgres-local"
    else
        container_name="dashboard-postgres"
    fi
    local table_count=$(docker exec $container_name psql -U dashboard_user -d dashboard -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'demo_ecommerce';" 2>/dev/null | xargs)
    if [[ "$table_count" -gt 0 ]]; then
        print_pass "Database schema loaded ($table_count tables in demo_ecommerce)"
    else
        print_fail "Database schema not loaded properly"
        ((failed_tests++))
    fi
    
    # Test Nexus GraphQL endpoint
    print_test "Testing Nexus GraphQL endpoint"
    local graphql_response=$(curl -s --max-time 10 -X POST \
        -H "Content-Type: application/json" \
        -d '{"query": "{ __schema { types { name } } }"}' \
        http://localhost:8002/graphql 2>/dev/null)
    
    if echo "$graphql_response" | jq '.data.__schema.types' > /dev/null 2>&1; then
        print_pass "GraphQL endpoint is working"
    else
        print_fail "GraphQL endpoint is not working"
        ((failed_tests++))
    fi
    
    echo ""
    echo "=========================================="
    if [[ $failed_tests -eq 0 ]]; then
        print_pass "All tests passed! 🎉"
        echo ""
        print_info "Your Dashboard deployment is ready:"
        echo "  🌐 Frontend:    http://localhost:3000"
        echo "  🔧 Nexus API:   http://localhost:8002"
        if [[ "$environment" == "full" ]]; then
            echo "  📊 Schema API:  http://localhost:8001"
        fi
        echo "  🗄️  PostgreSQL:  localhost:5432"
        echo ""
        print_info "Try making a natural language query through the frontend!"
    else
        print_fail "$failed_tests test(s) failed"
        echo ""
        print_info "Troubleshooting steps:"
        echo "  1. Check service logs: ./scripts/docker-start.sh logs -f"
        echo "  2. Check service status: ./scripts/docker-start.sh status"
        echo "  3. Restart services: ./scripts/docker-start.sh restart"
        exit 1
    fi
    echo "=========================================="
}

# Help function
show_help() {
    echo "Dashboard Docker Deployment Test Script"
    echo ""
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "Environments:"
    echo "  local    Test local development environment (default)"
    echo "  full     Test full environment with all services"
    echo ""
    echo "Examples:"
    echo "  $0           # Test local environment"
    echo "  $0 local     # Test local environment"
    echo "  $0 full      # Test full environment"
}

# Check dependencies
if ! command -v curl &> /dev/null; then
    print_fail "curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_fail "jq is required but not installed"
    exit 1
fi

# Main execution
case "${1:-local}" in
    "local"|"full")
        run_tests "$1"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_fail "Unknown environment: $1"
        show_help
        exit 1
        ;;
esac
