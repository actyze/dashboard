#!/bin/bash

# ============================================================================
# Dashboard Versioning & Publishing API Test Script
# ============================================================================
# Tests draft/published status, version history, and revert functionality

set -e  # Exit on error

BASE_URL="http://localhost:8000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test users (password: admin for all)
ALICE_TOKEN=""
BOB_TOKEN=""
CAROL_TOKEN=""
DAVID_TOKEN=""

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Dashboard Versioning API Tests${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Helper function to print test result
print_result() {
    local test_name=$1
    local result=$2
    local details=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo -e "  ${RED}Details: $details${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Helper function to login and get token
login() {
    local username=$1
    local password=$2
    
    response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$username&password=$password")
    
    token=$(echo "$response" | jq -r '.access_token')
    echo "$token"
}

# ============================================================================
# 1. AUTHENTICATION
# ============================================================================

echo -e "${YELLOW}1. Authentication Tests${NC}"
echo "-------------------------------------------"

# Login as alice.manager (ADMIN)
ALICE_TOKEN=$(login "alice.manager" "admin")
if [ -n "$ALICE_TOKEN" ] && [ "$ALICE_TOKEN" != "null" ]; then
    print_result "Login as alice.manager" "PASS"
else
    print_result "Login as alice.manager" "FAIL" "Token: $ALICE_TOKEN"
    exit 1
fi

# Login as bob.lead (EDITOR)
BOB_TOKEN=$(login "bob.lead" "admin")
if [ -n "$BOB_TOKEN" ] && [ "$BOB_TOKEN" != "null" ]; then
    print_result "Login as bob.lead" "PASS"
else
    print_result "Login as bob.lead" "FAIL" "Token: $BOB_TOKEN"
fi

# Login as carol.editor (EDITOR)
CAROL_TOKEN=$(login "carol.editor" "admin")
if [ -n "$CAROL_TOKEN" ] && [ "$CAROL_TOKEN" != "null" ]; then
    print_result "Login as carol.editor" "PASS"
else
    print_result "Login as carol.editor" "FAIL" "Token: $CAROL_TOKEN"
fi

# Login as david.viewer (VIEWER)
DAVID_TOKEN=$(login "david.viewer" "admin")
if [ -n "$DAVID_TOKEN" ] && [ "$DAVID_TOKEN" != "null" ]; then
    print_result "Login as david.viewer" "PASS"
else
    print_result "Login as david.viewer" "FAIL" "Token: $DAVID_TOKEN"
fi

echo ""

# ============================================================================
# 2. CREATE DRAFT DASHBOARD
# ============================================================================

echo -e "${YELLOW}2. Draft Dashboard Tests${NC}"
echo "-------------------------------------------"

# Create a new draft dashboard (default status)
DRAFT_DASHBOARD=$(curl -s -X POST "$BASE_URL/api/dashboards" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Test Version Dashboard",
        "description": "Testing versioning features",
        "is_public": false
    }')

DRAFT_DASHBOARD_ID=$(echo "$DRAFT_DASHBOARD" | jq -r '.dashboard.id')

if [ -n "$DRAFT_DASHBOARD_ID" ] && [ "$DRAFT_DASHBOARD_ID" != "null" ]; then
    print_result "Create draft dashboard (Alice)" "PASS"
else
    print_result "Create draft dashboard (Alice)" "FAIL" "Response: $DRAFT_DASHBOARD"
fi

# Check status is 'draft'
DASHBOARD_STATUS=$(echo "$DRAFT_DASHBOARD" | jq -r '.dashboard.status')
if [ "$DASHBOARD_STATUS" = "draft" ]; then
    print_result "Default status is 'draft'" "PASS"
else
    print_result "Default status is 'draft'" "FAIL" "Got: $DASHBOARD_STATUS"
fi

# Add a tile to the dashboard
TILE1=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/tiles" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Customer Sales v1",
        "sql_query": "SELECT first_name, last_name, SUM(total_amount) as total FROM postgres.demo_ecommerce.customers c JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id GROUP BY first_name, last_name LIMIT 5",
        "chart_type": "table",
        "position_x": 0,
        "position_y": 0,
        "width": 6,
        "height": 4
    }')

TILE1_ID=$(echo "$TILE1" | jq -r '.tile.id')
if [ -n "$TILE1_ID" ] && [ "$TILE1_ID" != "null" ]; then
    print_result "Add tile to draft dashboard" "PASS"
else
    print_result "Add tile to draft dashboard" "FAIL"
fi

# Try to view draft dashboard as another user (should fail - drafts only visible to owner)
OTHER_USER_VIEW=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID" \
    -H "Authorization: Bearer $DAVID_TOKEN")

OTHER_USER_ERROR=$(echo "$OTHER_USER_VIEW" | jq -r '.detail // .error // "no error"')
if [[ "$OTHER_USER_ERROR" == *"not found"* ]] || [[ "$OTHER_USER_ERROR" == *"access denied"* ]]; then
    print_result "Draft dashboard hidden from other users" "PASS"
else
    print_result "Draft dashboard hidden from other users" "FAIL" "Should not be accessible by David"
fi

# Owner should still see it
OWNER_VIEW=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID" \
    -H "Authorization: Bearer $ALICE_TOKEN")

OWNER_CAN_VIEW=$(echo "$OWNER_VIEW" | jq -r '.success')
if [ "$OWNER_CAN_VIEW" = "true" ]; then
    print_result "Draft dashboard visible to owner" "PASS"
else
    print_result "Draft dashboard visible to owner" "FAIL"
fi

echo ""

# ============================================================================
# 3. PUBLISH DASHBOARD (Create Version 1)
# ============================================================================

echo -e "${YELLOW}3. Publish Dashboard Tests${NC}"
echo "-------------------------------------------"

# Publish the dashboard
PUBLISH_V1=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/publish" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "version_notes": "Initial version with customer sales table"
    }')

