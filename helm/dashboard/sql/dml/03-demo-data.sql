-- Demo Data Inserts
-- Sample data for testing and demonstrations
-- This file populates the demo schemas with realistic test data

-- =============================================================================
-- E-COMMERCE DEMO DATA
-- =============================================================================

-- Insert demo customers
INSERT INTO demo_ecommerce.customers (first_name, last_name, email, phone, address, city, state, country, postal_code, customer_segment) VALUES
('John', 'Smith', 'john.smith@email.com', '+1-555-0101', '123 Main St', 'New York', 'NY', 'USA', '10001', 'Premium'),
('Sarah', 'Johnson', 'sarah.j@email.com', '+1-555-0102', '456 Oak Ave', 'Los Angeles', 'CA', 'USA', '90210', 'Regular'),
('Michael', 'Brown', 'mike.brown@email.com', '+1-555-0103', '789 Pine St', 'Chicago', 'IL', 'USA', '60601', 'VIP'),
('Emily', 'Davis', 'emily.davis@email.com', '+1-555-0104', '321 Elm St', 'Houston', 'TX', 'USA', '77001', 'Regular'),
('David', 'Wilson', 'david.w@email.com', '+1-555-0105', '654 Maple Dr', 'Phoenix', 'AZ', 'USA', '85001', 'Premium'),
('Lisa', 'Anderson', 'lisa.a@email.com', '+1-555-0106', '987 Cedar Ln', 'Philadelphia', 'PA', 'USA', '19101', 'Regular'),
('James', 'Taylor', 'james.t@email.com', '+1-555-0107', '147 Birch Rd', 'San Antonio', 'TX', 'USA', '78201', 'VIP'),
('Jennifer', 'Thomas', 'jen.thomas@email.com', '+1-555-0108', '258 Spruce St', 'San Diego', 'CA', 'USA', '92101', 'Regular'),
('Robert', 'Jackson', 'rob.jackson@email.com', '+1-555-0109', '369 Willow Way', 'Dallas', 'TX', 'USA', '75201', 'Premium'),
('Michelle', 'White', 'michelle.w@email.com', '+1-555-0110', '741 Aspen Ave', 'San Jose', 'CA', 'USA', '95101', 'Regular')
ON CONFLICT (email) DO NOTHING;

-- Insert demo products
INSERT INTO demo_ecommerce.products (product_name, category, subcategory, brand, price, cost, stock_quantity, description) VALUES
('Wireless Bluetooth Headphones', 'Electronics', 'Audio', 'TechSound', 99.99, 45.00, 150, 'High-quality wireless headphones with noise cancellation'),
('Smartphone Case', 'Electronics', 'Accessories', 'PhoneGuard', 24.99, 8.50, 500, 'Protective case for latest smartphone models'),
('Laptop Stand', 'Electronics', 'Accessories', 'DeskPro', 49.99, 22.00, 75, 'Adjustable aluminum laptop stand for ergonomic working'),
('Coffee Maker', 'Home & Kitchen', 'Appliances', 'BrewMaster', 129.99, 65.00, 45, 'Programmable coffee maker with thermal carafe'),
('Yoga Mat', 'Sports & Fitness', 'Exercise', 'FlexFit', 39.99, 15.00, 200, 'Non-slip yoga mat with carrying strap'),
('Running Shoes', 'Sports & Fitness', 'Footwear', 'SpeedRun', 89.99, 40.00, 120, 'Lightweight running shoes with cushioned sole'),
('Desk Lamp', 'Home & Kitchen', 'Lighting', 'BrightLight', 34.99, 18.00, 80, 'LED desk lamp with adjustable brightness'),
('Backpack', 'Fashion', 'Bags', 'TravelPro', 59.99, 25.00, 90, 'Durable backpack with laptop compartment'),
('Water Bottle', 'Sports & Fitness', 'Accessories', 'HydroFlow', 19.99, 7.50, 300, 'Insulated stainless steel water bottle'),
('Wireless Mouse', 'Electronics', 'Accessories', 'ClickPro', 29.99, 12.00, 180, 'Ergonomic wireless mouse with precision tracking')
ON CONFLICT DO NOTHING;

