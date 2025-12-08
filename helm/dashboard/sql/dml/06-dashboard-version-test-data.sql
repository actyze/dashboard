-- =====================================================
-- Dashboard Versioning Test Data
-- =====================================================
-- Creates dashboards with multiple versions to demonstrate:
-- - Draft → Published lifecycle
-- - Multiple version snapshots
-- - Tile additions/modifications across versions
-- =====================================================

-- First, get the actual user IDs (assuming 05-test-dashboard-data.sql has been run)
DO $$
DECLARE
    v_alice_id UUID;
    v_bob_id UUID;
    v_carol_id UUID;
BEGIN
    SELECT id INTO v_alice_id FROM nexus.users WHERE username = 'alice.manager';
    SELECT id INTO v_bob_id FROM nexus.users WHERE username = 'bob.lead';
    SELECT id INTO v_carol_id FROM nexus.users WHERE username = 'carol.editor';
    
    IF v_alice_id IS NULL OR v_bob_id IS NULL OR v_carol_id IS NULL THEN
        RAISE EXCEPTION 'Test users not found. Run 05-test-dashboard-data.sql first.';
    END IF;
    
    -- Store in temp table for use in subsequent statements
    CREATE TEMP TABLE IF NOT EXISTS test_user_ids (
        username TEXT PRIMARY KEY,
        user_id UUID NOT NULL
    );
    
    TRUNCATE test_user_ids;
    
    INSERT INTO test_user_ids VALUES
        ('alice.manager', v_alice_id),
        ('bob.lead', v_bob_id),
        ('carol.editor', v_carol_id);
END $$;

-- Delete existing versioned test dashboards first
DELETE FROM nexus.dashboard_tiles WHERE dashboard_id IN (
    'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'cccccccc-3333-4444-8888-333333333333'::uuid,
    'dddddddd-4444-4444-8888-444444444444'::uuid
);
DELETE FROM nexus.dashboard_versions WHERE dashboard_id IN (
    'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'dddddddd-4444-4444-8888-444444444444'::uuid
);
DELETE FROM nexus.dashboards WHERE id IN (
    'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'cccccccc-3333-4444-8888-333333333333'::uuid,
    'dddddddd-4444-4444-8888-444444444444'::uuid
);

-- =====================================================
-- DASHBOARD 1: Sales Analytics Dashboard
-- 3 versions showing progressive improvement
-- =====================================================

INSERT INTO nexus.dashboards (
    id, title, description, configuration, layout_config,
    owner_user_id, is_public, status, tags,
    created_at, updated_at
) SELECT
    'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'Sales Analytics Dashboard',
    'Comprehensive sales metrics and trends',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    user_id, false, 'draft', '["sales", "analytics", "revenue"]'::jsonb,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
FROM test_user_ids WHERE username = 'alice.manager';

-- VERSION 1: Basic sales metrics (2 tiles)
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT 
    '11111111-1111-4444-8888-000000000001'::uuid, 'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'Total Revenue', 'Total revenue from all orders',
    'SELECT SUM(total_amount) as total_revenue FROM postgres.demo_ecommerce.orders',
    'indicator', '{"xField": "total_revenue", "yField": "total_revenue"}'::jsonb,
    0, 0, 6, 3, user_id, NOW() - INTERVAL '5 days'
FROM test_user_ids WHERE username = 'alice.manager'
UNION ALL SELECT 
    '11111111-1111-4444-8888-000000000002'::uuid, 'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'Orders by Status', 'Distribution of order statuses',
    'SELECT status, COUNT(*) as count FROM postgres.demo_ecommerce.orders GROUP BY status',
    'pie', '{"xField": "status", "yField": "count"}'::jsonb,
    6, 0, 6, 3, user_id, NOW() - INTERVAL '5 days'
FROM test_user_ids WHERE username = 'alice.manager';

-- Publish Version 1
DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        v_alice_id,
        'Initial version with basic revenue and status metrics'
    );
END $$;

-- VERSION 2: Add customer analysis
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description,
    sql_query, natural_language_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '11111111-1111-4444-8888-000000000003'::uuid, 'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'Top 10 Customers', 'Customers with highest total sales',
    'SELECT c.first_name || '' '' || c.last_name as customer_name, SUM(o.total_amount) as total_sales FROM postgres.demo_ecommerce.customers c JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id GROUP BY customer_name ORDER BY total_sales DESC LIMIT 10',
    'Show me top 10 customers by sales',
    'bar', '{"xField": "customer_name", "yField": "total_sales"}'::jsonb,
    0, 3, 12, 4, user_id, NOW() - INTERVAL '3 days'
