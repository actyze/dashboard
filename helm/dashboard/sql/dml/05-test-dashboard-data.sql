-- Test Data for Dashboards, Users, Roles, Groups, and Permissions
-- Creates a realistic test environment with varied access patterns

SET search_path TO nexus, public;

-- =============================================================================
-- TEST USERS
-- =============================================================================
-- Password for all test users: 'password123' (hashed)
-- Note: nexus_admin already exists as SUPERADMIN from security enhancements

-- 1. Alice - ADMIN (scoped admin access)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'alice.manager', 'alice@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Alice Manager', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'alice.manager');

-- 2. Bob - EDITOR (team lead)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'bob.lead', 'bob@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Bob Lead', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'bob.lead');

-- 3. Carol - EDITOR (can create/edit dashboards)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'carol.editor', 'carol@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Carol Editor', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'carol.editor');

-- 4. David - VIEWER (read-only)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'david.viewer', 'david@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'David Viewer', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'david.viewer');

-- 5. Eve - EDITOR (sales team)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'eve.sales', 'eve@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Eve Sales', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'eve.sales');

-- 6. Frank - VIEWER (finance team)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) 
SELECT 'frank.finance', 'frank@dashboard.com', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Frank Finance', true
WHERE NOT EXISTS (SELECT 1 FROM nexus.users WHERE LOWER(username) = 'frank.finance');

-- =============================================================================
-- ASSIGN ROLES TO USERS
-- =============================================================================

-- Alice → ADMIN
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'alice.manager' AND LOWER(r.name) = 'admin'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Bob → EDITOR
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'bob.lead' AND LOWER(r.name) = 'editor'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Carol → EDITOR
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'carol.editor' AND LOWER(r.name) = 'editor'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- David → VIEWER
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'david.viewer' AND LOWER(r.name) = 'viewer'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Eve → EDITOR
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'eve.sales' AND LOWER(r.name) = 'editor'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Frank → VIEWER
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE LOWER(u.username) = 'frank.finance' AND LOWER(r.name) = 'viewer'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- =============================================================================
-- TEST GROUPS
-- =============================================================================

-- Sales Team
INSERT INTO nexus.groups (name, description) 
SELECT 'Sales Team', 'Sales department members'
WHERE NOT EXISTS (SELECT 1 FROM nexus.groups WHERE LOWER(name) = 'sales team');

-- Finance Team
INSERT INTO nexus.groups (name, description) 
SELECT 'Finance Team', 'Finance department members'
WHERE NOT EXISTS (SELECT 1 FROM nexus.groups WHERE LOWER(name) = 'finance team');

-- Executive Team
INSERT INTO nexus.groups (name, description) 
SELECT 'Executive Team', 'C-level executives'
WHERE NOT EXISTS (SELECT 1 FROM nexus.groups WHERE LOWER(name) = 'executive team');

-- =============================================================================
-- ASSIGN USERS TO GROUPS
-- =============================================================================

-- Eve → Sales Team
INSERT INTO nexus.user_groups (user_id, group_id)
SELECT u.id, g.id
FROM nexus.users u, nexus.groups g
WHERE LOWER(u.username) = 'eve.sales' AND LOWER(g.name) = 'sales team'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_groups ug WHERE ug.user_id = u.id AND ug.group_id = g.id);

-- Frank → Finance Team
INSERT INTO nexus.user_groups (user_id, group_id)
SELECT u.id, g.id
FROM nexus.users u, nexus.groups g
WHERE LOWER(u.username) = 'frank.finance' AND LOWER(g.name) = 'finance team'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_groups ug WHERE ug.user_id = u.id AND ug.group_id = g.id);

-- Alice & Bob → Executive Team
INSERT INTO nexus.user_groups (user_id, group_id)
SELECT u.id, g.id
FROM nexus.users u, nexus.groups g
WHERE LOWER(u.username) IN ('alice.manager', 'bob.lead') AND LOWER(g.name) = 'executive team'
  AND NOT EXISTS (SELECT 1 FROM nexus.user_groups ug WHERE ug.user_id = u.id AND ug.group_id = g.id);