-- Insert demo orders
INSERT INTO demo_ecommerce.orders (order_id, customer_id, order_date, status, total_amount, shipping_cost, tax_amount, payment_method, shipping_address) VALUES
(1, 1, '2024-01-15 10:30:00', 'Delivered', 149.98, 9.99, 12.00, 'Credit Card', '123 Main St, New York, NY 10001'),
(2, 2, '2024-01-16 14:22:00', 'Delivered', 74.98, 5.99, 6.40, 'PayPal', '456 Oak Ave, Los Angeles, CA 90210'),
(3, 3, '2024-01-17 09:15:00', 'Shipped', 219.97, 0.00, 17.60, 'Credit Card', '789 Pine St, Chicago, IL 60601'),
(4, 4, '2024-01-18 16:45:00', 'Processing', 89.99, 7.99, 7.84, 'Debit Card', '321 Elm St, Houston, TX 77001'),
(5, 5, '2024-01-19 11:20:00', 'Delivered', 129.98, 8.99, 11.12, 'Credit Card', '654 Maple Dr, Phoenix, AZ 85001'),
(6, 6, '2024-01-20 13:30:00', 'Delivered', 59.99, 5.99, 5.28, 'PayPal', '987 Cedar Ln, Philadelphia, PA 19101'),
(7, 7, '2024-01-21 08:45:00', 'Cancelled', 0.00, 0.00, 0.00, 'Credit Card', '147 Birch Rd, San Antonio, TX 78201'),
(8, 8, '2024-01-22 15:10:00', 'Delivered', 194.97, 9.99, 16.40, 'Credit Card', '258 Spruce St, San Diego, CA 92101'),
(9, 9, '2024-01-23 12:00:00', 'Shipped', 49.99, 6.99, 4.56, 'Debit Card', '369 Willow Way, Dallas, TX 75201'),
(10, 10, '2024-01-24 17:25:00', 'Processing', 29.99, 4.99, 2.80, 'PayPal', '741 Aspen Ave, San Jose, CA 95101')
ON CONFLICT (order_id) DO NOTHING;

-- Reset sequence for orders table to avoid ID conflicts with future inserts
SELECT setval('demo_ecommerce.orders_order_id_seq', (SELECT MAX(order_id) FROM demo_ecommerce.orders));

-- Insert demo order items
INSERT INTO demo_ecommerce.order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
(1, 1, 1, 99.99, 99.99),
(1, 2, 2, 24.99, 49.98),
(2, 3, 1, 49.99, 49.99),
(2, 2, 1, 24.99, 24.99),
(3, 4, 1, 129.99, 129.99),
(3, 5, 1, 39.99, 39.99),
(3, 2, 2, 24.99, 49.98),
(4, 6, 1, 89.99, 89.99),
(5, 1, 1, 99.99, 99.99),
(5, 9, 1, 19.99, 19.99),
(5, 7, 1, 34.99, 34.99),
(6, 8, 1, 59.99, 59.99),
(8, 1, 1, 99.99, 99.99),
(8, 6, 1, 89.99, 89.99),
(8, 10, 1, 29.99, 29.99),
(9, 3, 1, 49.99, 49.99),
(10, 10, 1, 29.99, 29.99)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- HRMS DEMO DATA
-- =============================================================================

-- Insert demo departments
INSERT INTO demo_hrms.departments (department_name, location, budget) VALUES
('Engineering', 'San Francisco', 2000000.00),
('Marketing', 'New York', 800000.00),
('Sales', 'Chicago', 1200000.00),
('Human Resources', 'Austin', 500000.00),
('Finance', 'Boston', 750000.00),
('Product Management', 'Seattle', 900000.00),
('Customer Support', 'Denver', 400000.00),
('Data Science', 'San Francisco', 1800000.00)
ON CONFLICT DO NOTHING;