FROM test_user_ids WHERE username = 'alice.manager';

-- Publish Version 2
DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        v_alice_id,
        'Added top customers analysis with bar chart'
    );
END $$;

-- VERSION 3: Add trend analysis
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description,
    sql_query, natural_language_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '11111111-1111-4444-8888-000000000004'::uuid, 'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
    'Daily Sales Trend', 'Sales trend over the last 30 days',
    'SELECT DATE(order_date) as date, SUM(total_amount) as revenue FROM postgres.demo_ecommerce.orders WHERE order_date >= CURRENT_DATE - INTERVAL ''30 days'' GROUP BY date ORDER BY date',
    'Show me daily sales for last 30 days',
    'line', '{"xField": "date", "yField": "revenue", "mode": "lines+markers"}'::jsonb,
    0, 7, 12, 4, user_id, NOW() - INTERVAL '1 day'
FROM test_user_ids WHERE username = 'alice.manager';

-- Publish Version 3
DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        v_alice_id,
        'Added daily sales trend analysis with line chart'
    );
END $$;

-- =====================================================
-- DASHBOARD 2: Product Performance Dashboard  
-- 2 versions - demonstrates tile modification
-- =====================================================

INSERT INTO nexus.dashboards (
    id, title, description, configuration, layout_config,
    owner_user_id, is_public, status, tags,
    created_at, updated_at
) SELECT
    'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'Product Performance Dashboard',
    'Track product sales and inventory',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    user_id, true, 'draft', '["products", "inventory"]'::jsonb,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'
FROM test_user_ids WHERE username = 'carol.editor';

-- VERSION 1: Initial product metrics (2 tiles)
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '22222222-2222-4444-8888-000000000001'::uuid, 'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'Products by Category',
    'SELECT category, COUNT(*) as product_count FROM postgres.demo_ecommerce.products GROUP BY category',
    'pie', '{"xField": "category", "yField": "product_count"}'::jsonb,
    0, 0, 6, 4, user_id, NOW() - INTERVAL '4 days'
FROM test_user_ids WHERE username = 'carol.editor'
UNION ALL SELECT
    '22222222-2222-4444-8888-000000000002'::uuid, 'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'Low Stock Products',
    'SELECT product_name, stock_quantity FROM postgres.demo_ecommerce.products WHERE stock_quantity < 10 ORDER BY stock_quantity LIMIT 10',
    'table', '{}'::jsonb,
    6, 0, 6, 4, user_id, NOW() - INTERVAL '4 days'
FROM test_user_ids WHERE username = 'carol.editor';

-- Publish Version 1
DO $$
DECLARE v_carol_id UUID;
BEGIN
    SELECT user_id INTO v_carol_id FROM test_user_ids WHERE username = 'carol.editor';
    PERFORM nexus.publish_dashboard(
        'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
        v_carol_id,
        'Initial product dashboard with category breakdown and low stock alerts'
    );
END $$;

-- VERSION 2: Update to bar chart and add revenue tile
UPDATE nexus.dashboard_tiles SET 
    chart_type = 'bar',
    chart_config = '{"xField": "category", "yField": "product_count", "orientation": "v"}'::jsonb,
    updated_at = NOW() - INTERVAL '2 days'
WHERE id = '22222222-2222-4444-8888-000000000001'::uuid;

INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '22222222-2222-4444-8888-000000000003'::uuid, 'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
    'Top Revenue Products', 'Products generating the most revenue',
    'SELECT p.product_name, SUM(oi.total_price) as revenue FROM postgres.demo_ecommerce.products p JOIN postgres.demo_ecommerce.order_items oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY revenue DESC LIMIT 10',
    'bar', '{"xField": "product_name", "yField": "revenue"}'::jsonb,
    0, 4, 12, 4, user_id, NOW() - INTERVAL '2 days'
FROM test_user_ids WHERE username = 'carol.editor';

-- Publish Version 2
DO $$
DECLARE v_carol_id UUID;
BEGIN
    SELECT user_id INTO v_carol_id FROM test_user_ids WHERE username = 'carol.editor';
    PERFORM nexus.publish_dashboard(
        'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
        v_carol_id,
        'Changed category chart to bar chart and added revenue by product analysis'
    );
END $$;

-- =====================================================
-- DASHBOARD 3: Draft Dashboard (Never Published)
-- Demonstrates draft-only workflow
-- =====================================================

