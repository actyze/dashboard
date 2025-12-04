-- Extended Demo Data Generation
-- Generates ~2000+ records for realistic testing and demonstrations
-- Uses PostgreSQL generate_series and random functions for efficient bulk insertion

-- =============================================================================
-- CONFIGURATION
-- =============================================================================
-- Set random seed for reproducible data (optional - comment out for true random)
-- SELECT setseed(0.42);

-- =============================================================================
-- E-COMMERCE EXTENDED DATA
-- =============================================================================

-- Generate 2000 additional customers
INSERT INTO demo_ecommerce.customers (first_name, last_name, email, phone, address, city, state, country, postal_code, customer_segment, registration_date)
SELECT
    (ARRAY['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Christopher',
           'Mary','Patricia','Jennifer','Linda','Elizabeth','Barbara','Susan','Jessica','Sarah','Karen',
           'Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua','Kenneth',
           'Nancy','Betty','Margaret','Sandra','Ashley','Kimberly','Emily','Donna','Michelle','Dorothy',
           'Brian','George','Timothy','Ronald','Edward','Jason','Jeffrey','Ryan','Jacob','Gary',
           'Helen','Samantha','Katherine','Christine','Deborah','Rachel','Carolyn','Janet','Catherine','Maria',
           'Kevin','Eric','Stephen','Larry','Justin','Scott','Brandon','Benjamin','Samuel','Gregory',
           'Lisa','Nicole','Amy','Anna','Melissa','Angela','Stephanie','Rebecca','Laura','Sharon',
           'Alexander','Patrick','Frank','Raymond','Jack','Dennis','Jerry','Tyler','Aaron','Jose',
           'Diane','Virginia','Julie','Joyce','Victoria','Kelly','Christina','Lauren','Frances','Martha'])[1 + (random() * 99)::int] as first_name,
    (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
           'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
           'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
           'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
           'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
           'Turner','Phillips','Evans','Parker','Edwards','Collins','Stewart','Morris','Murphy','Cook'])[1 + (random() * 59)::int] as last_name,
    'customer_' || i || '_' || substr(md5(random()::text), 1, 6) || '@email.com' as email,
    '+1-555-' || lpad((1000 + i)::text, 4, '0') as phone,
    (100 + (random() * 9900)::int)::text || ' ' || 
    (ARRAY['Main','Oak','Pine','Elm','Maple','Cedar','Birch','Walnut','Cherry','Spruce'])[1 + (random() * 9)::int] || ' ' ||
    (ARRAY['St','Ave','Blvd','Dr','Ln','Way','Rd','Ct','Pl','Cir'])[1 + (random() * 9)::int] as address,
    (ARRAY['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose',
           'Austin','Jacksonville','Fort Worth','Columbus','Charlotte','San Francisco','Indianapolis','Seattle','Denver','Boston',
           'Nashville','Detroit','Portland','Memphis','Oklahoma City','Las Vegas','Louisville','Baltimore','Milwaukee','Albuquerque'])[1 + (random() * 29)::int] as city,
    (ARRAY['NY','CA','IL','TX','AZ','PA','TX','CA','TX','CA','TX','FL','TX','OH','NC','CA','IN','WA','CO','MA',
           'TN','MI','OR','TN','OK','NV','KY','MD','WI','NM'])[1 + (random() * 29)::int] as state,
    'USA' as country,
    lpad((10000 + (random() * 89999)::int)::text, 5, '0') as postal_code,
    (ARRAY['Regular','Premium','VIP','Regular','Regular','Premium','Regular','Regular','VIP','Premium'])[1 + (random() * 9)::int] as customer_segment,
    (CURRENT_DATE - ((random() * 730)::int || ' days')::interval)::date as registration_date
FROM generate_series(11, 2010) as i
ON CONFLICT (email) DO NOTHING;

-- Generate 100 additional products
INSERT INTO demo_ecommerce.products (product_name, category, subcategory, brand, price, cost, stock_quantity, description)
SELECT
    (ARRAY['Premium','Pro','Ultra','Elite','Classic','Essential','Deluxe','Advanced','Smart','Basic'])[1 + (random() * 9)::int] || ' ' ||
    (ARRAY['Wireless','Bluetooth','USB','Ergonomic','Portable','Digital','HD','4K','LED','Solar'])[1 + (random() * 9)::int] || ' ' ||
    (ARRAY['Headphones','Speaker','Keyboard','Mouse','Monitor','Charger','Cable','Stand','Case','Mat',
           'Watch','Tracker','Camera','Lamp','Fan','Bottle','Bag','Chair','Desk','Tool'])[1 + (random() * 19)::int] as product_name,
    (ARRAY['Electronics','Home & Kitchen','Sports & Fitness','Fashion','Office','Health','Toys','Automotive','Garden','Books'])[1 + (random() * 9)::int] as category,
    (ARRAY['Audio','Accessories','Appliances','Footwear','Lighting','Storage','Fitness','Decor','Tools','General'])[1 + (random() * 9)::int] as subcategory,
    (ARRAY['TechPro','HomeMax','FitLife','StyleCo','OfficePlus','HealthFirst','PlayTime','AutoGear','GardenPro','ReadMore',
           'SoundWave','SmartHome','ActiveGear','FashionHub','WorkEase','WellBeing','FunZone','DriveMax','GreenThumb','BookWorm'])[1 + (random() * 19)::int] as brand,
    (19.99 + (random() * 480)::numeric(10,2))::numeric(10,2) as price,
    (9.99 + (random() * 200)::numeric(10,2))::numeric(10,2) as cost,
    (10 + (random() * 490)::int) as stock_quantity,
    'High-quality product with excellent features and durability. Perfect for everyday use.' as description
