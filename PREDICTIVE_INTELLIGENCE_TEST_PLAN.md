# Predictive Intelligence — End-to-End Test Plan

## Prerequisites
- All services running: postgres, trino, schema-service, nexus, frontend
- Prediction workers running: prediction-worker-xgboost, prediction-worker-lightgbm
- Login: nexus_admin / admin
- TPC-H data available via Trino (tpch.tiny.*)

## Test Data Setup

Before testing predictions, we need at least one KPI with materialized data.

### KPI 1: Daily Order Revenue (for Forecast testing)
```sql
SELECT
  orderdate as date,
  SUM(totalprice) as revenue,
  COUNT(*) as order_count,
  AVG(totalprice) as avg_order_value
FROM tpch.tiny.orders
GROUP BY orderdate
ORDER BY orderdate
```

### KPI 2: Customer Orders (for Classify/Estimate testing)
```sql
SELECT
  c.custkey as customer_id,
  c.name as customer_name,
  c.mktsegment as segment,
  COUNT(o.orderkey) as total_orders,
  SUM(o.totalprice) as total_spent,
  AVG(o.totalprice) as avg_order_value,
  CASE WHEN COUNT(o.orderkey) <= 2 THEN 'churned' ELSE 'active' END as status
FROM tpch.tiny.customer c
LEFT JOIN tpch.tiny.orders o ON c.custkey = o.custkey
GROUP BY c.custkey, c.name, c.mktsegment
```

---

## Test Scenarios

### Test 1: Navigation & Empty State
1. Login with nexus_admin/admin
2. Click "Predictions" in sidebar
3. Verify: empty state shows "No predictions yet" with "New Prediction" button
4. Verify: page title shows "Predictive Intelligence"

### Test 2: Worker Health / Capabilities
1. Navigate to /predictive-intelligence
2. Click "+ New Prediction"
3. Verify: wizard Step 1 shows three cards (Forecast, Classify, Estimate)
4. Verify: cards are interactive (not greyed out) — workers are healthy
5. If AutoGluon not deployed: Forecast may show fallback available via XGBoost

### Test 3: Create KPI for Test Data
1. Navigate to /scheduled-kpis
2. Create KPI "Daily Order Revenue" with SQL from Test Data Setup above
3. Wait for first collection to complete (check status goes to green)
4. Create KPI "Customer Orders" with the second SQL
5. Wait for collection

### Test 4: Forecast Pipeline (via KPI source)
1. Navigate to /predictive-intelligence → "+ New Prediction"
2. **Step 1**: Select "Forecast" card → Next
3. **Step 2**:
   - Source: "Use an existing KPI"
   - Select "Daily Order Revenue"
   - Click "Analyze Data"
   - Verify: Data Health card shows green (sufficient rows)
   - Verify: target column auto-detects "revenue"
   - Verify: horizon selector shows (7/30/90/Custom)
   - Select 30 days
   - Click Next
4. **Step 3**:
   - Verify: auto-generated name like "Daily Order Revenue Forecast - 30d"
   - Verify: trigger mode defaults to "Every time new data arrives"
   - Click "Create & Train Now"
5. Verify: redirected to pipeline list
6. Verify: new card shows "Training..." status
7. Wait ~10s, refresh: verify status changes to "Ready" with accuracy display
8. Click the card → verify detail view shows:
   - Status: Ready
   - Accuracy text (e.g., "Predictions within ±X% of actual values")
   - Raw metrics (MAE, RMSE)
   - Output table name
   - Configuration summary
   - Run history with 1 completed run

### Test 5: Classify Pipeline (via KPI source)
1. Navigate to /predictive-intelligence → "+ New Prediction"
2. **Step 1**: Select "Classify" → Next
3. **Step 2**:
   - Source: "Use an existing KPI"
   - Select "Customer Orders"
   - Click "Analyze Data"
   - Verify: Data Health shows status
   - Target: select "status" (should auto-detect binary: churned/active)
   - Verify: feature checkboxes appear (total_orders, total_spent, avg_order_value, segment)
   - Verify: output column checkboxes appear (customer_id, customer_name)
   - Check customer_id and customer_name as output columns
   - Click Next
4. **Step 3**:
   - Verify name auto-generated
   - Select "Only when I trigger it" for trigger mode
   - Click "Create & Train Now"
5. Verify: training completes, accuracy shows "Correctly identifies X% of churned"