-- =============================================================================
-- TEST DASHBOARDS
-- =============================================================================

-- Dashboard 1: Sales Overview (owned by Eve, shared with Sales Team)
INSERT INTO nexus.dashboards (id, title, description, configuration, layout_config, owner_user_id, is_public, tags)
SELECT 
    gen_random_uuid(),
    'Sales Overview Q4 2024',
    'Comprehensive sales metrics for Q4 2024',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    u.id,
    false,
    '["sales", "q4", "2024"]'::jsonb
FROM nexus.users u
WHERE LOWER(u.username) = 'eve.sales'
  AND NOT EXISTS (SELECT 1 FROM nexus.dashboards WHERE title = 'Sales Overview Q4 2024');

-- Dashboard 2: Finance Dashboard (owned by Frank, private)
INSERT INTO nexus.dashboards (id, title, description, configuration, layout_config, owner_user_id, is_public, tags)
SELECT 
    gen_random_uuid(),
    'Finance Dashboard',
    'Financial metrics and KPIs',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    u.id,
    false,
    '["finance", "kpi"]'::jsonb
FROM nexus.users u
WHERE LOWER(u.username) = 'frank.finance'
  AND NOT EXISTS (SELECT 1 FROM nexus.dashboards WHERE title = 'Finance Dashboard');

-- Dashboard 3: Executive Dashboard (owned by Alice, public)
INSERT INTO nexus.dashboards (id, title, description, configuration, layout_config, owner_user_id, is_public, tags, is_favorite)
SELECT 
    gen_random_uuid(),
    'Executive Dashboard',
    'High-level company metrics for executives',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    u.id,
    true,
    '["executive", "overview"]'::jsonb,
    true
FROM nexus.users u
WHERE LOWER(u.username) = 'alice.manager'
  AND NOT EXISTS (SELECT 1 FROM nexus.dashboards WHERE title = 'Executive Dashboard');

-- Dashboard 4: Product Analytics (owned by Carol)
INSERT INTO nexus.dashboards (id, title, description, configuration, layout_config, owner_user_id, is_public, tags)
SELECT 
    gen_random_uuid(),
    'Product Analytics',
    'Product performance and trends',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    u.id,
    false,
    '["products", "analytics"]'::jsonb
FROM nexus.users u
WHERE LOWER(u.username) = 'carol.editor'
  AND NOT EXISTS (SELECT 1 FROM nexus.dashboards WHERE title = 'Product Analytics');

-- =============================================================================
-- DASHBOARD TILES
-- =============================================================================

-- Tiles for Sales Overview Dashboard
DO $$
DECLARE
    v_dashboard_id UUID;
    v_user_id UUID;
BEGIN
    -- Get dashboard and user IDs
    SELECT d.id INTO v_dashboard_id FROM nexus.dashboards d WHERE d.title = 'Sales Overview Q4 2024';
    SELECT u.id INTO v_user_id FROM nexus.users u WHERE LOWER(u.username) = 'eve.sales';
    
    IF v_dashboard_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- Tile 1: Top Products
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id, title, description, sql_query, natural_language_query,
            chart_type, chart_config, position_x, position_y, width, height, created_by
        )
        SELECT 
            v_dashboard_id,
            'Top 10 Products by Revenue',
            'Best selling products this quarter',
            'SELECT p.product_name, SUM(oi.total_price) as revenue FROM postgres.demo_ecommerce.order_items oi JOIN postgres.demo_ecommerce.products p ON oi.product_id = p.product_id GROUP BY p.product_name ORDER BY revenue DESC LIMIT 10',
            'show top 10 products by revenue',
            'bar',
            '{"colors": ["#3b82f6"], "orientation": "vertical"}'::jsonb,
            0, 0, 6, 4,
            v_user_id
        WHERE NOT EXISTS (SELECT 1 FROM nexus.dashboard_tiles WHERE title = 'Top 10 Products by Revenue');
        
        -- Tile 2: Daily Sales Trend
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id, title, description, sql_query, natural_language_query,
            chart_type, chart_config, position_x, position_y, width, height, created_by
        )
        SELECT 
            v_dashboard_id,
            'Daily Sales Trend',
            'Revenue trend over time',
            'SELECT DATE(order_date) as date, SUM(total_amount) as revenue FROM postgres.demo_ecommerce.orders GROUP BY DATE(order_date) ORDER BY date',
            'show daily revenue trend',
            'line',
            '{"colors": ["#10b981"], "smooth": true}'::jsonb,
            6, 0, 6, 4,
            v_user_id
        WHERE NOT EXISTS (SELECT 1 FROM nexus.dashboard_tiles WHERE title = 'Daily Sales Trend');
        
        -- Tile 3: Top Customers
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id, title, description, sql_query,
            chart_type, chart_config, position_x, position_y, width, height, created_by
        )
        SELECT 
            v_dashboard_id,
            'Top 5 Customers',
            'Highest spending customers',
            'SELECT c.first_name || '' '' || c.last_name as customer, SUM(o.total_amount) as total_spent FROM postgres.demo_ecommerce.customers c JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id GROUP BY customer ORDER BY total_spent DESC LIMIT 5',
            'pie',
            '{"colors": ["#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]}'::jsonb,
            0, 4, 4, 4,
            v_user_id
        WHERE NOT EXISTS (SELECT 1 FROM nexus.dashboard_tiles WHERE title = 'Top 5 Customers');
    END IF;
