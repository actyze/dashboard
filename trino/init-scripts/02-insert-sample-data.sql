-- Insert comprehensive sample data for testing FAISS schema service

-- Insert sample customers
INSERT INTO sales.customers (first_name, last_name, email, phone, address, city, state, zip_code, customer_segment, lifetime_value) VALUES
('John', 'Smith', 'john.smith@email.com', '555-0101', '123 Main St', 'New York', 'NY', '10001', 'Premium', 15000.00),
('Sarah', 'Johnson', 'sarah.j@email.com', '555-0102', '456 Oak Ave', 'Los Angeles', 'CA', '90210', 'Standard', 8500.00),
('Michael', 'Brown', 'm.brown@email.com', '555-0103', '789 Pine Rd', 'Chicago', 'IL', '60601', 'Premium', 22000.00),
('Emily', 'Davis', 'emily.davis@email.com', '555-0104', '321 Elm St', 'Houston', 'TX', '77001', 'Basic', 3200.00),
('David', 'Wilson', 'david.w@email.com', '555-0105', '654 Maple Dr', 'Phoenix', 'AZ', '85001', 'Standard', 12000.00),
('Lisa', 'Anderson', 'lisa.a@email.com', '555-0106', '987 Cedar Ln', 'Philadelphia', 'PA', '19101', 'Premium', 18500.00),
('Robert', 'Taylor', 'robert.t@email.com', '555-0107', '147 Birch Way', 'San Antonio', 'TX', '78201', 'Standard', 9800.00),
('Jennifer', 'Martinez', 'jennifer.m@email.com', '555-0108', '258 Spruce St', 'San Diego', 'CA', '92101', 'Basic', 4100.00);

-- Insert sample products
INSERT INTO sales.products (product_name, category, subcategory, brand, price, cost, description, weight_kg, stock_quantity) VALUES
('Wireless Bluetooth Headphones', 'Electronics', 'Audio', 'TechSound', 149.99, 75.00, 'Premium wireless headphones with noise cancellation', 0.3, 150),
('Smartphone Case', 'Electronics', 'Accessories', 'ProtectPro', 29.99, 12.00, 'Durable protective case for smartphones', 0.1, 500),
('Gaming Laptop', 'Electronics', 'Computers', 'GameMax', 1299.99, 800.00, 'High-performance gaming laptop with RTX graphics', 2.5, 25),
('Office Chair', 'Furniture', 'Seating', 'ComfortPlus', 299.99, 150.00, 'Ergonomic office chair with lumbar support', 15.0, 75),
('Coffee Maker', 'Appliances', 'Kitchen', 'BrewMaster', 89.99, 45.00, 'Programmable coffee maker with thermal carafe', 3.2, 100),
('Running Shoes', 'Clothing', 'Footwear', 'SportFlex', 119.99, 60.00, 'Lightweight running shoes with cushioned sole', 0.8, 200),
('Backpack', 'Accessories', 'Bags', 'AdventurePack', 79.99, 35.00, 'Waterproof hiking backpack with multiple compartments', 1.2, 120),
('Tablet', 'Electronics', 'Computers', 'TechTab', 399.99, 250.00, '10-inch tablet with high-resolution display', 0.6, 80);

-- Insert sample orders
INSERT INTO sales.orders (customer_id, order_date, order_status, total_amount, discount_amount, tax_amount, shipping_cost, payment_method) VALUES
(1, '2024-01-15', 'Delivered', 179.98, 10.00, 14.40, 9.99, 'Credit Card'),
(2, '2024-01-16', 'Delivered', 1389.98, 50.00, 111.20, 0.00, 'PayPal'),
(3, '2024-01-17', 'Shipped', 409.97, 0.00, 32.80, 15.99, 'Credit Card'),
(4, '2024-01-18', 'Processing', 89.99, 0.00, 7.20, 9.99, 'Debit Card'),
(1, '2024-01-20', 'Delivered', 239.98, 20.00, 19.20, 12.99, 'Credit Card'),
(5, '2024-01-22', 'Delivered', 199.98, 0.00, 16.00, 9.99, 'Credit Card'),
(6, '2024-01-25', 'Cancelled', 0.00, 0.00, 0.00, 0.00, 'Credit Card'),
(7, '2024-01-28', 'Delivered', 149.99, 15.00, 12.00, 9.99, 'PayPal');

