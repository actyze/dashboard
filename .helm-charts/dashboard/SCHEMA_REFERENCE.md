# Database Schema Reference

This document describes the database schema structure after the separation of Nexus service and demo data.

## Schema Organization

### 🚀 Nexus Service Schema (`nexus`)
**Purpose:** Operational data for the Nexus FastAPI service
**Owner:** Nexus service
**Access:** Nexus service user (`nexus_service`)

#### Tables:
- `nexus.users` - User authentication and profiles
- `nexus.user_preferences` - User settings (JSON format)
- `nexus.conversation_history` - Chat session persistence
- `nexus.query_history` - Query execution tracking and analytics
- `nexus.saved_queries` - User bookmarked queries

### 🎭 Demo E-Commerce Schema (`demo_ecommerce`)
**Purpose:** Sample e-commerce data for testing and demonstrations
**Owner:** Demo data
**Access:** Read-only for queries and testing

#### Tables:
- `demo_ecommerce.customers` - Sample customer data
- `demo_ecommerce.products` - Sample product catalog
- `demo_ecommerce.orders` - Sample order data
- `demo_ecommerce.order_items` - Order line items

### 👥 Demo HRMS Schema (`demo_hrms`)
**Purpose:** Sample HR/employee data for testing
**Owner:** Demo data
**Access:** Read-only for queries and testing

#### Tables:
- `demo_hrms.departments` - Company departments
- `demo_hrms.employees` - Employee records
- `demo_hrms.projects` - Project management data
- `demo_hrms.employee_projects` - Project assignments
- `demo_hrms.attendance` - Attendance tracking
- `demo_hrms.performance_reviews` - Performance review data

### 📊 Demo Analytics Schema (`demo_analytics`)
**Purpose:** Pre-aggregated analytics data for testing
**Owner:** Demo data
**Access:** Read-only for queries and testing

#### Tables:
- `demo_analytics.monthly_sales` - Monthly sales summaries
- `demo_analytics.product_performance` - Product performance metrics

## Trino Configuration

### Catalog: `postgres`
- **Connector:** `postgresql`
- **Connection:** `jdbc:postgresql://dashboard-postgres:5432/dashboard`
- **User:** `nexus_service`
- **Schemas Available:**
  - `nexus` - Nexus service operational data
  - `demo_ecommerce` - E-commerce demo data
  - `demo_hrms` - HR demo data
  - `demo_analytics` - Analytics demo data

### Example Queries:

#### Nexus Service Data:
```sql
-- User management
SELECT * FROM postgres.nexus.users;
SELECT * FROM postgres.nexus.conversation_history WHERE user_id = 1;

-- Query analytics
SELECT natural_language_query, execution_status, execution_time_ms 
FROM postgres.nexus.query_history 
ORDER BY created_at DESC LIMIT 10;
```

#### Demo Data Queries:
```sql
-- E-commerce analytics
SELECT c.customer_segment, COUNT(*) as customer_count, AVG(o.total_amount) as avg_order_value
FROM postgres.demo_ecommerce.customers c
JOIN postgres.demo_ecommerce.orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_segment;

-- HR analytics
SELECT d.department_name, COUNT(e.employee_id) as employee_count, AVG(e.salary) as avg_salary
FROM postgres.demo_hrms.departments d
JOIN postgres.demo_hrms.employees e ON d.department_id = e.department_id
GROUP BY d.department_name;

-- Product performance
SELECT category, SUM(total_sold) as total_units, SUM(total_revenue) as total_revenue
FROM postgres.demo_analytics.product_performance
GROUP BY category
ORDER BY total_revenue DESC;
```

## Schema Service Configuration

The FAISS Schema Service will automatically discover all schemas and tables in the `postgres` catalog:

- **Default Schema:** `demo_ecommerce` (for initial queries)
- **Discovery:** All schemas (`nexus`, `demo_ecommerce`, `demo_hrms`, `demo_analytics`)
- **Recommendations:** Based on natural language queries, will recommend appropriate tables from any schema

## Migration Notes

### From Old Structure:
- `dashboard.users` → `nexus.users`
- `ecommerce.customers` → `demo_ecommerce.customers`
- `hrms.employees` → `demo_hrms.employees`
- `analytics.monthly_sales` → `demo_analytics.monthly_sales`

### Benefits:
1. **Clear Separation:** Service data vs demo data
2. **Better Security:** Nexus service only accesses `nexus` schema
3. **Easier Maintenance:** Demo data can be updated independently
4. **Production Ready:** Can exclude demo schemas in production
5. **Better Organization:** Logical grouping of related tables