INSERT INTO nexus.dashboards (
    id, title, description, configuration, layout_config,
    owner_user_id, is_public, status, tags,
    created_at, updated_at
) SELECT
    'cccccccc-3333-4444-8888-333333333333'::uuid,
    'Work in Progress Dashboard',
    'Still working on this - not ready for others yet',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    user_id, false, 'draft', '["wip", "draft"]'::jsonb,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour'
FROM test_user_ids WHERE username = 'bob.lead';

INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '33333333-3333-4444-8888-000000000001'::uuid, 'cccccccc-3333-4444-8888-333333333333'::uuid,
    'Employee Count by Department',
    'SELECT d.department_name, COUNT(e.employee_id) as count FROM postgres.demo_hrms.departments d LEFT JOIN postgres.demo_hrms.employees e ON d.department_id = e.department_id GROUP BY d.department_name',
    'bar', '{"xField": "department_name", "yField": "count"}'::jsonb,
    0, 0, 12, 4, user_id, NOW() - INTERVAL '1 day'
FROM test_user_ids WHERE username = 'bob.lead';

-- =====================================================
-- DASHBOARD 4: Multi-Version with Reverts
-- 4 versions showing complex edit history
-- =====================================================

INSERT INTO nexus.dashboards (
    id, title, description, configuration, layout_config,
    owner_user_id, is_public, status, tags,
    created_at, updated_at
) SELECT
    'dddddddd-4444-4444-8888-444444444444'::uuid,
    'Customer Insights Dashboard',
    'Deep dive into customer behavior and segmentation',
    '{}'::jsonb,
    '{"columns": 12, "rowHeight": 100, "compactType": "vertical"}'::jsonb,
    user_id, true, 'draft', '["customers", "insights", "segmentation"]'::jsonb,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
FROM test_user_ids WHERE username = 'alice.manager';

-- VERSION 1: Single customer table
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, sql_query,
    chart_type, position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '44444444-4444-4444-8888-000000000001'::uuid, 'dddddddd-4444-4444-8888-444444444444'::uuid,
    'All Customers',
    'SELECT customer_id, first_name, last_name, email, city, country FROM postgres.demo_ecommerce.customers LIMIT 20',
    'table', 0, 0, 12, 4, user_id, NOW() - INTERVAL '10 days'
FROM test_user_ids WHERE username = 'alice.manager';

DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'dddddddd-4444-4444-8888-444444444444'::uuid,
        v_alice_id,
        'Initial version - simple customer list'
    );
END $$;

-- VERSION 2: Add customer segmentation
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '44444444-4444-4444-8888-000000000002'::uuid, 'dddddddd-4444-4444-8888-444444444444'::uuid,
    'Customers by Segment', 'Distribution across customer segments',
    'SELECT customer_segment, COUNT(*) as count FROM postgres.demo_ecommerce.customers GROUP BY customer_segment',
    'donut', '{"xField": "customer_segment", "yField": "count"}'::jsonb,
    0, 4, 6, 4, user_id, NOW() - INTERVAL '8 days'
FROM test_user_ids WHERE username = 'alice.manager';

DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'dddddddd-4444-4444-8888-444444444444'::uuid,
        v_alice_id,
        'Added customer segmentation donut chart'
    );
END $$;

-- VERSION 3: Add geographic analysis
INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '44444444-4444-4444-8888-000000000003'::uuid, 'dddddddd-4444-4444-8888-444444444444'::uuid,
    'Customers by Country', 'Geographic distribution of customer base',
    'SELECT country, COUNT(*) as customer_count FROM postgres.demo_ecommerce.customers GROUP BY country ORDER BY customer_count DESC',
    'bar', '{"xField": "country", "yField": "customer_count", "orientation": "h"}'::jsonb,
    6, 4, 6, 4, user_id, NOW() - INTERVAL '6 days'
FROM test_user_ids WHERE username = 'alice.manager';

DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'dddddddd-4444-4444-8888-444444444444'::uuid,
        v_alice_id,
        'Added geographic distribution with horizontal bar chart'
    );
END $$;

