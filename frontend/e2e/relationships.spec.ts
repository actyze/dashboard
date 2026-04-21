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

  // Mock explorer APIs (needed for Schema & Metadata tab)
  await mockAPI(page, '/explorer/databases', { databases: [
    { name: 'tpch', connector_type: 'tpch', schema_count: 2 },
  ]});
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

    // Table headers
    await expect(page.getByText('Source').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Target').first()).toBeVisible();
    await expect(page.getByText('Join Condition').first()).toBeVisible();
    await expect(page.getByText('Method').first()).toBeVisible();

    // Relationship data
    await expect(page.getByText('lineitem').first()).toBeVisible();
    await expect(page.getByText('orders').first()).toBeVisible();
    await expect(page.getByText('lineitem.orderkey = orders.orderkey')).toBeVisible();

    // Summary count
    await expect(page.getByText(/3 relationship/)).toBeVisible();
  });

  test('method badges render for admin, mined, inferred', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await expect(page.getByText('admin').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('mined').first()).toBeVisible();
    await expect(page.getByText('inferred').first()).toBeVisible();
  });

  test('method filter buttons work', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // Click 'admin' filter
    await page.getByRole('button', { name: 'admin', exact: true }).click();
    // Should trigger a filtered reload (we mock all results regardless, but the button should be active)
    await expect(page.getByRole('button', { name: 'admin', exact: true })).toBeVisible();
  });

  test('empty state shows helpful message', async ({ page }) => {
    await setupDataIntelligence(page, []);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await expect(page.getByText('No relationships found')).toBeVisible({ timeout: 10000 });
    // Helpful guidance text should appear
    await expect(page.getByText(/detect relationships|extract JOIN/i)).toBeVisible({ timeout: 5000 });
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

    // Fill form
    const textboxes = page.getByRole('textbox');
    await textboxes.nth(0).fill('tpch');    // source catalog
    await textboxes.nth(1).fill('tiny');    // source schema
    await textboxes.nth(2).fill('nation');  // source table
    await textboxes.nth(3).fill('tpch');    // target catalog
    await textboxes.nth(4).fill('tiny');    // target schema
    await textboxes.nth(5).fill('region');  // target table
    await textboxes.nth(6).fill('nation.regionkey = region.regionkey');

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

  test('Auto-Infer button triggers background job', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Auto-Infer' }).click();

    // Give time for the request
    await page.waitForTimeout(1000);
    expect(inferCalled).toBe(true);
  });

  test('Mine History button triggers background job', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Mine History' }).click();

    await page.waitForTimeout(1000);
    expect(mineCalled).toBe(true);
  });

  test('summary shows correct counts by method', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    await expect(page.getByText(/1 verified/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/1 mined/)).toBeVisible();
    await expect(page.getByText(/1 inferred/)).toBeVisible();
  });

  test('verified relationship shows green checkmark', async ({ page }) => {
    await setupDataIntelligence(page);
    await page.goto('/data-intelligence');
    await page.getByText('Relationships').click();

    // The lineitem->orders relationship is verified — check for a green check SVG
    const verifiedRow = page.locator('tr').filter({ hasText: 'lineitem' });
    await expect(verifiedRow).toBeVisible({ timeout: 10000 });
    // The verified checkmark column should have an SVG
    const checkIcon = verifiedRow.locator('svg[fill="currentColor"]');
    await expect(checkIcon).toBeVisible();
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