-- Insert sample order items
INSERT INTO sales.order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
(1, 1, 1, 149.99, 149.99),
(1, 2, 1, 29.99, 29.99),
(2, 3, 1, 1299.99, 1299.99),
(2, 2, 3, 29.99, 89.97),
(3, 4, 1, 299.99, 299.99),
(3, 5, 1, 89.99, 89.99),
(3, 2, 1, 29.99, 29.99),
(4, 5, 1, 89.99, 89.99),
(5, 6, 2, 119.99, 239.98),
(6, 7, 1, 79.99, 79.99),
(6, 6, 1, 119.99, 119.99),
(8, 1, 1, 149.99, 149.99);

-- Insert sample departments
INSERT INTO hr.departments (department_name, budget, location) VALUES
('Engineering', 2500000.00, 'San Francisco, CA'),
('Sales', 1800000.00, 'New York, NY'),
('Marketing', 1200000.00, 'Los Angeles, CA'),
('Human Resources', 800000.00, 'Chicago, IL'),
('Finance', 1000000.00, 'New York, NY'),
('Customer Support', 600000.00, 'Austin, TX'),
('Operations', 1500000.00, 'Seattle, WA');

-- Insert sample employees
INSERT INTO hr.employees (employee_number, first_name, last_name, email, hire_date, job_title, department_id, salary, employment_status, birth_date) VALUES
('EMP001', 'Alice', 'Cooper', 'alice.cooper@company.com', '2020-03-15', 'Senior Software Engineer', 1, 125000.00, 'Active', '1985-07-22'),
('EMP002', 'Bob', 'Miller', 'bob.miller@company.com', '2019-08-01', 'Sales Manager', 2, 95000.00, 'Active', '1982-11-10'),
('EMP003', 'Carol', 'White', 'carol.white@company.com', '2021-01-10', 'Marketing Specialist', 3, 65000.00, 'Active', '1990-04-15'),
('EMP004', 'Daniel', 'Green', 'daniel.green@company.com', '2018-05-20', 'HR Director', 4, 110000.00, 'Active', '1978-09-03'),
('EMP005', 'Eva', 'Black', 'eva.black@company.com', '2022-02-14', 'Financial Analyst', 5, 75000.00, 'Active', '1988-12-28'),
('EMP006', 'Frank', 'Blue', 'frank.blue@company.com', '2020-11-30', 'Support Specialist', 6, 50000.00, 'Active', '1992-06-18'),
('EMP007', 'Grace', 'Red', 'grace.red@company.com', '2019-09-12', 'Operations Manager', 7, 105000.00, 'Active', '1983-03-07');

-- Insert sample payroll data
INSERT INTO hr.payroll (employee_id, pay_period_start, pay_period_end, gross_pay, tax_deductions, insurance_deductions, net_pay, pay_date, overtime_hours, overtime_pay) VALUES
(1, '2024-01-01', '2024-01-15', 4807.69, 1202.00, 300.00, 3305.69, '2024-01-20', 5.0, 468.75),
(2, '2024-01-01', '2024-01-15', 3653.85, 913.00, 250.00, 2490.85, '2024-01-20', 0.0, 0.00),
(3, '2024-01-01', '2024-01-15', 2500.00, 625.00, 200.00, 1675.00, '2024-01-20', 2.0, 125.00),
(4, '2024-01-01', '2024-01-15', 4230.77, 1058.00, 350.00, 2822.77, '2024-01-20', 0.0, 0.00),
(5, '2024-01-01', '2024-01-15', 2884.62, 721.00, 200.00, 1963.62, '2024-01-20', 1.5, 108.17);

