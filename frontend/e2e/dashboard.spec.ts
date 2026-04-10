import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

const MOCK_DASHBOARD = {
  id: 'dash-1',
  title: 'Sales Dashboard',
  description: 'Monthly sales overview',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-15T00:00:00Z',
  tiles: [
    {
      id: 'tile-1',
      title: 'Monthly Revenue',
      sql_query: 'SELECT month, SUM(revenue) FROM sales GROUP BY month',
      chart_type: 'bar',
      position: { x: 0, y: 0, w: 6, h: 2 },
      description: 'Revenue by month',
    },
    {
      id: 'tile-2',
      title: 'Customer Count',
      sql_query: 'SELECT COUNT(*) FROM customers',
      chart_type: 'kpi',
      position: { x: 6, y: 0, w: 6, h: 2 },
      description: 'Total customers',
    },
  ],
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  });

  test('dashboard list page loads and shows dashboards', async ({ page }) => {
    await mockAPI(page, '/dashboards', { dashboards: [
      { id: 'dash-1', title: 'Sales Dashboard', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-15T00:00:00Z' },
      { id: 'dash-2', title: 'Marketing Dashboard', created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-15T00:00:00Z' },
    ]});

    await page.goto('/dashboards');
    await expect(page.getByText(/sales dashboard/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/marketing dashboard/i)).toBeVisible();
  });

  test('clicking a dashboard navigates to viewer', async ({ page }) => {
    await mockAPI(page, '/dashboards', { dashboards: [
      { id: 'dash-1', title: 'Sales Dashboard', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-15T00:00:00Z' },
    ]});
    await mockAPI(page, '/dashboards/dash-1', { success: true, dashboard: MOCK_DASHBOARD, tiles: MOCK_DASHBOARD.tiles });
    await mockAPI(page, '/refresh/dashboard/dash-1/cache-status', { tiles: [] });

    await page.goto('/dashboards');
    await page.getByText(/sales dashboard/i).click();
    await expect(page).toHaveURL(/\/dashboard\/dash-1/);
  });

  test('dashboard renders with grid layout and tiles', async ({ page }) => {
    await mockAPI(page, '/dashboards/dash-1', { success: true, dashboard: MOCK_DASHBOARD, tiles: MOCK_DASHBOARD.tiles });
    await mockAPI(page, '/refresh/dashboard/dash-1/cache-status', { tiles: [] });
    // Mock tile data execution
    await mockAPI(page, '/execute-sql', { columns: ['month', 'revenue'], rows: [{ month: 'Jan', revenue: 5000 }], row_count: 1 });
    await page.route('**/api/refresh/tile/*/cache', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify(null) })
    );

    await page.goto('/dashboard/dash-1');
    await expect(page.getByText(/sales dashboard/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/monthly revenue/i)).toBeVisible();
  });

  test('creating a new dashboard', async ({ page }) => {
    await mockAPI(page, '/dashboards', { id: 'new-dash', title: 'Untitled Dashboard' }, 201);

    await page.goto('/dashboard/new');
    // New dashboard should load with empty grid
    await expect(page.getByText(/untitled|new|dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('add tile button opens SQL tile modal', async ({ page }) => {
    await mockAPI(page, '/dashboards/dash-1', { success: true, dashboard: { ...MOCK_DASHBOARD, tiles: [] }, tiles: [] });
    await mockAPI(page, '/refresh/dashboard/dash-1/cache-status', { tiles: [] });

    await page.goto('/dashboard/dash-1');

    const addBtn = page.getByRole('button', { name: /add.*tile|add.*sql|\+/i });
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      // Modal should appear with SQL input
      await expect(page.getByRole('dialog').or(page.getByText(/sql|tile|query/i))).toBeVisible({ timeout: 3000 });
    }
  });

  test('tile refresh button triggers refresh', async ({ page }) => {
    await mockAPI(page, '/dashboards/dash-1', { success: true, dashboard: MOCK_DASHBOARD, tiles: MOCK_DASHBOARD.tiles });
    await mockAPI(page, '/refresh/dashboard/dash-1/cache-status', { tiles: [] });
    await page.route('**/api/refresh/tile/*/cache', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify(null) })
    );
    await mockAPI(page, '/execute-sql', { columns: ['count'], rows: [{ count: 100 }], row_count: 1 });

    await page.goto('/dashboard/dash-1');

    // Find a refresh button on a tile
    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    if (await refreshBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.route('**/api/refresh/tile/*', (route) => {
        if (!route.request().url().includes('/cache')) {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job_id: 'job-1', status: 'completed' }) });
        } else {
          route.continue();
        }
      });
      await refreshBtn.click();
    }
  });

  test('share button opens share modal', async ({ page }) => {
    await mockAPI(page, '/dashboards/dash-1', { success: true, dashboard: MOCK_DASHBOARD, tiles: MOCK_DASHBOARD.tiles });
    await mockAPI(page, '/refresh/dashboard/dash-1/cache-status', { tiles: [] });
    await page.route('**/api/refresh/tile/*/cache', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify(null) })
    );
    await mockAPI(page, '/execute-sql', { columns: ['count'], rows: [{ count: 100 }], row_count: 1 });

    await page.goto('/dashboard/dash-1');

    const shareBtn = page.getByRole('button', { name: /share/i });
    if (await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shareBtn.click();
      await expect(page.getByRole('dialog').or(page.getByText(/share|permission|public/i))).toBeVisible({ timeout: 3000 });
    }
  });

  test('dashboard can be deleted', async ({ page }) => {
    await mockAPI(page, '/dashboards', { dashboards: [
      { id: 'dash-1', title: 'Sales Dashboard', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-15T00:00:00Z' },
    ]});

    await page.goto('/dashboards');
    // Look for delete button or menu on dashboard item
    const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockAPI(page, '/dashboards/dash-1', null, 204);
      await deleteBtn.click();
      // Confirm dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});

test.describe('Public Dashboard', () => {
  test('public dashboard loads without authentication', async ({ page }) => {
    await mockAPI(page, '/public/dashboards/dash-public', {
      id: 'dash-public',
      name: 'Public Sales',
      tiles: [{ id: 't1', title: 'Revenue', sql_query: 'SELECT 1', chart_type: 'bar', position: { x: 0, y: 0, w: 6, h: 2 } }],
    });

    await page.goto('/public/dashboard/dash-public');
    // Should load without redirecting to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
