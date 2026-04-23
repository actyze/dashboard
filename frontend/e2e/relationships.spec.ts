// SPDX-License-Identifier: AGPL-3.0-only
import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

// Mock relationship data
const MOCK_RELATIONSHIPS = [
  {
    id: 1, source_catalog: 'tpch', source_schema: 'tiny', source_table: 'lineitem',
    target_catalog: 'tpch', target_schema: 'tiny', target_table: 'orders',
    join_condition: 'lineitem.orderkey = orders.orderkey', relationship_type: '1:N',
    source_method: 'admin', confidence: 1.0, is_verified: true, is_disabled: false,
    usage_count: 5, source_full_name: 'tpch.tiny.lineitem', target_full_name: 'tpch.tiny.orders',
  },
  {
    id: 2, source_catalog: 'tpch', source_schema: 'tiny', source_table: 'orders',
    target_catalog: 'tpch', target_schema: 'tiny', target_table: 'customer',
    join_condition: 'orders.custkey = customer.custkey', relationship_type: 'N:1',
    source_method: 'mined', confidence: 0.75, is_verified: false, is_disabled: false,
    usage_count: 3, source_full_name: 'tpch.tiny.orders', target_full_name: 'tpch.tiny.customer',
  },
  {
    id: 3, source_catalog: 'tpch', source_schema: 'tiny', source_table: 'part',
    target_catalog: 'tpch', target_schema: 'tiny', target_table: 'partsupp',
    join_condition: 'part.partkey = partsupp.partkey', relationship_type: '1:N',
    source_method: 'inferred', confidence: 0.5, is_verified: false, is_disabled: false,
    usage_count: 0, source_full_name: 'tpch.tiny.part', target_full_name: 'tpch.tiny.partsupp',
  },
];

async function setupDataIntelligence(page, relationships = MOCK_RELATIONSHIPS) {
  await mockAuth(page);
  // Override the user mock to include roles array (mockAuth returns role string, but component checks roles array)
  await page.route('**/auth/users/me*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'admin', email: 'admin@test.com', role: 'ADMIN', roles: ['ADMIN'], is_active: true }),
    })
  );
  await mockHomeData(page);

  // Mock explorer APIs (needed for Schema & Metadata tab + create-relationship dropdowns)
  await mockAPI(page, '/explorer/databases', { databases: [
    { name: 'tpch', connector_type: 'tpch', schema_count: 2 },
  ]});
  await mockAPI(page, '/explorer/databases/tpch/schemas', { schemas: [{ name: 'tiny' }] });
  await mockAPI(page, '/explorer/databases/tpch/schemas/tiny/objects', {
    objects: { tables: [{ name: 'nation' }, { name: 'region' }], views: [] },
  });
  await mockAPI(page, '/metadata/descriptions*', []);
  await mockAPI(page, '/preferences/preferred-tables', []);
  await mockAPI(page, '/v1/exclusions*', []);
  await mockAPI(page, '/file-uploads/tables', []);

  // Mock relationships API
  await page.route((url) => url.pathname === '/api/relationships' && !url.pathname.includes('/infer') && !url.pathname.includes('/mine'), (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          relationships,
          count: relationships.length,
        }),
      });
    }
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          relationship: {
            id: 99, ...body, source_method: 'admin', confidence: 1.0,
            is_verified: false, is_disabled: false, usage_count: 0,
          },
        }),
      });
    }
    return route.continue();
  });

  // Mock verify/disable/delete
  await page.route((url) => /\/api\/relationships\/\d+/.test(url.pathname), (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, relationship: MOCK_RELATIONSHIPS[0], message: 'OK' }),
    });
  });

  // Mock infer/mine
  await mockAPI(page, '/relationships/infer', { success: true, message: 'Inference started' });
  await mockAPI(page, '/relationships/mine', { success: true, message: 'Mining started' });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
}


