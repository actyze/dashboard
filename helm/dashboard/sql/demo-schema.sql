-- Demo Database Schema
-- This schema contains sample data for testing and demonstrations
-- Separate from Nexus service operational data

-- Create demo schemas
CREATE SCHEMA IF NOT EXISTS demo_ecommerce;
CREATE SCHEMA IF NOT EXISTS demo_hrms;
CREATE SCHEMA IF NOT EXISTS demo_analytics;

-- =============================================================================
-- E-COMMERCE DEMO SCHEMA
-- =============================================================================

-- Demo customers table
CREATE TABLE demo_ecommerce.customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    registration_date DATE DEFAULT CURRENT_DATE,
    customer_segment VARCHAR(20) DEFAULT 'Regular'
);

-- Demo products table
CREATE TABLE demo_ecommerce.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    brand VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    description TEXT,
    created_date DATE DEFAULT CURRENT_DATE
);

-- Demo orders table
CREATE TABLE demo_ecommerce.orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES demo_ecommerce.customers(customer_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(20),
    shipping_address TEXT
);

-- Demo order items table
CREATE TABLE demo_ecommerce.order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES demo_ecommerce.orders(order_id),
    product_id INTEGER REFERENCES demo_ecommerce.products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- =============================================================================
-- HRMS DEMO SCHEMA
-- =============================================================================

-- Demo departments table
CREATE TABLE demo_hrms.departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    manager_id INTEGER,
    location VARCHAR(100),
    budget DECIMAL(12,2),
    created_date DATE DEFAULT CURRENT_DATE
);

-- Demo employees table
CREATE TABLE demo_hrms.employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    hire_date DATE NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES demo_hrms.departments(department_id),
    salary DECIMAL(10,2) NOT NULL,
    manager_id INTEGER,
    status VARCHAR(20) DEFAULT 'Active'
);

-- Demo projects table
CREATE TABLE demo_hrms.projects (
    project_id SERIAL PRIMARY KEY,
    project_name VARCHAR(200) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'Planning',
    budget DECIMAL(12,2),
    department_id INTEGER REFERENCES demo_hrms.departments(department_id),
    project_manager_id INTEGER REFERENCES demo_hrms.employees(employee_id)
);

-- Demo employee project assignments
CREATE TABLE demo_hrms.employee_projects (
    assignment_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES demo_hrms.employees(employee_id),
    project_id INTEGER REFERENCES demo_hrms.projects(project_id),
    role VARCHAR(100),
    allocation_percentage DECIMAL(5,2),
    start_date DATE,
    end_date DATE
);

-- Demo attendance tracking
CREATE TABLE demo_hrms.attendance (
    attendance_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES demo_hrms.employees(employee_id),
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    hours_worked DECIMAL(4,2),
    status VARCHAR(20) DEFAULT 'Present'
);

-- Demo performance reviews
CREATE TABLE demo_hrms.performance_reviews (
    review_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES demo_hrms.employees(employee_id),
    reviewer_id INTEGER REFERENCES demo_hrms.employees(employee_id),
    review_period VARCHAR(50),
    review_date DATE,
    overall_rating DECIMAL(3,2),
    goals_achievement DECIMAL(3,2),
    technical_skills DECIMAL(3,2),
    communication DECIMAL(3,2),
    teamwork DECIMAL(3,2),
    comments TEXT
);

-- =============================================================================
-- ANALYTICS DEMO SCHEMA
-- =============================================================================

-- Demo monthly sales summary
CREATE TABLE demo_analytics.monthly_sales (
    year INTEGER,
    month INTEGER,
    total_orders INTEGER,
    total_revenue DECIMAL(12,2),
    total_customers INTEGER,
    avg_order_value DECIMAL(10,2),
    PRIMARY KEY (year, month)
);

-- Demo product performance
CREATE TABLE demo_analytics.product_performance (
    product_id INTEGER,
    product_name VARCHAR(200),
    category VARCHAR(50),
    total_sold INTEGER,
    total_revenue DECIMAL(12,2),
    avg_rating DECIMAL(3,2),
    last_updated DATE DEFAULT CURRENT_DATE
);

-- Create indexes for demo tables
CREATE INDEX idx_demo_customers_email ON demo_ecommerce.customers(email);
CREATE INDEX idx_demo_customers_segment ON demo_ecommerce.customers(customer_segment);
CREATE INDEX idx_demo_products_category ON demo_ecommerce.products(category);
CREATE INDEX idx_demo_orders_customer ON demo_ecommerce.orders(customer_id);
CREATE INDEX idx_demo_orders_date ON demo_ecommerce.orders(order_date);
CREATE INDEX idx_demo_employees_dept ON demo_hrms.employees(department_id);
CREATE INDEX idx_demo_employees_status ON demo_hrms.employees(status);
CREATE INDEX idx_demo_attendance_employee ON demo_hrms.attendance(employee_id);
CREATE INDEX idx_demo_attendance_date ON demo_hrms.attendance(date);
