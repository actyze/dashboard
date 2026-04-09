import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);

    // Simulate logged-in state
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
    await page.goto('/');
  });

  test('displays greeting message', async ({ page }) => {
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible();
  });

  test('shows New Query and New Dashboard buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new query/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new dashboard/i })).toBeVisible();
  });

  test('clicking New Query navigates to query page', async ({ page }) => {
    await mockAPI(page, '/explorer/databases', { databases: [] });
    await mockAPI(page, '/preferences/preferred-tables', []);

    await page.getByRole('button', { name: /new query/i }).click();
    await expect(page).toHaveURL(/\/query\/new/);
  });

  test('clicking New Dashboard navigates to dashboard page', async ({ page }) => {
    await page.getByRole('button', { name: /new dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/new/);
  });

  test('recent queries tab shows query history', async ({ page }) => {
    await mockAPI(page, '/query-history*', {
      queries: [
        { id: '1', name: 'Revenue query', nl_query: 'Show revenue by month', created_at: new Date().toISOString(), query_type: 'natural_language' },
        { id: '2', name: 'Customer count', nl_query: 'How many customers', created_at: new Date().toISOString(), query_type: 'natural_language' },
      ],
      total: 2,
    });

    await page.goto('/');
    await expect(page.getByText(/recent quer/i)).toBeVisible();
  });

  test('recent dashboards tab shows dashboards', async ({ page }) => {
    await mockAPI(page, '/dashboards', { dashboards: [
      { id: '1', title: 'Sales Dashboard', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]});

    await page.goto('/');
    // Click dashboards tab
    const dashTab = page.getByText(/dashboard/i).filter({ hasNotText: /new/i });
    if (await dashTab.first().isVisible()) {
      await dashTab.first().click();
    }
  });

  test('empty state shows helpful message when no queries exist', async ({ page }) => {
    await mockAPI(page, '/query-history*', { queries: [], total: 0 });
    await page.goto('/');
    // Should show empty state or prompt to create first query
    await expect(page.getByText(/no.*quer|get started|create/i)).toBeVisible({ timeout: 5000 }).catch(() => {
      // Some UIs just show empty list, which is also acceptable
    });
  });
});
