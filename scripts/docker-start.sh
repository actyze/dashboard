#!/bin/bash

# Docker Compose Management Script for Dashboard Services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    echo "Dashboard Docker Compose Management"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  local     Start local development environment (PostgreSQL + Nexus + Frontend)"
    echo "  full      Start full environment with external services (Schema Service + External Trino)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  logs      Show logs for all services"
    echo "  status    Show status of all services"
    echo "  clean     Stop and remove all containers, volumes, and networks"
    echo "  build     Build all Docker images"
    echo ""
    echo "Options:"
    echo "  -d, --detach    Run in detached mode"
    echo "  -f, --follow    Follow logs (only with logs command)"
    echo "  --no-cache      Build without cache (only with build command)"
    echo ""
    echo "Examples:"
    echo "  $0 local -d                 # Start local environment in background"
    echo "  $0 full                     # Start full environment in foreground"
    echo "  $0 logs -f                  # Follow logs for all services"
    echo "  $0 build --no-cache         # Rebuild all images without cache"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Get Docker Compose command (docker-compose or docker compose)
get_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Start local development environment
start_local() {
    local detach_flag=""
    if [[ "$1" == "-d" || "$1" == "--detach" ]]; then
        detach_flag="-d"
    fi

    print_status "Starting local development environment..."
    print_status "Services: PostgreSQL + Nexus + Frontend"
    
    COMPOSE_CMD=$(get_compose_cmd)
    $COMPOSE_CMD -f docker/docker-compose.local.yml up $detach_flag

    if [[ "$detach_flag" == "-d" ]]; then
        print_success "Local environment started in background"
        print_status "Access the application at: http://localhost:3000"
        print_status "Nexus API available at: http://localhost:8002"
        print_status "PostgreSQL available at: localhost:5432"
    fi
}

# Start full environment
start_full() {
    local detach_flag=""
    if [[ "$1" == "-d" || "$1" == "--detach" ]]; then
        detach_flag="-d"
    fi

    print_status "Starting full environment..."
    print_status "Services: PostgreSQL + Schema Service + Nexus + Frontend"
    
    # Check if environment file exists
    if [[ ! -f ".env.docker" ]]; then
        print_warning ".env.docker file not found. Creating from example..."
        cp docker/docker.env.example .env.docker
        print_warning "Please update .env.docker with your actual API keys and credentials"
    fi

    COMPOSE_CMD=$(get_compose_cmd)
    $COMPOSE_CMD -f docker/docker-compose.full.yml --env-file .env.docker up $detach_flag

    if [[ "$detach_flag" == "-d" ]]; then
        print_success "Full environment started in background"
        print_status "Access the application at: http://localhost:3000"
        print_status "Nexus API available at: http://localhost:8002"
        print_status "Schema Service available at: http://localhost:8001"
        print_status "PostgreSQL available at: localhost:5432"
    fi
}

# Stop all services
stop_services() {
    print_status "Stopping all services..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    $COMPOSE_CMD -f docker/docker-compose.local.yml down 2>/dev/null || true
    $COMPOSE_CMD -f docker/docker-compose.full.yml down 2>/dev/null || true
    
    print_success "All services stopped"
}

# Restart services
restart_services() {
    print_status "Restarting services..."
    stop_services
    sleep 2
    
    # Determine which environment was running
    if docker ps -a --format "table {{.Names}}" | grep -q "dashboard-nexus-local"; then
        start_local "-d"
    else
        start_full "-d"
    fi
}

# Show logs
show_logs() {
    local follow_flag=""
    if [[ "$1" == "-f" || "$1" == "--follow" ]]; then
        follow_flag="-f"
    fi

    COMPOSE_CMD=$(get_compose_cmd)
    
    # Check which environment is running
    if docker ps --format "table {{.Names}}" | grep -q "dashboard-nexus-local"; then
        print_status "Showing logs for local environment..."
        $COMPOSE_CMD -f docker/docker-compose.local.yml logs $follow_flag
    elif docker ps --format "table {{.Names}}" | grep -q "dashboard-nexus"; then
        print_status "Showing logs for full environment..."
        $COMPOSE_CMD -f docker/docker-compose.full.yml logs $follow_flag
    else
        print_warning "No dashboard services are currently running"
    fi
}

# Show status
show_status() {
    print_status "Dashboard Services Status:"
    echo ""
    
    # Check for running containers
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(dashboard|postgres)" | head -10; then
        echo ""
        print_status "Service URLs:"
        echo "  Frontend:      http://localhost:3000"
        echo "  Nexus API:     http://localhost:8002"
        echo "  Schema Service: http://localhost:8001 (if running)"
        echo "  PostgreSQL:    localhost:5432"
    else
        print_warning "No dashboard services are currently running"
        echo ""
        print_status "To start services:"
        echo "  Local development:  $0 local -d"
        echo "  Full environment:   $0 full -d"
    fi
}

# Clean up everything
clean_all() {
    print_warning "This will stop and remove all containers, volumes, and networks"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up all resources..."
        
        COMPOSE_CMD=$(get_compose_cmd)
        $COMPOSE_CMD -f docker/docker-compose.local.yml down -v --remove-orphans 2>/dev/null || true
        $COMPOSE_CMD -f docker/docker-compose.full.yml down -v --remove-orphans 2>/dev/null || true
        
        # Remove dashboard-related images
        docker images --format "table {{.Repository}}:{{.Tag}}" | grep dashboard | xargs -r docker rmi 2>/dev/null || true
        
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Build images
build_images() {
    local no_cache_flag=""
    if [[ "$1" == "--no-cache" ]]; then
        no_cache_flag="--no-cache"
    fi

    print_status "Building Docker images..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    $COMPOSE_CMD -f docker/docker-compose.full.yml build $no_cache_flag
    
    print_success "All images built successfully"
}

# Main script logic
main() {
    check_dependencies

    case "${1:-help}" in
        "local")
            start_local "$2"
            ;;
        "full")
            start_full "$2"
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs "$2"
            ;;
        "status")
            show_status
            ;;
        "clean")
            clean_all
            ;;
        "build")
            build_images "$2"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