PUBLISHED_VERSION=$(echo "$PUBLISH_V1" | jq -r '.version')
if [ "$PUBLISHED_VERSION" = "1" ]; then
    print_result "Publish dashboard - version 1 created" "PASS"
else
    print_result "Publish dashboard - version 1 created" "FAIL" "Got version: $PUBLISHED_VERSION"
fi

# Check status changed to 'published'
PUBLISHED_STATUS=$(echo "$PUBLISH_V1" | jq -r '.status')
if [ "$PUBLISHED_STATUS" = "published" ]; then
    print_result "Status changed to 'published'" "PASS"
else
    print_result "Status changed to 'published'" "FAIL" "Got: $PUBLISHED_STATUS"
fi

# Now other users should be able to see it (if it's public or they have permissions)
sleep 1

# Make dashboard public so others can see it
curl -s -X PUT "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"is_public": true}' > /dev/null

# David (viewer) should now see the published dashboard
DAVID_VIEW=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID" \
    -H "Authorization: Bearer $DAVID_TOKEN")

DAVID_CAN_VIEW=$(echo "$DAVID_VIEW" | jq -r '.success')
if [ "$DAVID_CAN_VIEW" = "true" ]; then
    print_result "Published dashboard visible to other users" "PASS"
else
    print_result "Published dashboard visible to other users" "FAIL"
fi

echo ""

# ============================================================================
# 4. MODIFY DASHBOARD & PUBLISH VERSION 2
# ============================================================================

echo -e "${YELLOW}4. Version History Tests${NC}"
echo "-------------------------------------------"

# Modify the dashboard (update tile)
curl -s -X PUT "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/tiles/$TILE1_ID" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Customer Sales v2 - Bar Chart",
        "chart_type": "bar"
    }' > /dev/null

# Add another tile
TILE2=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/tiles" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Daily Sales Trend",
        "sql_query": "SELECT DATE(order_date) as date, SUM(total_amount) as revenue FROM postgres.demo_ecommerce.orders GROUP BY date ORDER BY date LIMIT 10",
        "chart_type": "line",
        "position_x": 6,
        "position_y": 0,
        "width": 6,
        "height": 4
    }')

# Publish version 2
PUBLISH_V2=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/publish" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "version_notes": "Added line chart and changed sales table to bar chart"
    }')

PUBLISHED_VERSION_2=$(echo "$PUBLISH_V2" | jq -r '.version')
if [ "$PUBLISHED_VERSION_2" = "2" ]; then
    print_result "Publish dashboard - version 2 created" "PASS"
else
    print_result "Publish dashboard - version 2 created" "FAIL" "Got version: $PUBLISHED_VERSION_2"
fi

# Get version history
VERSIONS=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/versions" \
    -H "Authorization: Bearer $ALICE_TOKEN")