-- VERSION 4: Update customer table and add monthly revenue
UPDATE nexus.dashboard_tiles SET 
    title = 'Customer Lifetime Value',
    sql_query = 'SELECT c.first_name || '' '' || c.last_name as customer, COUNT(o.order_id) as order_count, SUM(o.total_amount) as lifetime_value FROM postgres.demo_ecommerce.customers c LEFT JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id GROUP BY customer HAVING COUNT(o.order_id) > 0 ORDER BY lifetime_value DESC LIMIT 20',
    chart_type = 'scatter',
    chart_config = '{"xField": "order_count", "yField": "lifetime_value", "mode": "markers", "marker": {"size": 10}}'::jsonb,
    updated_at = NOW() - INTERVAL '4 days'
WHERE id = '44444444-4444-4444-8888-000000000001'::uuid;

INSERT INTO nexus.dashboard_tiles (
    id, dashboard_id, title, description, sql_query,
    chart_type, chart_config,
    position_x, position_y, width, height,
    created_by, created_at
) SELECT
    '44444444-4444-4444-8888-000000000004'::uuid, 'dddddddd-4444-4444-8888-444444444444'::uuid,
    'Monthly Revenue Trend', 'Revenue aggregated by month',
    'SELECT DATE_TRUNC(''month'', order_date)::DATE as month, SUM(total_amount) as revenue FROM postgres.demo_ecommerce.orders GROUP BY month ORDER BY month',
    'area', '{"xField": "month", "yField": "revenue"}'::jsonb,
    0, 8, 12, 4, user_id, NOW() - INTERVAL '4 days'
FROM test_user_ids WHERE username = 'alice.manager';

DO $$
DECLARE v_alice_id UUID;
BEGIN
    SELECT user_id INTO v_alice_id FROM test_user_ids WHERE username = 'alice.manager';
    PERFORM nexus.publish_dashboard(
        'dddddddd-4444-4444-8888-444444444444'::uuid,
        v_alice_id,
        'Major update: Changed customer list to LTV scatter plot, added monthly revenue trend'
    );
END $$;

-- =====================================================
-- Summary Report
-- =====================================================

DO $$
DECLARE
    v_dashboard_count INTEGER;
    v_version_count INTEGER;
    v_tile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_dashboard_count FROM nexus.dashboards 
    WHERE id IN (
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
        'cccccccc-3333-4444-8888-333333333333'::uuid,
        'dddddddd-4444-4444-8888-444444444444'::uuid
    );
    
    SELECT COUNT(*) INTO v_version_count FROM nexus.dashboard_versions 
    WHERE dashboard_id IN (
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
        'dddddddd-4444-4444-8888-444444444444'::uuid
    );
    
    SELECT COUNT(*) INTO v_tile_count FROM nexus.dashboard_tiles 
    WHERE dashboard_id IN (
        'aaaaaaaa-1111-4444-8888-111111111111'::uuid,
        'bbbbbbbb-2222-4444-8888-222222222222'::uuid,
        'cccccccc-3333-4444-8888-333333333333'::uuid,
        'dddddddd-4444-4444-8888-444444444444'::uuid
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Dashboard Versioning Test Data Created';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Dashboards Created: % (3 published, 1 draft)', v_dashboard_count;
    RAISE NOTICE 'Version Snapshots: %', v_version_count;
    RAISE NOTICE 'Total Tiles: %', v_tile_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Dashboard 1 (Sales Analytics): 3 versions';
    RAISE NOTICE '  - V1: 2 tiles (revenue indicator + status pie)';
    RAISE NOTICE '  - V2: 3 tiles (added top customers bar chart)';
    RAISE NOTICE '  - V3: 4 tiles (added daily trend line chart)';
    RAISE NOTICE '';
    RAISE NOTICE 'Dashboard 2 (Product Performance): 2 versions';
    RAISE NOTICE '  - V1: 2 tiles (category pie + low stock table)';
    RAISE NOTICE '  - V2: 3 tiles (changed pie to bar + added revenue)';
    RAISE NOTICE '';
    RAISE NOTICE 'Dashboard 3 (WIP): DRAFT ONLY (no versions)';
    RAISE NOTICE '  - 1 tile (employee count) - visible only to Bob';
    RAISE NOTICE '';
    RAISE NOTICE 'Dashboard 4 (Customer Insights): 4 versions';
    RAISE NOTICE '  - V1: 1 tile (customer table)';
    RAISE NOTICE '  - V2: 2 tiles (added segmentation donut)';
    RAISE NOTICE '  - V3: 3 tiles (added geographic bar chart)';
    RAISE NOTICE '  - V4: 4 tiles (changed table to LTV scatter, added monthly trend)';
    RAISE NOTICE '=================================================';
END $$;

DROP TABLE IF EXISTS test_user_ids;
