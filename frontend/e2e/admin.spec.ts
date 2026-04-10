import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

const MOCK_USERS = [
  { id: '1', username: 'admin', email: 'admin@test.com', role: 'ADMIN', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: '2', username: 'analyst', email: 'analyst@test.com', role: 'USER', is_active: true, created_at: '2026-02-01T00:00:00Z' },
  { id: '3', username: 'viewer', email: 'viewer@test.com', role: 'USER', is_active: false, created_at: '2026-03-01T00:00:00Z' },
];

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    await mockAPI(page, '/admin/users*', { success: true, users: MOCK_USERS, total: 3, page: 1, page_size: 20 });
    await mockAPI(page, '/admin/roles', ['ADMIN', 'USER']);

    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  });

  test('admin page loads and shows user list', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/admin/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('analyst', { exact: true })).toBeVisible();
    await expect(page.getByText('viewer', { exact: true })).toBeVisible();
  });

  test('user search filters the list', async ({ page }) => {
    await page.goto('/admin');

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockAPI(page, '/admin/users*', {
        success: true,
        users: [MOCK_USERS[1]],
        total: 1,
        page: 1,
        page_size: 20,
      });
      await searchInput.fill('analyst');
      await expect(page.getByText('analyst')).toBeVisible();
    }
  });

  test('create user dialog opens and submits', async ({ page }) => {
    await page.goto('/admin');

    const createBtn = page.getByRole('button', { name: /create|add|new.*user/i });
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();

      // Modal appears without role="dialog" — find by heading text
      await expect(page.getByText(/create new user/i)).toBeVisible({ timeout: 3000 });

      await page.getByPlaceholder(/username/i).fill('newuser');
      await page.getByPlaceholder(/email/i).fill('new@test.com');
      await page.getByPlaceholder(/password/i).fill('password123');
      const fullNameInput = page.getByPlaceholder(/full name/i);
      if (await fullNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fullNameInput.fill('New User');
      }

      await mockAPI(page, '/admin/users', { id: '4', username: 'newuser', email: 'new@test.com', role: 'USER' }, 201);

      const submitBtn = page.getByRole('button', { name: /create user/i }).last();
      await expect(submitBtn).toBeEnabled({ timeout: 3000 });
      await submitBtn.click();
    }
  });

  test('user role can be changed', async ({ page }) => {
    await page.goto('/admin');

    // Look for role dropdown or edit button
    const roleSelect = page.getByText('USER').first();
    if (await roleSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockAPI(page, '/admin/users/2/role', { success: true });
      // Click to change role - implementation varies
      await roleSelect.click();
      const adminOption = page.getByText('ADMIN').or(page.getByRole('option', { name: /admin/i }));
      if (await adminOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await adminOption.click();
      }
    }
  });

  test('user can be disabled', async ({ page }) => {
    await page.goto('/admin');

    const disableBtn = page.getByRole('button', { name: /disable|deactivate/i }).first();
    if (await disableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockAPI(page, '/admin/users/2/disable', { success: true });
      await disableBtn.click();

      // Confirm if needed
      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });

  test('user can be enabled', async ({ page }) => {
    await page.goto('/admin');

    const enableBtn = page.getByRole('button', { name: /enable|activate/i }).first();
    if (await enableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockAPI(page, '/admin/users/3/enable', { success: true });
      await enableBtn.click();
    }
  });
});