VERSION_COUNT=$(echo "$VERSIONS" | jq -r '.total')
if [ "$VERSION_COUNT" = "2" ]; then
    print_result "Version history shows 2 versions" "PASS"
else
    print_result "Version history shows 2 versions" "FAIL" "Got: $VERSION_COUNT versions"
fi

# Check version 1 has correct tile count
V1_TILES=$(echo "$VERSIONS" | jq -r '.versions[] | select(.version == 1) | .tiles_count')
if [ "$V1_TILES" = "1" ]; then
    print_result "Version 1 has 1 tile (snapshot correct)" "PASS"
else
    print_result "Version 1 has 1 tile (snapshot correct)" "FAIL" "Got: $V1_TILES tiles"
fi

# Check version 2 has correct tile count
V2_TILES=$(echo "$VERSIONS" | jq -r '.versions[] | select(.version == 2) | .tiles_count')
if [ "$V2_TILES" = "2" ]; then
    print_result "Version 2 has 2 tiles (snapshot correct)" "PASS"
else
    print_result "Version 2 has 2 tiles (snapshot correct)" "FAIL" "Got: $V2_TILES tiles"
fi

echo ""

# ============================================================================
# 5. REVERT TO VERSION 1
# ============================================================================

echo -e "${YELLOW}5. Revert Version Tests${NC}"
echo "-------------------------------------------"

# Revert to version 1
REVERT=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/revert/1" \
    -H "Authorization: Bearer $ALICE_TOKEN")

REVERT_SUCCESS=$(echo "$REVERT" | jq -r '.success')
if [ "$REVERT_SUCCESS" = "true" ]; then
    print_result "Revert to version 1" "PASS"
else
    print_result "Revert to version 1" "FAIL" "Response: $REVERT"
fi

# Check dashboard now has only 1 tile
sleep 1
CURRENT_TILES=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/tiles" \
    -H "Authorization: Bearer $ALICE_TOKEN")

CURRENT_TILE_COUNT=$(echo "$CURRENT_TILES" | jq -r '.tiles | length')
if [ "$CURRENT_TILE_COUNT" = "1" ]; then
    print_result "After revert - dashboard has 1 tile" "PASS"
else
    print_result "After revert - dashboard has 1 tile" "FAIL" "Got: $CURRENT_TILE_COUNT tiles"
fi

# Check status is back to 'draft' after revert
CURRENT_DASHBOARD=$(curl -s -X GET "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID" \
    -H "Authorization: Bearer $ALICE_TOKEN")

CURRENT_STATUS=$(echo "$CURRENT_DASHBOARD" | jq -r '.dashboard.status')
if [ "$CURRENT_STATUS" = "draft" ]; then
    print_result "After revert - status is 'draft'" "PASS"
else
    print_result "After revert - status is 'draft'" "FAIL" "Got: $CURRENT_STATUS"
fi

echo ""

# ============================================================================
# 6. PERMISSION TESTS
# ============================================================================

echo -e "${YELLOW}6. Permission Tests${NC}"
echo "-------------------------------------------"

# Try to publish as a viewer (should fail)
VIEWER_PUBLISH=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/publish" \
    -H "Authorization: Bearer $DAVID_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"version_notes": "Attempt by viewer"}')

VIEWER_ERROR=$(echo "$VIEWER_PUBLISH" | jq -r '.detail // .error // "no error"')
if [[ "$VIEWER_ERROR" == *"Permission denied"* ]] || [[ "$VIEWER_ERROR" == *"Operation not permitted"* ]] || [[ "$VIEWER_ERROR" == *"not permitted"* ]]; then
    print_result "Viewer cannot publish dashboard" "PASS"
else
    print_result "Viewer cannot publish dashboard" "FAIL" "Should have been denied. Got: $VIEWER_ERROR"
fi

# Editor should be able to publish
EDITOR_PUBLISH=$(curl -s -X POST "$BASE_URL/api/dashboards/$DRAFT_DASHBOARD_ID/publish" \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"version_notes": "Published by editor"}')

EDITOR_PUBLISH_SUCCESS=$(echo "$EDITOR_PUBLISH" | jq -r '.success')
if [ "$EDITOR_PUBLISH_SUCCESS" = "true" ]; then
    print_result "Editor can publish dashboard" "PASS"
else
    print_result "Editor can publish dashboard" "FAIL"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
else
    echo -e "Failed:       0"
fi
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi

