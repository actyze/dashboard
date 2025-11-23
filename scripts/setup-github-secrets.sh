#!/bin/bash

# GitHub Secrets Setup Script for Dashboard CI/CD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Dashboard GitHub Secrets Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_info() {
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

# Check if GitHub CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed."
        echo ""
        echo "Please install GitHub CLI:"
        echo "  macOS: brew install gh"
        echo "  Ubuntu: sudo apt install gh"
        echo "  Windows: winget install GitHub.cli"
        echo ""
        echo "Or visit: https://cli.github.com/"
        exit 1
    fi
}

# Check if user is authenticated
check_gh_auth() {
    if ! gh auth status &> /dev/null; then
        print_error "You are not authenticated with GitHub CLI."
        echo ""
        echo "Please authenticate first:"
        echo "  gh auth login"
        echo ""
        exit 1
    fi
}

# Get repository information
get_repo_info() {
    if git rev-parse --is-inside-work-tree &> /dev/null; then
        REPO_URL=$(git config --get remote.origin.url)
        if [[ $REPO_URL == *"github.com"* ]]; then
            # Extract owner/repo from URL
            REPO_PATH=$(echo "$REPO_URL" | sed -E 's/.*github\.com[\/:]([^\/]+\/[^\/]+)(\.git)?$/\1/')
            print_info "Detected repository: $REPO_PATH"
        else
            print_error "This doesn't appear to be a GitHub repository."
            exit 1
        fi
    else
        print_error "This script must be run from within a Git repository."
        exit 1
    fi
}

# Set up Docker Hub secrets
setup_docker_secrets() {
    echo ""
    print_info "Setting up Docker Hub secrets..."
    echo ""
    
    # Get Docker Hub username
    read -p "Enter your Docker Hub username: " DOCKER_USERNAME
    if [ -z "$DOCKER_USERNAME" ]; then
        print_error "Docker Hub username is required."
        exit 1
    fi
    
    # Get Docker Hub password/token
    echo ""
    print_info "For security, it's recommended to use a Docker Hub access token instead of your password."
    print_info "Create one at: https://hub.docker.com/settings/security"
    echo ""
    read -s -p "Enter your Docker Hub password or access token: " DOCKER_PASSWORD
    echo ""
    
    if [ -z "$DOCKER_PASSWORD" ]; then
        print_error "Docker Hub password/token is required."
        exit 1
    fi
    
    # Set the secrets
    print_info "Setting DOCKER_USERNAME secret..."
    echo "$DOCKER_USERNAME" | gh secret set DOCKER_USERNAME
    
    print_info "Setting DOCKER_PASSWORD secret..."
    echo "$DOCKER_PASSWORD" | gh secret set DOCKER_PASSWORD
    
    print_success "Docker Hub secrets configured successfully!"
}

# Verify secrets are set
verify_secrets() {
    echo ""
    print_info "Verifying secrets are set..."
    
    SECRETS=$(gh secret list --json name --jq '.[].name')
    
    if echo "$SECRETS" | grep -q "DOCKER_USERNAME"; then
        print_success "✓ DOCKER_USERNAME is set"
    else
        print_error "✗ DOCKER_USERNAME is not set"
    fi
    
    if echo "$SECRETS" | grep -q "DOCKER_PASSWORD"; then
        print_success "✓ DOCKER_PASSWORD is set"
    else
        print_error "✗ DOCKER_PASSWORD is not set"
    fi
    
    if echo "$SECRETS" | grep -q "GITHUB_TOKEN"; then
        print_success "✓ GITHUB_TOKEN is automatically provided"
    else
        print_warning "! GITHUB_TOKEN will be automatically provided by GitHub Actions"
    fi
}

# Test workflow trigger
test_workflow() {
    echo ""
    read -p "Would you like to test the CI/CD pipeline by triggering a workflow? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Triggering build-and-push-images workflow..."
        
        if gh workflow run build-and-push-images.yml; then
            print_success "Workflow triggered successfully!"
            echo ""
            print_info "You can monitor the workflow at:"
            echo "  https://github.com/$REPO_PATH/actions"
            echo ""
            print_info "Or use: gh run list"
        else
            print_error "Failed to trigger workflow. Please check your repository permissions."
        fi
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    print_info "🎉 Setup complete! Here's what you can do next:"
    echo ""
    echo "1. **Trigger builds automatically:**"
    echo "   git push origin main  # Triggers CI/CD pipeline"
    echo ""
    echo "2. **Create a release:**"
    echo "   gh release create v1.0.0 --title 'Release v1.0.0' --notes 'Initial release'"
    echo ""
    echo "3. **Manual workflow triggers:**"
    echo "   gh workflow run build-and-push-images.yml"
    echo "   gh workflow run update-configs-for-dockerhub.yml -f update_type=latest"
    echo ""
    echo "4. **Monitor workflows:**"
    echo "   gh run list"
    echo "   gh run view <run-id>"
    echo "5. **Check Docker Hub images:**"
    echo "   https://hub.docker.com/u/actyze"
    echo ""
    print_info "📖 For more details, see: .github/workflows/README.md"
}

# Main execution
main() {
    print_header
    
    check_gh_cli
    check_gh_auth
    get_repo_info
    setup_docker_secrets
    verify_secrets
    test_workflow
    show_next_steps
    
    echo ""
    print_success "GitHub Secrets setup completed successfully! 🚀"
}

# Help function
show_help() {
    echo "GitHub Secrets Setup Script for Dashboard CI/CD"
    echo ""
    echo "This script helps you configure the required secrets for the GitHub Actions workflows."
    echo ""
    echo "Required secrets:"
    echo "  DOCKER_USERNAME  - Your Docker Hub username"
    echo "  DOCKER_PASSWORD  - Your Docker Hub password or access token"
    echo "  GITHUB_TOKEN     - Automatically provided by GitHub Actions"
    echo ""
    echo "Prerequisites:"
    echo "  - GitHub CLI (gh) installed and authenticated"
    echo "  - Docker Hub account"
    echo "  - Repository push permissions"
    echo ""
    echo "Usage:"
    echo "  $0              # Interactive setup"
    echo "  $0 --help       # Show this help"
    echo ""
    echo "For more information, see: .github/workflows/README.md"
}

# Handle command line arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        main
        ;;
esac