-- Insert demo employees
INSERT INTO demo_hrms.employees (first_name, last_name, email, phone, hire_date, job_title, department_id, salary, manager_id, status) VALUES
('Alice', 'Johnson', 'alice.johnson@company.com', '+1-555-1001', '2020-01-15', 'VP Engineering', 1, 180000.00, NULL, 'Active'),
('Bob', 'Smith', 'bob.smith@company.com', '+1-555-1002', '2020-03-20', 'Senior Software Engineer', 1, 140000.00, 1, 'Active'),
('Carol', 'Davis', 'carol.davis@company.com', '+1-555-1003', '2021-06-10', 'Software Engineer', 1, 110000.00, 1, 'Active'),
('David', 'Wilson', 'david.wilson@company.com', '+1-555-1004', '2019-08-05', 'Marketing Director', 2, 150000.00, NULL, 'Active'),
('Eva', 'Brown', 'eva.brown@company.com', '+1-555-1005', '2021-02-14', 'Marketing Manager', 2, 95000.00, 4, 'Active'),
('Frank', 'Miller', 'frank.miller@company.com', '+1-555-1006', '2020-11-30', 'Sales Director', 3, 160000.00, NULL, 'Active'),
('Grace', 'Taylor', 'grace.taylor@company.com', '+1-555-1007', '2021-09-12', 'Sales Manager', 3, 105000.00, 6, 'Active'),
('Henry', 'Anderson', 'henry.anderson@company.com', '+1-555-1008', '2019-04-22', 'HR Director', 4, 130000.00, NULL, 'Active'),
('Ivy', 'Thomas', 'ivy.thomas@company.com', '+1-555-1009', '2022-01-08', 'HR Specialist', 4, 75000.00, 8, 'Active'),
('Jack', 'Jackson', 'jack.jackson@company.com', '+1-555-1010', '2020-07-18', 'Finance Director', 5, 145000.00, NULL, 'Active'),
('Kate', 'White', 'kate.white@company.com', '+1-555-1011', '2021-11-25', 'Financial Analyst', 5, 85000.00, 10, 'Active'),
('Liam', 'Harris', 'liam.harris@company.com', '+1-555-1012', '2020-05-03', 'Product Manager', 6, 125000.00, NULL, 'Active'),
('Mia', 'Clark', 'mia.clark@company.com', '+1-555-1013', '2022-03-15', 'Support Manager', 7, 90000.00, NULL, 'Active'),
('Noah', 'Lewis', 'noah.lewis@company.com', '+1-555-1014', '2021-08-07', 'Data Scientist', 8, 135000.00, NULL, 'Active'),
('Olivia', 'Walker', 'olivia.walker@company.com', '+1-555-1015', '2022-06-20', 'Junior Data Scientist', 8, 95000.00, 14, 'Active')
ON CONFLICT (email) DO NOTHING;

-- Update department manager references
UPDATE demo_hrms.departments SET manager_id = 1 WHERE department_id = 1;
UPDATE demo_hrms.departments SET manager_id = 4 WHERE department_id = 2;
UPDATE demo_hrms.departments SET manager_id = 6 WHERE department_id = 3;
UPDATE demo_hrms.departments SET manager_id = 8 WHERE department_id = 4;
UPDATE demo_hrms.departments SET manager_id = 10 WHERE department_id = 5;
UPDATE demo_hrms.departments SET manager_id = 12 WHERE department_id = 6;
UPDATE demo_hrms.departments SET manager_id = 13 WHERE department_id = 7;
UPDATE demo_hrms.departments SET manager_id = 14 WHERE department_id = 8;

-- Insert demo projects
INSERT INTO demo_hrms.projects (project_name, description, start_date, end_date, status, budget, department_id, project_manager_id) VALUES
('Mobile App Redesign', 'Complete redesign of mobile application UI/UX', '2024-01-01', '2024-06-30', 'In Progress', 500000.00, 1, 2),
('Customer Analytics Platform', 'Build analytics platform for customer insights', '2024-02-15', '2024-08-15', 'In Progress', 750000.00, 8, 14),
('Q1 Marketing Campaign', 'Launch new product marketing campaign', '2024-01-01', '2024-03-31', 'Completed', 200000.00, 2, 5),
('Sales CRM Integration', 'Integrate new CRM system with existing tools', '2024-03-01', '2024-05-31', 'Planning', 300000.00, 3, 7),
('HR Portal Upgrade', 'Upgrade employee self-service portal', '2024-04-01', '2024-07-31', 'Planning', 150000.00, 4, 9)
ON CONFLICT DO NOTHING;

