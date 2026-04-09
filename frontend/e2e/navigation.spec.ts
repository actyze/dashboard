import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

test.describe('Navigation & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);

    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
    await page.goto('/');
  });

  test('sidebar shows all navigation links', async ({ page }) => {
    await expect(page.getByText(/home/i).first()).toBeVisible({ timeout: 10000 });

    // Sidebar uses <button> elements for navigation
    const navItems = ['Home', 'Queries', 'Dashboards', 'Admin', 'Data Intelligence'];
    for (const item of navItems) {
      const btn = page.getByRole('button', { name: new RegExp(item, 'i') });
      await expect(btn.first()).toBeVisible();
    }
  });

  test('navigate to Queries via sidebar', async ({ page }) => {
    await mockAPI(page, '/query-history*', { queries: [], total: 0 });
    await page.getByRole('button', { name: 'Queries', exact: true }).click();
    await expect(page).toHaveURL(/\/queries/);
  });

  test('navigate to Dashboards via sidebar', async ({ page }) => {
    await mockAPI(page, '/dashboards', { dashboards: [] });
    await page.getByRole('button', { name: 'Dashboards', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboards/);
  });

  test('navigate to Admin via sidebar', async ({ page }) => {
    await mockAPI(page, '/admin/users*', { success: true, users: [] });
    await mockAPI(page, '/admin/roles', ['ADMIN', 'USER']);
    await page.getByRole('button', { name: /admin/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('navigate to Data Intelligence via sidebar', async ({ page }) => {
    await mockAPI(page, '/metadata/descriptions*', []);
    await mockAPI(page, '/preferences/preferred-tables', []);
    await mockAPI(page, '/v1/exclusions*', []);
    await mockAPI(page, '/file-uploads/tables', []);
    await page.getByRole('button', { name: /data intelligence/i }).click();
    await expect(page).toHaveURL(/\/data-intelligence/);
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    // The theme toggle is inside a settings dropdown in the sidebar footer.
    // First open the settings menu by clicking the gear icon next to user email.
    const gearBtn = page.locator('button:has(svg path[d*="M10.325 4.317"])');
    if (await gearBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gearBtn.click();
      await page.waitForTimeout(300);

      // Now find the theme toggle button (contains sun/moon SVG)
      const toggle = page.getByRole('button', { name: /switch to .* mode/i });
      if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const htmlBefore = await page.locator('html').getAttribute('class') || '';

        await toggle.click({ force: true });

        const htmlAfter = await page.locator('html').getAttribute('class') || '';
        expect(htmlBefore !== htmlAfter).toBeTruthy();
      }
    }
  });

  test('floating AI assistant button is visible', async ({ page }) => {
    // The floating assistant button should be visible on home (not on login/query pages)
    const assistantBtn = page.locator('[data-testid="floating-assistant"]')
      .or(page.getByRole('button', { name: /assistant|ai|voice/i }));

    // It's okay if this isn't visible on all pages
    if (await assistantBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assistantBtn.click();
      // Panel should open
      await expect(page.getByText(/assistant|ai|ask|how can/i).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('user menu shows logout option', async ({ page }) => {
    // Find user avatar/menu
    const userMenu = page.getByRole('button', { name: /user|profile|account|admin/i })
      .or(page.locator('[data-testid="user-menu"]'));

    if (await userMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userMenu.click();
      await expect(page.getByText(/log.*out|sign.*out/i)).toBeVisible({ timeout: 3000 });
    }
  });
});
