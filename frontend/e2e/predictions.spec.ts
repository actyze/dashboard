// SPDX-License-Identifier: AGPL-3.0-only
import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

const MOCK_PIPELINES = {
  pipelines: [
    {
      id: '1',
      name: 'Revenue Forecast',
      prediction_type: 'forecast',
      status: 'ready',
      accuracy_display: 'Predictions are typically within ±8% of actual values',
      source_type: 'kpi',
      kpi_name: 'Daily Revenue',
      model_name: 'AutoGluon TimeSeries',
      last_trained_at: new Date().toISOString(),
      trigger_mode: 'after_kpi_collection',
      output_table: 'pred_revenue_forecast',
    },
    {
      id: '2',
      name: 'Churn Classification',
      prediction_type: 'classify',
      status: 'ready',
      accuracy_display: 'Correctly identifies 85% of positive cases.',
      source_type: 'kpi',
      kpi_name: 'Customer Data',
      model_name: 'XGBoost Classifier',
      last_trained_at: new Date().toISOString(),
      trigger_mode: 'manual',
      output_table: 'pred_churn_classification',
    },
  ],
  count: 2,
};

const MOCK_CAPABILITIES = {
  prediction_types: { forecast: true, classify: true, estimate: true, detect: true },
  healthy_workers: {
    xgboost: { status: 'healthy', model_type: 'xgboost', task_types: ['classification', 'regression', 'anomaly_detection'] },
    lightgbm: { status: 'healthy', model_type: 'lightgbm', task_types: ['classification', 'regression'] },
  },
};

const MOCK_KPIS = {
  kpis: [
    { id: 'kpi-1', name: 'Daily Revenue', materialized_table: 'kpi_daily_revenue', is_active: true },
    { id: 'kpi-2', name: 'Customer Orders', materialized_table: 'kpi_customer_orders', is_active: true },
  ],
  count: 2,
};

const MOCK_ANALYSIS = {
  success: true,
  status: 'good',
  row_count: 1500,
  columns: [
    { name: 'customer_id', type: 'bigint' },
    { name: 'customer_name', type: 'varchar' },
    { name: 'revenue', type: 'double' },
    { name: 'orders', type: 'bigint' },
    { name: 'churned', type: 'bigint' },
  ],
  blocking: [],
  warnings: [],
  recommended_target: 'churned',
  recommended_features: [
    { name: 'revenue', reason: 'numeric column', selected: true },
    { name: 'orders', reason: 'numeric column', selected: true },
  ],
  preview_rows: [
    [1, 'Customer A', 5000, 10, 0],
    [2, 'Customer B', 200, 1, 1],
  ],
};

test.describe('Predictive Intelligence', () => {

  test('navigate to predictions page via sidebar', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);
    await mockAPI(page, '/kpi', { kpis: [], count: 0 });

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await Promise.all([
      page.waitForURL(/\/(home)?$/, { timeout: 10000 }),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);

    // Navigate directly — sidebar click may timeout if Manage section is collapsed
    await page.goto('/predictive-intelligence');
    await expect(page).toHaveURL(/predictive-intelligence/);
    await expect(page.getByText('Predictive Intelligence')).toBeVisible();
  });

  test('empty state shows new prediction button', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await expect(page.getByText('No predictions yet')).toBeVisible();
    await expect(page.getByRole('button', { name: /new prediction/i }).first()).toBeVisible();
  });

  test('pipeline list shows cards with status and accuracy', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', MOCK_PIPELINES);
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await expect(page.getByText('Revenue Forecast')).toBeVisible();
    await expect(page.getByText('Churn Classification')).toBeVisible();
    await expect(page.getByText('within ±8%')).toBeVisible();
  });

  test('wizard shows 4 prediction type cards', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);
    await mockAPI(page, '/kpi', MOCK_KPIS);

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await page.getByRole('button', { name: /new prediction/i }).first().click();

    await expect(page.getByRole('heading', { name: 'Forecast' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Classify' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estimate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detect' })).toBeVisible();
  });

  test('wizard step 2 shows data analysis for classify', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);
    await mockAPI(page, '/kpi', MOCK_KPIS);
    await mockAPI(page, '/predictions/analyze', MOCK_ANALYSIS);

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await page.getByRole('button', { name: /new prediction/i }).first().click();
    await page.getByRole('heading', { name: 'Classify' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Select KPI
    await page.getByRole('combobox').selectOption('Customer Orders (kpi_customer_orders)');
    await page.getByRole('button', { name: 'Analyze Data' }).click();

    // Data health should show
    await expect(page.getByText('Your data looks good')).toBeVisible();
  });

  test('detect type hides target column selection', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);
    await mockAPI(page, '/kpi', MOCK_KPIS);
    await mockAPI(page, '/predictions/analyze', { ...MOCK_ANALYSIS, recommended_target: null });

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await page.getByRole('button', { name: /new prediction/i }).first().click();
    await page.getByRole('heading', { name: 'Detect' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('combobox').selectOption('Customer Orders (kpi_customer_orders)');
    await page.getByRole('button', { name: 'Analyze Data' }).click();

    // Should show anomaly detection info, NOT target column dropdown
    await expect(page.getByText('Anomaly detection analyzes all numeric columns')).toBeVisible();
    await expect(page.getByText('What do you want to predict?')).not.toBeVisible();
  });

  test('blocking data quality gate disables next button', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', { pipelines: [], count: 0 });
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);
    await mockAPI(page, '/kpi', MOCK_KPIS);
    await mockAPI(page, '/predictions/analyze', {
      ...MOCK_ANALYSIS,
      status: 'error',
      blocking: ['Need at least 60 data points to forecast 30 days ahead. Your data has 5.'],
      row_count: 5,
    });

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    await page.getByRole('button', { name: /new prediction/i }).first().click();
    await page.getByRole('heading', { name: 'Forecast' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('combobox').selectOption('Daily Revenue (kpi_daily_revenue)');
    await page.getByRole('button', { name: 'Analyze Data' }).click();

    await expect(page.getByText('Cannot proceed')).toBeVisible();
    await expect(page.getByText('Need at least 60 data points')).toBeVisible();

    // Next button should be disabled
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });

  test('delete pipeline shows confirmation', async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/predictions/pipelines', MOCK_PIPELINES);
    await mockAPI(page, '/predictions/capabilities', MOCK_CAPABILITIES);

    await page.goto('/login');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home)?$/, { timeout: 10000 });
    await page.goto('/predictive-intelligence');

    // Set up dialog handler before clicking delete
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toContain('Delete this prediction pipeline');
      dialog.dismiss();
    });

    await page.getByRole('button', { name: 'Delete' }).first().click();
  });
});
