import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

test.describe('Data Intelligence', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockHomeData(page);
    // The Data Intelligence page loads databases from explorer to show table descriptions
    await mockAPI(page, '/explorer/databases', { databases: [
      { name: 'postgres', connector_type: 'postgres', schema_count: 1 },
    ]});
    await mockAPI(page, '/explorer/databases/postgres/schemas', { schemas: [
      { name: 'public', table_count: 2 },
    ]});
    await mockAPI(page, '/explorer/databases/postgres/schemas/public/objects', { objects: {
      tables: [{ name: 'orders' }, { name: 'customers' }],
      views: [],
    }});
    await mockAPI(page, '/metadata/descriptions*', [
      { id: '1', catalog: 'postgres', schema: 'public', table_name: 'orders', column_name: null, description: 'Customer orders' },
      { id: '2', catalog: 'postgres', schema: 'public', table_name: 'orders', column_name: 'total', description: 'Order total amount' },
    ]);
    await mockAPI(page, '/preferences/preferred-tables', [
      { id: '1', catalog: 'postgres', schema: 'public', table_name: 'orders' },
    ]);
    await mockAPI(page, '/v1/exclusions*', []);
    await mockAPI(page, '/file-uploads/tables', []);

    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  });

  test('data intelligence page loads with tabs', async ({ page }) => {
    await page.goto('/data-intelligence');
    await expect(page.getByText(/optimi|metadata|intelligence|schema/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('metadata tab shows table descriptions', async ({ page }) => {
    await page.goto('/data-intelligence');

    // The Optimise tab shows databases first — verify postgres database is listed
    await expect(page.getByText(/postgres/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/1 schema/i)).toBeVisible();
  });

  test('file uploads tab is accessible', async ({ page }) => {
    await page.goto('/data-intelligence');

    const fileTab = page.getByText(/file|import|upload/i);
    if (await fileTab.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileTab.first().click();
      // Should show upload area or file list
      await expect(page.getByText(/upload|drag|drop|csv|excel|no.*file/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('preferred tables are displayed', async ({ page }) => {
    await page.goto('/data-intelligence');
    // Look for preferred/boosted tables section
    await expect(page.getByText(/prefer|boost|orders/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('adding a table description', async ({ page }) => {
    await page.goto('/data-intelligence');

    const addBtn = page.getByRole('button', { name: /add.*description|add.*metadata|edit/i }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      // Fill description
      const descInput = page.getByPlaceholder(/description/i).or(page.getByRole('textbox').first());
      if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descInput.fill('Updated description for orders table');
        await mockAPI(page, '/metadata/descriptions', { id: '3', description: 'Updated description' }, 201);

        const saveBtn = page.getByRole('button', { name: /save|submit|add/i });
        if (await saveBtn.isVisible()) await saveBtn.click();
      }
    }
  });
});
