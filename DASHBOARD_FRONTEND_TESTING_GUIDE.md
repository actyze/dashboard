# Dashboard Frontend Testing Guide

## 🎯 Overview
This guide covers comprehensive testing of the newly integrated Dashboard CRUD functionality with the backend API.

## 📋 Test Credentials
Use any of the test users created in the DML scripts:

| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| `nexus_admin` | `admin` | SUPERADMIN | Full access to all dashboards |
| `alice.manager` | `admin` | ADMIN | Full access to all dashboards |
| `bob.lead` | `admin` | EDITOR | Can create/edit/delete own dashboards |
| `carol.editor` | `admin` | EDITOR | Can create/edit/delete own dashboards |
| `david.viewer` | `admin` | VIEWER | Read-only access |
| `eve.sales` | `admin` | EDITOR (Sales Team) | Sales Team dashboards |
| `frank.finance` | `admin` | VIEWER (Finance Team) | Finance Team dashboards (read-only) |

## 🌐 Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📝 Test Scenarios

### 1. Dashboard List View (`/dashboards`)

#### Test 1.1: View Dashboards
1. Login as `nexus_admin`
2. Navigate to Dashboards page
3. **Expected**:
   - Should see 4 dashboards (Executive, Finance, Product Analytics, Sales Overview)
   - Each dashboard shows: title, description, tile count, last accessed, last updated
   - Public dashboards have a "Public" badge
   - Favorite dashboards have a yellow star icon
   - Delete button visible only for dashboards with `can_delete` permission

#### Test 1.2: Tab Filtering
1. Click "Recent" tab
2. **Expected**: Only dashboards accessed in the last 7 days
3. Click "All dashboards" tab
4. **Expected**: All accessible dashboards shown

#### Test 1.3: Search Functionality
1. Type "Finance" in search box
2. **Expected**: Only "Finance Dashboard" is shown
3. Clear search
4. **Expected**: All dashboards return

#### Test 1.4: RBAC - Viewer Access
1. Logout and login as `david.viewer`
2. **Expected**:
   - Can see public dashboards
   - Cannot delete any dashboards (no delete buttons)
   - Can view dashboards but not edit

#### Test 1.5: Create New Dashboard
1. Login as `alice.manager`
2. Click "+ Dashboard" button
3. **Expected**:
   - Redirected to new dashboard (e.g., `/dashboard/new`)
   - Empty dashboard with "Add Tiles to get started" message
   - Dashboard created with default title "New Dashboard"

### 2. Dashboard View (`/dashboard/:id`)

#### Test 2.1: View Existing Dashboard
1. Login as `nexus_admin`
2. Click on "Executive Dashboard"
3. **Expected**:
   - Dashboard title and description shown
   - Existing tiles displayed (if any)
   - "New Tile" button visible
   - Back button to return to dashboard list

#### Test 2.2: Empty Dashboard
1. Navigate to a new dashboard (or one with no tiles)
2. **Expected**:
   - Empty state with colorful icons
   - Message: "Add Tiles to get started"
   - "New Tile" button prominent

### 3. Tile CRUD Operations

#### Test 3.1: Create Table Tile
1. In a dashboard, click "+ New Tile"
2. Fill in form:
   - **Title**: `Top 10 Customers`
   - **Description**: `Customers with highest sales`
   - **Visualization**: `Table`
   - **SQL Query**:
     ```sql
     SELECT c.first_name, c.last_name, c.email, SUM(o.total_amount) as total_sales
     FROM postgres.demo_ecommerce.customers c
     JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id
     GROUP BY c.customer_id, c.first_name, c.last_name, c.email
     ORDER BY total_sales DESC
     LIMIT 10
     ```
3. Click "Create Tile"
4. **Expected**:
   - Tile appears in dashboard
   - SQL executes automatically
   - Data displayed in table format
   - Loading indicator while query executes

#### Test 3.2: Create Bar Chart Tile
1. Click "+ New Tile"
2. Fill in form:
   - **Title**: `Monthly Sales`
   - **Description**: `Sales by month`
   - **Visualization**: `Bar Chart`
   - **SQL Query**:
     ```sql
     SELECT 
       DATE_FORMAT(order_date, '%Y-%m') as month,
       SUM(total_amount) as revenue
     FROM postgres.demo_ecommerce.orders
     WHERE order_date >= DATE '2024-01-01'
     GROUP BY month
     ORDER BY month
     ```
3. Click "Create Tile"
4. **Expected**:
   - Bar chart renders with data
   - X-axis: months, Y-axis: revenue
   - Chart is interactive (Plotly.js features)

#### Test 3.3: Create Multiple Chart Types
Repeat Test 3.2 with different visualization types:
- Line Chart
- Pie Chart
- Area Chart
- Scatter Plot
- Heatmap
- Box Plot
- Histogram
- Funnel Chart

**Expected**: Each chart type renders correctly with appropriate data

#### Test 3.4: Edit Tile
1. Click the "⋮" menu on a tile
2. Select "Edit"
3. Change the title to `Top 20 Customers`
4. Update LIMIT to 20 in SQL
5. Click "Update Tile"
6. **Expected**:
   - Tile updates with new title
   - Query re-executes with new limit
   - Data refreshes

#### Test 3.5: Refresh Tile
1. Click the "⋮" menu on a tile
2. Select "Refresh"
3. **Expected**:
   - Loading indicator appears
   - Query re-executes
   - Data updates (even if unchanged)

#### Test 3.6: Delete Tile
1. Click the "⋮" menu on a tile
2. Select "Delete"
3. Confirm deletion
4. **Expected**:
   - Tile removed from dashboard
   - No errors

#### Test 3.7: Tile Error Handling
1. Create a tile with invalid SQL:
   ```sql
   SELECT * FROM nonexistent_table
   ```
2. **Expected**:
   - Tile shows error icon
   - Error message displayed in tile
   - Other tiles unaffected

### 4. Dashboard Deletion

#### Test 4.1: Delete Dashboard (with Permission)
1. Login as `alice.manager` (ADMIN)
2. Go to Dashboards list
3. Click delete button on a dashboard she owns
4. Confirm deletion
5. **Expected**:
   - Confirmation dialog appears
   - Dashboard deleted from list
   - Success (no errors)

#### Test 4.2: Delete Dashboard (without Permission)
1. Login as `david.viewer`
2. Go to Dashboards list
3. **Expected**:
   - No delete buttons visible on dashboards
   - Cannot delete any dashboards

### 5. Responsive Behavior

#### Test 5.1: Grid Layout
1. View dashboard with multiple tiles
2. **Expected**:
   - Tiles arranged in 12-column grid
   - On desktop: tiles side-by-side (width=6 means half-width)
   - On mobile: tiles stack vertically

#### Test 5.2: Auto-positioning
1. Create 3 tiles in sequence
2. **Expected**:
   - First tile: position (0, 0)
   - Second tile: position (0, 4) [below first]
   - Third tile: position (0, 8) [below second]

### 6. Error Handling

#### Test 6.1: Dashboard Not Found
1. Navigate to `/dashboard/nonexistent-id`
2. **Expected**:
   - Error message: "Failed to load dashboard"
   - "Back to Dashboards" button

#### Test 6.2: API Failure
1. Stop Nexus service: `docker compose stop nexus`
2. Try to load dashboards
3. **Expected**:
   - Error message displayed
   - Graceful fallback (no crash)
4. Restart Nexus: `docker compose up -d nexus`

### 7. Date Formatting

#### Test 7.1: Relative Time Display
1. View dashboard list
2. **Expected**:
   - "Last Accessed" shows relative time (e.g., "2m ago", "3h ago", "2d ago")
   - "Last Updated" shows relative time
   - Invalid dates (pre-2000) show "N/A"

### 8. Public/Private Dashboards

#### Test 8.1: Public Dashboard Badge
1. View dashboard list
2. **Expected**:
   - Public dashboards have green "Public" badge
   - Private dashboards have purple icon (no badge)

#### Test 8.2: Anonymous Public Access
1. **Logout** from the app
2. Navigate to http://localhost:8000/api/public/dashboards
3. **Expected**:
   - JSON response with public dashboards
   - "Executive Dashboard" visible (it's marked as `anonymous_public`)

## 🐛 Common Issues & Fixes

### Issue: "Can't resolve 'date-fns'"
**Fix**: Already resolved. `date-fns` added to package.json

### Issue: "Can't resolve 'react-router-dom'"
**Fix**: Already resolved. Using `react-router` v7 (no separate dom package)

### Issue: Tiles not loading
**Check**:
1. Nexus service is running: `docker compose ps nexus`
2. Database has tables: `docker exec -it dashboard-postgres psql -U nexus_service -d dashboard -c "\dt nexus.*"`
3. Check Nexus logs: `docker compose logs nexus | tail -50`

### Issue: Charts not rendering
**Check**:
1. SQL query returns data
2. Chart config has required fields (x_column, y_column for bar/line)
3. Browser console for errors (F12)

## 📊 Test Data Summary

From `05-test-dashboard-data.sql`:
- **4 Dashboards**: Executive, Finance, Product Analytics, Sales Overview
- **Test Users**: 7 users with varied roles and permissions
- **Test Groups**: Executive Team, Finance Team, Sales Team
- **Permissions**: Mixed user/group permissions across dashboards

## ✅ Success Criteria

All tests should pass with:
- ✅ No console errors (except expected warnings)
- ✅ All API calls return 200/201 status codes
- ✅ RBAC enforced correctly (viewers can't delete, etc.)
- ✅ Data displays correctly in tables and charts
- ✅ Responsive layout works on different screen sizes
- ✅ Error states handled gracefully

## 📞 Next Steps After Testing

If all tests pass:
1. Commit remaining changes (if any)
2. Push to main branch
3. Document any issues found
4. Consider adding automated E2E tests (Playwright/Cypress)

If issues found:
1. Document the issue with steps to reproduce
2. Check browser console and network tab
3. Check backend logs: `docker compose logs nexus`
4. Report to development team with details