FROM generate_series(11, 110) as i
ON CONFLICT DO NOTHING;

-- Generate ~6000 orders (3 per customer) using valid customer IDs
INSERT INTO demo_ecommerce.orders (customer_id, order_date, status, total_amount, shipping_cost, tax_amount, discount_amount, payment_method, shipping_address)
SELECT
    c.customer_id,
    (CURRENT_DATE - ((random() * 365)::int || ' days')::interval + ((random() * 86400)::int || ' seconds')::interval)::timestamp as order_date,
    (ARRAY['Delivered','Delivered','Delivered','Delivered','Shipped','Shipped','Processing','Processing','Cancelled','Pending'])[1 + (random() * 9)::int] as status,
    (29.99 + (random() * 470)::numeric(10,2))::numeric(10,2) as total_amount,
    (ARRAY[0.00, 4.99, 5.99, 7.99, 9.99, 12.99, 0.00, 5.99, 7.99, 9.99])[1 + (random() * 9)::int]::numeric(10,2) as shipping_cost,
    (2.00 + (random() * 48)::numeric(10,2))::numeric(10,2) as tax_amount,
    (ARRAY[0.00, 0.00, 0.00, 5.00, 10.00, 15.00, 0.00, 0.00, 20.00, 25.00])[1 + (random() * 9)::int]::numeric(10,2) as discount_amount,
    (ARRAY['Credit Card','Credit Card','Credit Card','PayPal','PayPal','Debit Card','Debit Card','Apple Pay','Google Pay','Bank Transfer'])[1 + (random() * 9)::int] as payment_method,
    c.address || ', ' || c.city || ', ' || c.state as shipping_address
FROM demo_ecommerce.customers c
CROSS JOIN generate_series(1, 3) as orders_per_customer;

-- Reset sequence for orders
SELECT setval('demo_ecommerce.orders_order_id_seq', (SELECT COALESCE(MAX(order_id), 1) FROM demo_ecommerce.orders));

-- Generate order items (1-3 items per order)
INSERT INTO demo_ecommerce.order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT
    o.order_id,
    p.product_id,
    (1 + (random() * 3)::int) as quantity,
    p.price as unit_price,
    (p.price * (1 + (random() * 3)::int))::numeric(10,2) as total_price
FROM demo_ecommerce.orders o
CROSS JOIN LATERAL (
    SELECT product_id, price 
    FROM demo_ecommerce.products 
    ORDER BY random() 
    LIMIT (1 + (random() * 2)::int)
) p
WHERE o.order_id > 10;

-- Update order totals based on actual items
UPDATE demo_ecommerce.orders o
SET total_amount = COALESCE(
    (SELECT SUM(total_price) FROM demo_ecommerce.order_items WHERE order_id = o.order_id), 
    o.total_amount
)
WHERE o.order_id > 10;

-- =============================================================================
-- HRMS EXTENDED DATA
-- =============================================================================

-- Generate 200 additional employees
INSERT INTO demo_hrms.employees (first_name, last_name, email, phone, hire_date, job_title, department_id, salary, manager_id, status)
SELECT
    (ARRAY['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Christopher',
           'Mary','Patricia','Jennifer','Linda','Elizabeth','Barbara','Susan','Jessica','Sarah','Karen',
           'Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua','Kenneth'])[1 + (random() * 29)::int] as first_name,
    (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
           'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'])[1 + (random() * 19)::int] as last_name,
    'employee_' || i || '_' || substr(md5(random()::text), 1, 6) || '@company.com' as email,
    '+1-555-' || lpad((2000 + i)::text, 4, '0') as phone,
    (CURRENT_DATE - ((365 + random() * 1825)::int || ' days')::interval)::date as hire_date,
    (ARRAY['Software Engineer','Senior Software Engineer','Product Manager','Data Analyst','Marketing Specialist',
           'Sales Representative','HR Coordinator','Financial Analyst','Customer Support','QA Engineer',
           'DevOps Engineer','UX Designer','Business Analyst','Technical Writer','Project Manager'])[1 + (random() * 14)::int] as job_title,
    (1 + (random() * 7)::int) as department_id,
    (55000 + (random() * 145000)::int)::numeric(10,2) as salary,
    (1 + (random() * 14)::int) as manager_id,
    (ARRAY['Active','Active','Active','Active','Active','Active','Active','Active','Active','On Leave'])[1 + (random() * 9)::int] as status
