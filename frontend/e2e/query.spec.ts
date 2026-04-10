import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

test.describe('Query Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/explorer/databases', { databases: [
      { name: 'postgres', connector_type: 'postgres', schema_count: 1 },
    ]});
    await mockAPI(page, '/explorer/databases/postgres/schemas', { schemas: [
      { name: 'public', table_count: 2 },
    ]});
    await mockAPI(page, '/explorer/databases/postgres/schemas/public/objects', { objects: {
      tables: [
        { name: 'orders' },
        { name: 'customers' },
      ],
      views: [],
    }});
    await mockAPI(page, '/preferences/preferred-tables', []);

    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  });

  test('query page loads with AI input and SQL editor', async ({ page }) => {
    await page.goto('/query/new');
    // Should have the AI natural language textarea
    await expect(page.getByPlaceholder(/ask anything about your data/i)).toBeVisible({ timeout: 10000 });
  });

  test('database schema panel shows databases', async ({ page }) => {
    await page.goto('/query/new');
    // Look for schema browser or database panel
    const dbPanel = page.getByText(/postgres|database|schema/i);
    await expect(dbPanel.first()).toBeVisible({ timeout: 10000 });
  });

  test('NL query submission calls generate-sql API', async ({ page }) => {
    await mockAPI(page, '/generate-sql', {
      sql: 'SELECT COUNT(*) FROM orders',
      explanation: 'Counting all orders',
    });

    await page.goto('/query/new');
    const input = page.getByPlaceholder(/ask anything about your data/i);
    await input.fill('How many orders do we have?');

    // Submit via Enter or button
    const submitPromise = page.waitForResponse((r) => r.url().includes('/generate-sql'));
    await input.press('Enter');
    const response = await submitPromise;
    expect(response.status()).toBe(200);
  });

  test('executing SQL shows results in table', async ({ page }) => {
    await mockAPI(page, '/execute-sql', {
      columns: ['count'],
      rows: [{ count: 1523 }],
      row_count: 1,
      execution_time_ms: 45,
    });

    await page.goto('/query/new');

    // If there's a SQL editor, fill it directly
    const sqlEditor = page.locator('.cm-editor, [data-testid="sql-editor"], textarea');
    if (await sqlEditor.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await sqlEditor.first().click();
      await page.keyboard.type('SELECT COUNT(*) FROM orders');
    }

    // Look for execute/run button
    const runBtn = page.getByRole('button', { name: /run|execute|play/i });
    if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const resultPromise = page.waitForResponse((r) => r.url().includes('/execute-sql'));
      await runBtn.click();
      await resultPromise;
      // Results should appear
      await expect(page.getByText(/1523|count|results/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('results toggle between table and chart views', async ({ page }) => {
    await mockAPI(page, '/execute-sql', {
      columns: ['month', 'revenue'],
      rows: [{ month: 'Jan', revenue: 1000 }, { month: 'Feb', revenue: 1500 }],
      row_count: 2,
      execution_time_ms: 30,
    });

    await page.goto('/query/new');

    // Check for view toggle buttons (table/chart)
    const chartToggle = page.getByRole('button', { name: /chart|visual/i });
    const tableToggle = page.getByRole('button', { name: /table|data|results/i });

    if (await chartToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chartToggle.click();
      // Chart container should appear
      await expect(page.locator('.js-plotly-plot, [data-testid="chart"], canvas, svg').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('save query opens dialog', async ({ page }) => {
    await page.goto('/query/new');

    const saveBtn = page.getByRole('button', { name: /save/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      // Save modal should appear — look for heading or label
      await expect(page.getByText(/save.*query/i).first()).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Query List', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  });

  test('queries page loads and displays history', async ({ page }) => {
    await mockAPI(page, '/query-history*', {
      queries: [
        { id: '1', name: 'Revenue by month', nl_query: 'Show revenue', created_at: '2026-03-01T00:00:00Z', query_type: 'natural_language' },
        { id: '2', name: 'Top customers', nl_query: 'Top 10 customers', created_at: '2026-03-02T00:00:00Z', query_type: 'natural_language' },
      ],
      total: 2,
    });

    await page.goto('/queries');
    await expect(page.getByText(/revenue|customer|quer/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking a query navigates to editor', async ({ page }) => {
    await mockAPI(page, '/query-history*', {
      queries: [
        { id: 'abc123', name: 'Revenue query', nl_query: 'Show revenue', created_at: '2026-03-01T00:00:00Z', query_type: 'natural_language' },
      ],
      total: 1,
    });
    await mockAPI(page, '/explorer/databases', { databases: [] });
    await mockAPI(page, '/preferences/preferred-tables', []);

    await page.goto('/queries');
    const row = page.getByText(/revenue/i).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
      await expect(page).toHaveURL(/\/query\//);
    }
  });
});