test.describe('Data Intelligence — Relationships Tab', () => {

  test('tabs render correctly with renamed Schema & Metadata', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');

    await expect(page.getByText('Schema & Metadata')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Relationships')).toBeVisible();
    await expect(page.getByText('File Imports')).toBeVisible();
  });

  test('Relationships tab shows relationship list with columns', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // Table headers (Method column removed — method now renders as a pill next to the source table name)
    await expect(page.getByText('Source').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Target').first()).toBeVisible();
    await expect(page.getByText('Join Condition').first()).toBeVisible();
    await expect(page.getByText('Confidence').first()).toBeVisible();

    // Relationship data
    await expect(page.getByText('lineitem').first()).toBeVisible();
    await expect(page.getByText('orders').first()).toBeVisible();
    await expect(page.getByText('lineitem.orderkey = orders.orderkey')).toBeVisible();

    // Total count is carried in the All filter pill
    await expect(page.getByRole('button', { name: /^All\s*3$/ })).toBeVisible();
  });

  test('method badges render with renamed labels (Manual, Observed, Suggested)', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // Row badges — "Manual" admin badge is suppressed in the Confidence cell (shown as Verified),
    // but the inline method pill next to the source table still reads "Manual".
    await expect(page.getByText('Manual').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Observed').first()).toBeVisible();
    await expect(page.getByText('Suggested').first()).toBeVisible();
  });

  test('method filter buttons work', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // Pill accessible name includes the inline count, e.g. "Manual 1"
    const manualPill = page.getByRole('button', { name: /^Manual\s*1$/ });
    await manualPill.click();
    await expect(manualPill).toBeVisible();
  });

  test('empty state shows helpful message', async ({ page }) => {
    await setupDataIntelligence(page, []);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await expect(page.getByText('No relationships yet')).toBeVisible({ timeout: 10000 });
    // Helpful guidance text should reference the new action names
    await expect(page.getByText(/Detect|\+ Add/i)).toBeVisible({ timeout: 5000 });
  });

  test('+ Add button opens create modal', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await page.getByRole('button', { name: '+ Add' }).click();
    await expect(page.getByText('Add Relationship')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Add Relationship')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('create modal submits and closes', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await page.getByRole('button', { name: '+ Add' }).click();
    await expect(page.getByText('Add Relationship')).toBeVisible({ timeout: 5000 });

    // Catalog/schema/table are dependent <select> dropdowns, not text inputs
    const catalogSelects = page.getByLabel('Catalog');
    const schemaSelects = page.getByLabel('Schema');
    const tableSelects = page.getByLabel('Table');

    await catalogSelects.nth(0).selectOption('tpch');
    await schemaSelects.nth(0).selectOption('tiny');
    await tableSelects.nth(0).selectOption('nation');

    await catalogSelects.nth(1).selectOption('tpch');
    await schemaSelects.nth(1).selectOption('tiny');
    await tableSelects.nth(1).selectOption('region');

    await page.getByLabel('Join condition').fill('nation.regionkey = region.regionkey');

    await page.getByRole('button', { name: 'Create' }).click();

    // Modal should close
    await expect(page.getByText('Add Relationship')).not.toBeVisible({ timeout: 5000 });
  });

  test('cancel button closes create modal', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await page.getByRole('button', { name: '+ Add' }).click();
    await expect(page.getByText('Add Relationship')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Add Relationship')).not.toBeVisible({ timeout: 3000 });
  });

  test('Detect menu — Suggest from column names triggers infer job', async ({ page }) => {
    let inferCalled = false;
    await setupDataIntelligence(page);

    await page.route((url) => url.pathname === '/api/relationships/infer', (route) => {
      inferCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Inference started' }),
      });
    });

    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();
    await page.getByRole('button', { name: /Detect/ }).click();
    await page.getByText('Suggest from column names').click();

    await page.waitForTimeout(1000);
    expect(inferCalled).toBe(true);
  });

  test('Detect menu — Learn from query history triggers mine job', async ({ page }) => {
    let mineCalled = false;
    await setupDataIntelligence(page);

    await page.route((url) => url.pathname === '/api/relationships/mine', (route) => {
      mineCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Mining started' }),
      });
    });

    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();
    await page.getByRole('button', { name: /Detect/ }).click();
    await page.getByText('Learn from query history').click();

    await page.waitForTimeout(1000);
    expect(mineCalled).toBe(true);
  });

  test('filter pills show counts per method', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // MOCK_RELATIONSHIPS has 1 admin, 1 mined, 1 inferred
    await expect(page.getByRole('button', { name: /^All\s*3$/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^Suggested\s*1$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Observed\s*1$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Manual\s*1$/ })).toBeVisible();
  });

  test('verified / admin relationship renders as Verified', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // The lineitem->orders relationship is admin+verified; its Confidence cell should
    // read "Verified" (replacing the confidence bar).
    const verifiedRow = page.locator('tr').filter({ hasText: 'lineitem' });
    await expect(verifiedRow).toBeVisible({ timeout: 10000 });
    await expect(verifiedRow.getByText('Verified')).toBeVisible();
  });
});


test.describe('Data Intelligence — Schema & Metadata Tab', () => {

  test('Schema & Metadata tab loads and shows databases', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');

    // Default tab should be Schema & Metadata
    await expect(page.getByText('Schema & Metadata')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('tpch').first()).toBeVisible({ timeout: 10000 });
  });

  test('switching between tabs preserves state', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');

    // Go to Relationships
    await page.getByText('Relationships').click();
    await expect(page.getByText(/relationship/).first()).toBeVisible({ timeout: 10000 });

    // Go back to Schema & Metadata
    await page.getByText('Schema & Metadata').click();
    await expect(page.getByText('tpch').first()).toBeVisible({ timeout: 10000 });

    // Go to File Imports
    await page.getByText('File Imports').click();
    await expect(page.getByText(/upload|import|drag|no.*file/i).first()).toBeVisible({ timeout: 10000 });
  });
});