-- Insert demo employee project assignments
INSERT INTO demo_hrms.employee_projects (employee_id, project_id, role, allocation_percentage, start_date, end_date) VALUES
(2, 1, 'Tech Lead', 80.00, '2024-01-01', '2024-06-30'),
(3, 1, 'Frontend Developer', 100.00, '2024-01-15', '2024-06-30'),
(14, 2, 'Project Manager', 60.00, '2024-02-15', '2024-08-15'),
(15, 2, 'Data Analyst', 100.00, '2024-02-15', '2024-08-15'),
(5, 3, 'Campaign Manager', 100.00, '2024-01-01', '2024-03-31'),
(7, 4, 'Implementation Lead', 75.00, '2024-03-01', '2024-05-31'),
(9, 5, 'Business Analyst', 50.00, '2024-04-01', '2024-07-31')
ON CONFLICT DO NOTHING;

-- Insert demo attendance records
INSERT INTO demo_hrms.attendance (employee_id, date, check_in_time, check_out_time, hours_worked, status) VALUES
(2, '2024-01-15', '09:00:00', '18:00:00', 8.00, 'Present'),
(2, '2024-01-16', '09:15:00', '18:30:00', 8.25, 'Present'),
(2, '2024-01-17', '08:45:00', '17:45:00', 8.00, 'Present'),
(3, '2024-01-15', '09:30:00', '18:15:00', 7.75, 'Present'),
(3, '2024-01-16', NULL, NULL, 0.00, 'Sick Leave'),
(3, '2024-01-17', '09:00:00', '18:00:00', 8.00, 'Present'),
(5, '2024-01-15', '08:30:00', '17:30:00', 8.00, 'Present'),
(5, '2024-01-16', '09:00:00', '18:00:00', 8.00, 'Present'),
(5, '2024-01-17', '08:45:00', '17:45:00', 8.00, 'Present')
ON CONFLICT DO NOTHING;

-- Insert demo performance reviews
INSERT INTO demo_hrms.performance_reviews (employee_id, reviewer_id, review_period, review_date, overall_rating, goals_achievement, technical_skills, communication, teamwork, comments) VALUES
(2, 1, '2023 Annual', '2024-01-15', 4.5, 4.8, 4.7, 4.2, 4.6, 'Excellent technical leadership and project delivery'),
(3, 1, '2023 Annual', '2024-01-20', 4.2, 4.0, 4.5, 4.1, 4.3, 'Strong technical skills, good team collaboration'),
(5, 4, '2023 Annual', '2024-01-25', 4.6, 4.8, 4.0, 4.9, 4.7, 'Outstanding marketing campaign results'),
(7, 6, '2023 Annual', '2024-01-30', 4.3, 4.2, 3.8, 4.5, 4.4, 'Good sales performance, excellent client relationships'),
(9, 8, '2023 Annual', '2024-02-05', 4.1, 3.9, 4.2, 4.3, 4.0, 'Solid HR operations, room for process improvement')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- ANALYTICS DEMO DATA
-- =============================================================================

-- Insert demo analytics data
INSERT INTO demo_analytics.monthly_sales (year, month, total_orders, total_revenue, total_customers, avg_order_value) VALUES
(2024, 1, 150, 15750.50, 89, 105.00),
(2023, 12, 180, 19200.75, 102, 106.67),
(2023, 11, 165, 17325.25, 95, 105.00),
(2023, 10, 142, 14890.80, 78, 104.86)
ON CONFLICT (year, month) DO NOTHING;

INSERT INTO demo_analytics.product_performance (product_id, product_name, category, total_sold, total_revenue, avg_rating) VALUES
(1, 'Wireless Bluetooth Headphones', 'Electronics', 45, 4499.55, 4.5),
(2, 'Smartphone Case', 'Electronics', 89, 2224.11, 4.2),
(3, 'Laptop Stand', 'Electronics', 23, 1149.77, 4.7),
(4, 'Coffee Maker', 'Home & Kitchen', 18, 2339.82, 4.3),
(5, 'Yoga Mat', 'Sports & Fitness', 34, 1359.66, 4.6),
(6, 'Running Shoes', 'Sports & Fitness', 28, 2519.72, 4.4),
(7, 'Desk Lamp', 'Home & Kitchen', 15, 524.85, 4.1),
(8, 'Backpack', 'Fashion', 22, 1319.78, 4.5),
(9, 'Water Bottle', 'Sports & Fitness', 67, 1339.33, 4.8),
(10, 'Wireless Mouse', 'Electronics', 41, 1229.59, 4.3)
ON CONFLICT DO NOTHING;
