-- Create sample schemas and tables for testing FAISS schema service

-- Sales and Customer Data Schema
CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE sales.customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'USA',
    registration_date DATE DEFAULT CURRENT_DATE,
    customer_segment VARCHAR(20) CHECK (customer_segment IN ('Premium', 'Standard', 'Basic')),
    lifetime_value DECIMAL(10,2) DEFAULT 0.00
);

CREATE TABLE sales.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    brand VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    description TEXT,
    weight_kg DECIMAL(8,3),
    dimensions_cm VARCHAR(50),
    stock_quantity INTEGER DEFAULT 0,
    created_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE sales.orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES sales.customers(customer_id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_status VARCHAR(20) CHECK (order_status IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    total_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    payment_method VARCHAR(30),
    shipping_address TEXT,
    tracking_number VARCHAR(50)
);

CREATE TABLE sales.order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES sales.orders(order_id),
    product_id INTEGER REFERENCES sales.products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0.00
);

-- HR and Employee Data Schema
CREATE SCHEMA IF NOT EXISTS hr;

CREATE TABLE hr.departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(50) NOT NULL UNIQUE,
    manager_id INTEGER,
    budget DECIMAL(12,2),
    location VARCHAR(100),
    created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE hr.employees (
    employee_id SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    hire_date DATE NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES hr.departments(department_id),
    manager_id INTEGER REFERENCES hr.employees(employee_id),
    salary DECIMAL(10,2) NOT NULL,
    employment_status VARCHAR(20) CHECK (employment_status IN ('Active', 'Inactive', 'Terminated')),
    birth_date DATE,
    address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20)
);

CREATE TABLE hr.payroll (
    payroll_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES hr.employees(employee_id),
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    gross_pay DECIMAL(10,2) NOT NULL,
    tax_deductions DECIMAL(10,2) DEFAULT 0.00,
    insurance_deductions DECIMAL(10,2) DEFAULT 0.00,
    other_deductions DECIMAL(10,2) DEFAULT 0.00,
    net_pay DECIMAL(10,2) NOT NULL,
    pay_date DATE NOT NULL,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    overtime_pay DECIMAL(10,2) DEFAULT 0.00
);

-- Analytics and Reporting Schema
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.website_traffic (
    traffic_id SERIAL PRIMARY KEY,
    visit_date DATE NOT NULL,
    page_url VARCHAR(500) NOT NULL,
    visitor_id VARCHAR(100),
    session_id VARCHAR(100) NOT NULL,
    page_views INTEGER DEFAULT 1,
    session_duration_seconds INTEGER,
    bounce_rate DECIMAL(5,4),
    traffic_source VARCHAR(50),
    device_type VARCHAR(20) CHECK (device_type IN ('Desktop', 'Mobile', 'Tablet')),
    browser VARCHAR(50),
    country VARCHAR(50),
    city VARCHAR(100)
);

CREATE TABLE analytics.sales_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_revenue DECIMAL(12,2) NOT NULL,
    total_orders INTEGER NOT NULL,
    average_order_value DECIMAL(10,2) NOT NULL,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4),
    cart_abandonment_rate DECIMAL(5,4),
    region VARCHAR(50),
    product_category VARCHAR(50)
);

-- Inventory and Warehouse Schema
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'USA',
    capacity_cubic_meters DECIMAL(10,2),
    manager_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE inventory.stock_levels (
    stock_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER REFERENCES inventory.warehouses(warehouse_id),
    current_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    max_stock_level INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cost_per_unit DECIMAL(10,2)
);

CREATE TABLE inventory.stock_movements (
    movement_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER REFERENCES inventory.warehouses(warehouse_id),
    movement_type VARCHAR(20) CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reference_number VARCHAR(50),
    notes TEXT,
    unit_cost DECIMAL(10,2)
);