END $$;

-- Tiles for Executive Dashboard
DO $$
DECLARE
    v_dashboard_id UUID;
    v_user_id UUID;
BEGIN
    SELECT d.id INTO v_dashboard_id FROM nexus.dashboards d WHERE d.title = 'Executive Dashboard';
    SELECT u.id INTO v_user_id FROM nexus.users u WHERE LOWER(u.username) = 'alice.manager';
    
    IF v_dashboard_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- KPI: Total Revenue
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id, title, sql_query, chart_type, chart_config, 
            position_x, position_y, width, height, created_by
        )
        SELECT 
            v_dashboard_id,
            'Total Revenue',
            'SELECT SUM(total_amount) as value FROM postgres.demo_ecommerce.orders',
            'indicator',
            '{"mode": "number+delta", "prefix": "$", "valueformat": ".2f"}'::jsonb,
            0, 0, 3, 2,
            v_user_id
        WHERE NOT EXISTS (SELECT 1 FROM nexus.dashboard_tiles WHERE dashboard_id = v_dashboard_id AND title = 'Total Revenue');
        
        -- KPI: Total Orders
        INSERT INTO nexus.dashboard_tiles (
            dashboard_id, title, sql_query, chart_type, chart_config,
            position_x, position_y, width, height, created_by
        )
        SELECT 
            v_dashboard_id,
            'Total Orders',
            'SELECT COUNT(*) as value FROM postgres.demo_ecommerce.orders',
            'indicator',
            '{"mode": "number"}'::jsonb,
            3, 0, 3, 2,
            v_user_id
        WHERE NOT EXISTS (SELECT 1 FROM nexus.dashboard_tiles WHERE dashboard_id = v_dashboard_id AND title = 'Total Orders');
    END IF;
END $$;

-- =============================================================================
-- DASHBOARD PERMISSIONS (RBAC)
-- =============================================================================

-- Sales Dashboard → shared with Sales Team (view + edit)
DO $$
DECLARE
    v_dashboard_id UUID;
    v_group_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT d.id, d.owner_user_id INTO v_dashboard_id, v_owner_id 
    FROM nexus.dashboards d WHERE d.title = 'Sales Overview Q4 2024';
    
    SELECT g.id INTO v_group_id FROM nexus.groups g WHERE LOWER(g.name) = 'sales team';
    
    IF v_dashboard_id IS NOT NULL AND v_group_id IS NOT NULL THEN
        INSERT INTO nexus.dashboard_permissions (
            dashboard_id, group_id, can_view, can_edit, can_delete, can_share, granted_by
        )
        SELECT v_dashboard_id, v_group_id, true, true, false, false, v_owner_id
        WHERE NOT EXISTS (
            SELECT 1 FROM nexus.dashboard_permissions 
            WHERE dashboard_id = v_dashboard_id AND group_id = v_group_id
        );
    END IF;
