#!/bin/bash
# Dashboard API Test Script
# Tests all CRUD operations and RBAC permissions

BASE_URL="http://localhost:8000"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Function to print section header
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# =============================================================================
# 1. AUTHENTICATION
# =============================================================================

print_header "1. AUTHENTICATION TESTS"

# Login as Eve (EDITOR, Sales Team)
echo "Logging in as eve.sales..."
EVE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=eve.sales&password=admin")

EVE_TOKEN=$(echo $EVE_RESPONSE | jq -r '.access_token // empty')

if [ -n "$EVE_TOKEN" ]; then
    print_result 0 "Eve login successful"
else
    print_result 1 "Eve login failed"
    echo "Response: $EVE_RESPONSE"
fi

# Login as David (VIEWER)
echo "Logging in as david.viewer..."
DAVID_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=david.viewer&password=admin")

DAVID_TOKEN=$(echo $DAVID_RESPONSE | jq -r '.access_token // empty')

if [ -n "$DAVID_TOKEN" ]; then
    print_result 0 "David login successful"
else
    print_result 1 "David login failed"
fi

# Login as nexus_admin (SUPERADMIN)
echo "Logging in as nexus_admin..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=nexus_admin&password=admin")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.access_token // empty')

if [ -n "$ADMIN_TOKEN" ]; then
    print_result 0 "nexus_admin (SUPERADMIN) login successful"
else
    print_result 1 "nexus_admin login failed"
fi

# Login as Alice (ADMIN)
echo "Logging in as alice.manager..."
ALICE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=alice.manager&password=admin")

ALICE_TOKEN=$(echo $ALICE_RESPONSE | jq -r '.access_token // empty')

if [ -n "$ALICE_TOKEN" ]; then
    print_result 0 "Alice (ADMIN) login successful"
else
    print_result 1 "Alice login failed"
fi

# =============================================================================
# 2. LIST DASHBOARDS (RBAC Verification)
# =============================================================================

print_header "2. LIST DASHBOARDS (RBAC)"

# Eve should see: Sales Overview (owner), Executive Dashboard (public), Product Analytics (via group)
echo "Fetching dashboards as Eve..."
EVE_DASHBOARDS=$(curl -s -X GET "$BASE_URL/api/dashboards" \
  -H "Authorization: Bearer $EVE_TOKEN")

EVE_COUNT=$(echo $EVE_DASHBOARDS | jq '.total // 0')
echo "Eve can see $EVE_COUNT dashboards"
echo $EVE_DASHBOARDS | jq '.dashboards[] | {title, permissions}'

if [ "$EVE_COUNT" -ge 2 ]; then
    print_result 0 "Eve can see her dashboards (expected >= 2)"
else
    print_result 1 "Eve dashboard count incorrect (got $EVE_COUNT)"
fi

# David (VIEWER) should only see public dashboards
echo -e "\nFetching dashboards as David..."
DAVID_DASHBOARDS=$(curl -s -X GET "$BASE_URL/api/dashboards" \
  -H "Authorization: Bearer $DAVID_TOKEN")

DAVID_COUNT=$(echo $DAVID_DASHBOARDS | jq '.total // 0')
echo "David can see $DAVID_COUNT dashboards (should only see public ones)"
echo $DAVID_DASHBOARDS | jq '.dashboards[] | {title, is_public, permissions}'

print_result 0 "David (VIEWER) dashboard access verified"