### Test 6: Estimate Pipeline (via SQL source)
1. Navigate to /predictive-intelligence → "+ New Prediction"
2. **Step 1**: Select "Estimate" → Next
3. **Step 2**:
   - Source: toggle to "Write a custom query"
   - Enter SQL:
     ```sql
     SELECT
       c.custkey as customer_id,
       c.name as customer_name,
       c.mktsegment as segment,
       n.name as nation,
       COUNT(o.orderkey) as total_orders,
       SUM(o.totalprice) as total_spent
     FROM tpch.tiny.customer c
     LEFT JOIN tpch.tiny.orders o ON c.custkey = o.custkey
     LEFT JOIN tpch.tiny.nation n ON c.nationkey = n.nationkey
     GROUP BY c.custkey, c.name, c.mktsegment, n.name
     ```
   - Click "Analyze Data"
   - Verify: columns discovered from the JOIN query
   - Target: select "total_spent"
   - Features: total_orders, segment, nation
   - Output columns: customer_id, customer_name
   - Click Next
4. **Step 3**: Create & Train
5. Verify: predictions written, accuracy shows "Estimates within ±X"

### Test 7: Data Quality Gate — Blocking
1. Create a new KPI with very few rows:
   ```sql
   SELECT orderdate as date, totalprice as revenue
   FROM tpch.tiny.orders LIMIT 5
   ```
2. Go to predictions → New → Forecast → select this KPI
3. Click "Analyze Data"
4. Set horizon to 30 days
5. Verify: Data Health card shows RED with blocking message:
   "Need at least 60 data points to forecast 30 days ahead. Your data has 5."
6. Verify: "Next" button is disabled

### Test 8: Data Quality Gate — Warning
1. Use the Customer Orders KPI
2. New Prediction → Classify → select it
3. Click Analyze
4. Verify: if class imbalance exists, amber warning shows

### Test 9: Retrain Pipeline
1. Go to pipeline list
2. Click "Retrain" on an existing pipeline
3. Verify: status changes to "Training..."
4. Wait for completion
5. Click into detail → verify Run History shows 2 runs

### Test 10: Delete Pipeline
1. Go to pipeline list
2. Click "Delete" on a pipeline
3. Verify: confirmation dialog appears
4. Confirm deletion
5. Verify: pipeline removed from list
6. Verify: prediction_data table dropped (check via SQL query)

### Test 11: Pipeline Detail View
1. Click into a "Ready" pipeline
2. Verify all sections render:
   - Status card (status, last trained, trigger mode, output table)
   - Accuracy card with business-friendly text + raw metrics
   - Configuration (target, features, output columns, model)
   - Run History (expandable, shows runs with status/duration/rows)
3. Click "Retrain Now" from detail view
4. Verify training starts

### Test 12: FAISS Registration
1. After a prediction pipeline is trained
2. Go to the main query interface
3. Ask: "show me revenue predictions" or "show me churn predictions"
4. Verify: the AI finds the prediction_data table in its context

### Test 13: KPI Collection Trigger
1. Create a pipeline with trigger_mode "Every time new data arrives"
2. Go to Scheduled KPIs → trigger collection on the linked KPI
3. Check prediction pipeline: verify it auto-retrains (run count increases)

---

## Playwright MCP Test Sequence

### Setup
```
1. Navigate to http://localhost:3000
2. Login: nexus_admin / admin
3. Wait for home page to load
```

### Happy Path Flow
```
1. Click sidebar "Scheduled KPIs"
2. Create KPI "Daily Order Revenue" (paste SQL, interval=1h)
3. Wait for collection to complete
4. Click sidebar "Predictions"
5. Verify empty state
6. Click "+ New Prediction"
7. Select "Forecast" card
8. Click "Next"
9. Select "Daily Order Revenue" from KPI dropdown
10. Click "Analyze Data"
11. Verify green health card
12. Select target column "revenue"
13. Select "30 days" horizon
14. Click "Next"
15. Verify auto-generated name
16. Click "Create & Train Now"
17. Verify pipeline card appears in list
18. Wait for "Ready" status (poll every 3s)
19. Click pipeline card
20. Verify accuracy display exists
21. Verify run history shows 1 completed run
22. Click "Retrain Now"
23. Verify training starts
24. Navigate back to list
25. Delete the pipeline
26. Verify list is empty
```

---

## Expected Output Tables

After Test 4 (Forecast):
```sql
SELECT * FROM postgres.prediction_data.pred_daily_order_revenue_forecast_30d LIMIT 5
-- forecast_date | revenue_predicted | revenue_lower | revenue_upper | predicted_at
```

After Test 5 (Classify):
```sql
SELECT * FROM postgres.prediction_data.pred_customer_orders_classification LIMIT 5
-- customer_id | customer_name | status_predicted | status_probability | predicted_at
```

After Test 6 (Estimate):
```sql
SELECT * FROM postgres.prediction_data.pred_customer_spending_estimate LIMIT 5
-- customer_id | customer_name | total_spent_predicted | predicted_at
```