FROM generate_series(16, 215) as i
ON CONFLICT (email) DO NOTHING;

-- Generate attendance records for last 30 days
INSERT INTO demo_hrms.attendance (employee_id, date, check_in_time, check_out_time, hours_worked, status)
SELECT
    e.employee_id,
    d.date,
    CASE WHEN random() > 0.1 THEN ('08:' || lpad((random() * 59)::int::text, 2, '0') || ':00')::time ELSE NULL END as check_in_time,
    CASE WHEN random() > 0.1 THEN ('17:' || lpad((random() * 59)::int::text, 2, '0') || ':00')::time ELSE NULL END as check_out_time,
    CASE WHEN random() > 0.1 THEN (7.5 + random())::numeric(4,2) ELSE 0 END as hours_worked,
    (ARRAY['Present','Present','Present','Present','Present','Present','Present','Present','Sick Leave','Vacation'])[1 + (random() * 9)::int] as status
FROM demo_hrms.employees e
CROSS JOIN (
    SELECT generate_series(CURRENT_DATE - interval '30 days', CURRENT_DATE, interval '1 day')::date as date
) d
WHERE EXTRACT(DOW FROM d.date) NOT IN (0, 6)  -- Exclude weekends
AND e.employee_id <= 50  -- Limit to first 50 employees for manageable data
ON CONFLICT DO NOTHING;

-- =============================================================================
-- ANALYTICS EXTENDED DATA
-- =============================================================================

-- Generate monthly sales for last 24 months
INSERT INTO demo_analytics.monthly_sales (year, month, total_orders, total_revenue, total_customers, avg_order_value)
SELECT
    EXTRACT(YEAR FROM d)::int as year,
    EXTRACT(MONTH FROM d)::int as month,
    (100 + (random() * 400)::int) as total_orders,
    (10000 + (random() * 90000)::numeric(10,2))::numeric(12,2) as total_revenue,
    (50 + (random() * 200)::int) as total_customers,
    (80 + (random() * 70)::numeric(10,2))::numeric(10,2) as avg_order_value
FROM generate_series(
    CURRENT_DATE - interval '24 months',
    CURRENT_DATE,
    interval '1 month'
) as d
ON CONFLICT (year, month) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    total_customers = EXCLUDED.total_customers,
    avg_order_value = EXCLUDED.avg_order_value;

-- Update product performance with aggregated data
INSERT INTO demo_analytics.product_performance (product_id, product_name, category, total_sold, total_revenue, avg_rating)
SELECT 
    p.product_id,
    p.product_name,
    p.category,
    COALESCE(SUM(oi.quantity), 0)::int as total_sold,
    COALESCE(SUM(oi.total_price), 0)::numeric(12,2) as total_revenue,
    (3.5 + random() * 1.5)::numeric(3,2) as avg_rating
FROM demo_ecommerce.products p
LEFT JOIN demo_ecommerce.order_items oi ON p.product_id = oi.product_id
WHERE p.product_id > 10
GROUP BY p.product_id, p.product_name, p.category
ON CONFLICT (product_id) DO UPDATE SET
    total_sold = EXCLUDED.total_sold,
    total_revenue = EXCLUDED.total_revenue,
    avg_rating = EXCLUDED.avg_rating;

-- =============================================================================
-- REFRESH MATERIALIZED VIEWS (if they exist)
-- =============================================================================

-- Refresh views - wrapped in DO block to handle if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'product_sales_summary_mv' AND schemaname = 'demo_ecommerce') THEN
        REFRESH MATERIALIZED VIEW demo_ecommerce.product_sales_summary_mv;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not refresh materialized views: %', SQLERRM;
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- This script generates:
-- - ~2000 customers
-- - ~100 products  
-- - ~5000 orders
-- - ~10000+ order items
-- - ~200 employees
-- - ~1500 attendance records
-- - 24 months of sales analytics

SELECT 'Extended demo data generation complete!' as status;
SELECT 'Customers: ' || COUNT(*) FROM demo_ecommerce.customers;
SELECT 'Products: ' || COUNT(*) FROM demo_ecommerce.products;
SELECT 'Orders: ' || COUNT(*) FROM demo_ecommerce.orders;
SELECT 'Order Items: ' || COUNT(*) FROM demo_ecommerce.order_items;
SELECT 'Employees: ' || COUNT(*) FROM demo_hrms.employees;