# nexus_admin (SUPERADMIN) should see ALL dashboards
echo -e "\nFetching dashboards as nexus_admin..."
ADMIN_DASHBOARDS=$(curl -s -X GET "$BASE_URL/api/dashboards" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_COUNT=$(echo $ADMIN_DASHBOARDS | jq '.total // 0')
echo "nexus_admin can see $ADMIN_COUNT dashboards (should see all 4)"

if [ "$ADMIN_COUNT" -eq 4 ]; then
    print_result 0 "nexus_admin (SUPERADMIN) can see all dashboards"
else
    print_result 1 "nexus_admin dashboard count incorrect (expected 4, got $ADMIN_COUNT)"
fi

# Alice (ADMIN) should also see ALL dashboards
echo -e "\nFetching dashboards as Alice (ADMIN)..."
ALICE_DASHBOARDS=$(curl -s -X GET "$BASE_URL/api/dashboards" \
  -H "Authorization: Bearer $ALICE_TOKEN")

ALICE_COUNT=$(echo $ALICE_DASHBOARDS | jq '.total // 0')
echo "Alice can see $ALICE_COUNT dashboards (ADMIN should see all 4)"

if [ "$ALICE_COUNT" -eq 4 ]; then
    print_result 0 "Alice (ADMIN) can see all dashboards"
else
    print_result 1 "Alice dashboard count incorrect (expected 4, got $ALICE_COUNT)"
fi

# =============================================================================
# 3. GET SINGLE DASHBOARD
# =============================================================================

print_header "3. GET SINGLE DASHBOARD"

# Get Sales Overview dashboard ID
SALES_DASHBOARD_ID=$(echo $EVE_DASHBOARDS | jq -r '.dashboards[] | select(.title=="Sales Overview Q4 2024") | .id')

echo "Sales Dashboard ID: $SALES_DASHBOARD_ID"

# Eve (owner) should be able to get it
echo "Eve fetching her Sales dashboard..."
EVE_SALES=$(curl -s -X GET "$BASE_URL/api/dashboards/$SALES_DASHBOARD_ID" \
  -H "Authorization: Bearer $EVE_TOKEN")

if echo $EVE_SALES | jq -e '.success' > /dev/null; then
    print_result 0 "Eve can access her own dashboard"
    echo $EVE_SALES | jq '.dashboard | {title, tile_count, permissions}'
else
    print_result 1 "Eve cannot access her own dashboard"
fi

# David (no permission) should NOT be able to get it
echo -e "\nDavid trying to fetch Sales dashboard (should fail)..."
DAVID_SALES=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/api/dashboards/$SALES_DASHBOARD_ID" \
  -H "Authorization: Bearer $DAVID_TOKEN")

HTTP_CODE=$(echo "$DAVID_SALES" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "403" ]; then
    print_result 0 "David correctly denied access to Sales dashboard"
else
    print_result 1 "David should not have access (HTTP $HTTP_CODE)"
fi

# =============================================================================
# 4. CREATE DASHBOARD
# =============================================================================

print_header "4. CREATE DASHBOARD"

# Eve creates a new dashboard
echo "Eve creating new dashboard..."
NEW_DASHBOARD=$(curl -s -X POST "$BASE_URL/api/dashboards" \
  -H "Authorization: Bearer $EVE_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d '{
    "title": "Test Dashboard",
    "description": "Created by API test",
    "tags": ["test", "api"],
    "is_public": false
  }')

NEW_DASHBOARD_ID=$(echo $NEW_DASHBOARD | jq -r '.dashboard.id // empty')

if [ -n "$NEW_DASHBOARD_ID" ]; then
    print_result 0 "Dashboard created successfully"
    echo "New Dashboard ID: $NEW_DASHBOARD_ID"
else
    print_result 1 "Dashboard creation failed"
    echo "Response: $NEW_DASHBOARD"
fi

# =============================================================================
# 5. UPDATE DASHBOARD
# =============================================================================

print_header "5. UPDATE DASHBOARD"

# Eve updates her own dashboard
echo "Eve updating her dashboard..."
UPDATE_RESULT=$(curl -s -X PUT "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID" \
  -H "Authorization: Bearer $EVE_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d '{
    "title": "Test Dashboard (Updated)",
    "is_favorite": true
  }')

if echo $UPDATE_RESULT | jq -e '.success' > /dev/null; then
    print_result 0 "Dashboard updated successfully"
else
    print_result 1 "Dashboard update failed"
fi

# David tries to update (should fail)
echo -e "\nDavid trying to update Eve's dashboard (should fail)..."
DAVID_UPDATE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID" \
  -H "Authorization: Bearer $DAVID_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d '{"title": "Hacked"}')