-- Insert sample website traffic data
INSERT INTO analytics.website_traffic (visit_date, page_url, visitor_id, session_id, page_views, session_duration_seconds, traffic_source, device_type, country, city) VALUES
('2024-01-15', '/home', 'visitor_001', 'session_001', 3, 180, 'Google', 'Desktop', 'USA', 'New York'),
('2024-01-15', '/products', 'visitor_002', 'session_002', 5, 420, 'Facebook', 'Mobile', 'USA', 'Los Angeles'),
('2024-01-16', '/checkout', 'visitor_003', 'session_003', 2, 90, 'Direct', 'Desktop', 'Canada', 'Toronto'),
('2024-01-16', '/about', 'visitor_004', 'session_004', 1, 45, 'Twitter', 'Tablet', 'UK', 'London'),
('2024-01-17', '/products/electronics', 'visitor_005', 'session_005', 4, 300, 'Google', 'Mobile', 'USA', 'Chicago');

-- Insert sample sales metrics
INSERT INTO analytics.sales_metrics (metric_date, total_revenue, total_orders, average_order_value, new_customers, returning_customers, conversion_rate, region, product_category) VALUES
('2024-01-15', 25000.00, 45, 555.56, 12, 33, 0.0325, 'North America', 'Electronics'),
('2024-01-16', 18500.00, 32, 578.13, 8, 24, 0.0298, 'North America', 'Furniture'),
('2024-01-17', 32000.00, 58, 551.72, 15, 43, 0.0387, 'Europe', 'Electronics'),
('2024-01-18', 14200.00, 28, 507.14, 6, 22, 0.0245, 'Asia', 'Clothing'),
('2024-01-19', 28900.00, 51, 566.67, 13, 38, 0.0356, 'North America', 'Appliances');

-- Insert sample warehouses
INSERT INTO inventory.warehouses (warehouse_name, address, city, state, zip_code, capacity_cubic_meters, manager_name, phone) VALUES
('East Coast Distribution Center', '1000 Industrial Blvd', 'Newark', 'NJ', '07102', 50000.00, 'John Manager', '555-1001'),
('West Coast Distribution Center', '2000 Logistics Way', 'Los Angeles', 'CA', '90058', 75000.00, 'Sarah Supervisor', '555-1002'),
('Central Distribution Hub', '3000 Warehouse Dr', 'Chicago', 'IL', '60632', 60000.00, 'Mike Director', '555-1003'),
('Southern Regional Center', '4000 Supply Chain Ave', 'Atlanta', 'GA', '30309', 45000.00, 'Lisa Leader', '555-1004');

-- Insert sample stock levels
INSERT INTO inventory.stock_levels (product_id, warehouse_id, current_stock, reserved_stock, reorder_point, max_stock_level, cost_per_unit) VALUES
(1, 1, 150, 25, 50, 300, 75.00),
(1, 2, 200, 30, 50, 400, 75.00),
(2, 1, 500, 100, 200, 1000, 12.00),
(2, 3, 300, 50, 150, 600, 12.00),
(3, 2, 25, 5, 10, 50, 800.00),
(4, 1, 75, 15, 25, 150, 150.00),
(4, 4, 50, 10, 20, 100, 150.00),
(5, 3, 100, 20, 30, 200, 45.00);

-- Insert sample stock movements
INSERT INTO inventory.stock_movements (product_id, warehouse_id, movement_type, quantity, reference_number, notes, unit_cost) VALUES
(1, 1, 'IN', 100, 'PO-2024-001', 'Initial stock receipt', 75.00),
(2, 1, 'IN', 500, 'PO-2024-002', 'Bulk order received', 12.00),
(1, 1, 'OUT', 25, 'SO-2024-001', 'Customer order fulfillment', 75.00),
(3, 2, 'IN', 30, 'PO-2024-003', 'Premium laptop delivery', 800.00),
(4, 1, 'TRANSFER', 25, 'TR-2024-001', 'Transfer to East Coast DC', 150.00),
(5, 3, 'ADJUSTMENT', -5, 'ADJ-2024-001', 'Inventory count adjustment', 45.00);