END $$;

-- Product Analytics → shared with Carol's team lead (Bob) for review
DO $$
DECLARE
    v_dashboard_id UUID;
    v_bob_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT d.id, d.owner_user_id INTO v_dashboard_id, v_owner_id 
    FROM nexus.dashboards d WHERE d.title = 'Product Analytics';
    
    SELECT u.id INTO v_bob_id FROM nexus.users u WHERE LOWER(u.username) = 'bob.lead';
    
    IF v_dashboard_id IS NOT NULL AND v_bob_id IS NOT NULL THEN
        INSERT INTO nexus.dashboard_permissions (
            dashboard_id, user_id, can_view, can_edit, can_delete, can_share, granted_by
        )
        SELECT v_dashboard_id, v_bob_id, true, true, false, true, v_owner_id
        WHERE NOT EXISTS (
            SELECT 1 FROM nexus.dashboard_permissions 
            WHERE dashboard_id = v_dashboard_id AND user_id = v_bob_id
        );
    END IF;
END $$;

-- Finance Dashboard → shared with Executive Team (view only)
DO $$
DECLARE
    v_dashboard_id UUID;
    v_group_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT d.id, d.owner_user_id INTO v_dashboard_id, v_owner_id 
    FROM nexus.dashboards d WHERE d.title = 'Finance Dashboard';
    
    SELECT g.id INTO v_group_id FROM nexus.groups g WHERE LOWER(g.name) = 'executive team';
    
    IF v_dashboard_id IS NOT NULL AND v_group_id IS NOT NULL THEN
        INSERT INTO nexus.dashboard_permissions (
            dashboard_id, group_id, can_view, can_edit, can_delete, can_share, granted_by
        )
        SELECT v_dashboard_id, v_group_id, true, false, false, false, v_owner_id
        WHERE NOT EXISTS (
            SELECT 1 FROM nexus.dashboard_permissions 
            WHERE dashboard_id = v_dashboard_id AND group_id = v_group_id
        );
    END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show created users and roles
SELECT 
    u.username,
    u.full_name,
    STRING_AGG(r.name, ', ') as roles
FROM nexus.users u
JOIN nexus.user_roles ur ON u.id = ur.user_id
JOIN nexus.roles r ON ur.role_id = r.id
WHERE u.username IN ('nexus_admin', 'alice.manager', 'bob.lead', 'carol.editor', 'david.viewer', 'eve.sales', 'frank.finance')
GROUP BY u.username, u.full_name
ORDER BY u.username;

-- Show groups and members
SELECT 
    g.name as group_name,
    STRING_AGG(u.username, ', ') as members
FROM nexus.groups g
LEFT JOIN nexus.user_groups ug ON g.id = ug.group_id
LEFT JOIN nexus.users u ON ug.user_id = u.id
WHERE g.name IN ('Sales Team', 'Finance Team', 'Executive Team')
GROUP BY g.name
ORDER BY g.name;

-- Show dashboards with tile counts
SELECT 
    d.title,
    u.username as owner,
    d.is_public,
    COUNT(dt.id) as tile_count,
    d.tags
FROM nexus.dashboards d
LEFT JOIN nexus.users u ON d.owner_user_id = u.id
LEFT JOIN nexus.dashboard_tiles dt ON d.id = dt.dashboard_id
GROUP BY d.title, u.username, d.is_public, d.tags
ORDER BY d.title;

-- Show dashboard permissions
SELECT 
    d.title as dashboard,
    COALESCE(u.username, g.name) as granted_to,
    CASE WHEN dp.user_id IS NOT NULL THEN 'User' ELSE 'Group' END as type,
    dp.can_view, dp.can_edit, dp.can_delete, dp.can_share
FROM nexus.dashboard_permissions dp
JOIN nexus.dashboards d ON dp.dashboard_id = d.id
LEFT JOIN nexus.users u ON dp.user_id = u.id
LEFT JOIN nexus.groups g ON dp.group_id = g.id
ORDER BY d.title, type, COALESCE(u.username, g.name);