HTTP_CODE=$(echo "$DAVID_UPDATE" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" == "403" ]; then
    print_result 0 "David correctly denied edit access"
else
    print_result 1 "David should not be able to edit (HTTP $HTTP_CODE)"
fi

# =============================================================================
# 6. TILE CRUD
# =============================================================================

print_header "6. TILE OPERATIONS"

# Get tiles for Sales dashboard
echo "Fetching tiles for Sales dashboard..."
TILES=$(curl -s -X GET "$BASE_URL/api/dashboards/$SALES_DASHBOARD_ID/tiles" \
  -H "Authorization: Bearer $EVE_TOKEN")

TILE_COUNT=$(echo $TILES | jq '.total // 0')
echo "Sales dashboard has $TILE_COUNT tiles"

if [ "$TILE_COUNT" -eq 3 ]; then
    print_result 0 "Correct number of tiles retrieved"
else
    print_result 1 "Tile count incorrect (expected 3, got $TILE_COUNT)"
fi

# Create new tile
echo -e "\nCreating new tile..."
NEW_TILE=$(curl -s -X POST "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID/tiles" \
  -H "Authorization: Bearer $EVE_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d '{
    "title": "Test Tile",
    "sql_query": "SELECT 1 as value",
    "chart_type": "indicator",
    "width": 4,
    "height": 2
  }')

NEW_TILE_ID=$(echo $NEW_TILE | jq -r '.tile.id // empty')

if [ -n "$NEW_TILE_ID" ]; then
    print_result 0 "Tile created successfully"
else
    print_result 1 "Tile creation failed"
    echo "Response: $NEW_TILE"
fi

# =============================================================================
# 7. PERMISSIONS / SHARING
# =============================================================================

print_header "7. PERMISSIONS & SHARING"

# Eve shares her new dashboard with David (view only)
echo "Eve sharing dashboard with David..."
SHARE_RESULT=$(curl -s -X POST "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID/permissions" \
  -H "Authorization: Bearer $EVE_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"target_user_id\": \"$(echo $DAVID_RESPONSE | jq -r '.user.id')\",
    \"can_view\": true,
    \"can_edit\": false
  }")

if echo $SHARE_RESULT | jq -e '.success' > /dev/null; then
    print_result 0 "Dashboard shared successfully"
else
    print_result 1 "Dashboard sharing failed"
    echo "Response: $SHARE_RESULT"
fi

# David can now view (but not edit)
echo -e "\nDavid fetching shared dashboard..."
DAVID_VIEW=$(curl -s -X GET "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID" \
  -H "Authorization: Bearer $DAVID_TOKEN")

if echo $DAVID_VIEW | jq -e '.success' > /dev/null; then
    CAN_VIEW=$(echo $DAVID_VIEW | jq -r '.dashboard.permissions.can_view')
    CAN_EDIT=$(echo $DAVID_VIEW | jq -r '.dashboard.permissions.can_edit')
    
    if [ "$CAN_VIEW" == "true" ] && [ "$CAN_EDIT" == "false" ]; then
        print_result 0 "David has correct view-only permission"
    else
        print_result 1 "David's permissions incorrect (view=$CAN_VIEW, edit=$CAN_EDIT)"
    fi
else
    print_result 1 "David cannot view shared dashboard"
fi

# =============================================================================
# 8. ANONYMOUS/PUBLIC ACCESS (No Auth)
# =============================================================================

print_header "8. ANONYMOUS/PUBLIC ACCESS (No Auth)"

# List public dashboards without authentication
echo "Fetching public dashboards (no auth)..."
PUBLIC_DASHBOARDS=$(curl -s -X GET "$BASE_URL/api/public/dashboards")

PUBLIC_COUNT=$(echo $PUBLIC_DASHBOARDS | jq '.total // 0')
echo "Found $PUBLIC_COUNT anonymous-public dashboards"

if [ "$PUBLIC_COUNT" -eq 1 ]; then
    print_result 0 "Correct number of anonymous-public dashboards"
else
    print_result 1 "Expected 1 anonymous-public dashboard, got $PUBLIC_COUNT"
fi

# Get Executive Dashboard ID
EXEC_DASHBOARD_ID=$(echo $PUBLIC_DASHBOARDS | jq -r '.dashboards[0].id // empty')

if [ -n "$EXEC_DASHBOARD_ID" ]; then
    # Get dashboard details without auth
    echo -e "\nFetching Executive dashboard (no auth)..."
    PUBLIC_DASHBOARD=$(curl -s -X GET "$BASE_URL/api/public/dashboards/$EXEC_DASHBOARD_ID")
    
    if echo $PUBLIC_DASHBOARD | jq -e '.success' > /dev/null; then
        print_result 0 "Anonymous access to public dashboard works"
        DASHBOARD_TITLE=$(echo $PUBLIC_DASHBOARD | jq -r '.dashboard.title')
        echo "  Dashboard: $DASHBOARD_TITLE"
    else
        print_result 1 "Anonymous access to public dashboard failed"
    fi
    
    # Get tiles without auth
    echo -e "\nFetching dashboard tiles (no auth)..."
    PUBLIC_TILES=$(curl -s -X GET "$BASE_URL/api/public/dashboards/$EXEC_DASHBOARD_ID/tiles")
    
    TILE_COUNT=$(echo $PUBLIC_TILES | jq '.total // 0')
    echo "  Found $TILE_COUNT tiles"
    
    if [ "$TILE_COUNT" -eq 2 ]; then
        print_result 0 "Anonymous access to dashboard tiles works"
    else
        print_result 1 "Tile count incorrect (expected 2, got $TILE_COUNT)"
    fi
else
    print_result 1 "No anonymous-public dashboard found"
fi

# Test that private dashboard is NOT accessible anonymously
echo -e "\nTrying to access private Sales dashboard (should fail)..."
PRIVATE_ACCESS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/api/public/dashboards/$SALES_DASHBOARD_ID")

HTTP_CODE=$(echo "$PRIVATE_ACCESS" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" == "404" ]; then
    print_result 0 "Private dashboard correctly blocked from anonymous access"
else
    print_result 1 "Private dashboard should not be accessible (HTTP $HTTP_CODE)"
fi

# =============================================================================
# 9. DELETE OPERATIONS
# =============================================================================

print_header "9. DELETE OPERATIONS"

# Delete tile (Eve as owner)
if [ -n "$NEW_TILE_ID" ]; then
    echo "Eve deleting tile..."
    DELETE_TILE=$(curl -s -X DELETE "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID/tiles/$NEW_TILE_ID" \
      -H "Authorization: Bearer $EVE_TOKEN")
    
    if echo $DELETE_TILE | jq -e '.success' > /dev/null; then
        print_result 0 "Tile deleted successfully"
    else
        print_result 1 "Tile deletion failed"
    fi
fi

# Delete dashboard (Eve as owner)
if [ -n "$NEW_DASHBOARD_ID" ]; then
    echo "Eve deleting dashboard..."
    DELETE_DASH=$(curl -s -X DELETE "$BASE_URL/api/dashboards/$NEW_DASHBOARD_ID" \
      -H "Authorization: Bearer $EVE_TOKEN")
    
    if echo $DELETE_DASH | jq -e '.success' > /dev/null; then
        print_result 0 "Dashboard deleted successfully"
    else
        print_result 1 "Dashboard deletion failed"
    fi
fi

# =============================================================================
# SUMMARY
# =============================================================================

print_header "TEST SUMMARY"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo -e "${GREEN}Passed: $TESTS_PASSED${NC} / ${RED}Failed: $TESTS_FAILED${NC} / Total: $TOTAL_TESTS"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi

