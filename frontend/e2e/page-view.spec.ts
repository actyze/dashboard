import { test, expect } from '@playwright/test';
import { mockAuth, mockHomeData, mockAPI } from './fixtures';

// ─── Mock data ──────────────────────────────────────────────────────

const PAGE_DASHBOARD = {
  id: 'page-dash-1',
  title: 'Page View Test',
  view_type: 'page',
  page_data: { content: [], root: {} },
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

// Metric query: SELECT COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies
const METRIC_QUERY_RESULT = {
  success: true,
  original_sql: 'SELECT COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies',
  generated_sql: 'SELECT COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies',
  query_results: {
    columns: ['movie_count'],
    rows: [[21349]],
    row_count: 1,
  },
  execution_time: 1200,
  error: null,
  retry_attempts: 0,
  error_history: [],
};

// Chart/table query: SELECT year, COUNT(*) AS movie_count FROM ... GROUP BY year
const CHART_QUERY_RESULT = {
  success: true,
  original_sql: 'SELECT year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY year ASC',
  generated_sql: 'SELECT year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY year ASC',
  query_results: {
    columns: ['release_year', 'movie_count'],
    rows: [
      [2000, 618], [2001, 564], [2002, 575], [2003, 589],
      [2004, 641], [2005, 708], [2006, 784], [2007, 830],
    ],
    row_count: 8,
  },
  execution_time: 2500,
  error: null,
  retry_attempts: 0,
  error_history: [],
};

// Page data with a MetricCard block that has SQL
const PAGE_WITH_METRIC = {
  content: [
    {
      type: 'MetricCard',
      props: {
        id: 'metric-1',
        label: 'Total count of movies',
        value: '0',
        format: 'number',
        prefix: '',
        suffix: '',
        sql: 'SELECT COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies',
        background: '#f9fafb',
        color: '#111827',
      },
    },
  ],
  root: {},
};

// Page data with a QueryChart block
const PAGE_WITH_CHART = {
  content: [
    {
      type: 'QueryChart',
      props: {
        id: 'chart-1',
        sql: 'SELECT year AS release_year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY release_year ASC',
        chartType: 'bar',
        title: 'Movies by Year',
        height: 300,
      },
    },
  ],
  root: {},
};

// Page data with a DataTable block
const PAGE_WITH_TABLE = {
  content: [
    {
      type: 'DataTable',
      props: {
        id: 'table-1',
        sql: 'SELECT year AS release_year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY release_year ASC',
        title: 'Movies by Year',
        maxRows: 100,
      },
    },
  ],
  root: {},
};

// Page data with all three data blocks
const PAGE_WITH_ALL_BLOCKS = {
  content: [
    {
      type: 'MetricCard',
      props: {
        id: 'metric-1',
        label: 'Total Movies',
        value: '0',
        format: 'number',
        prefix: '',
        suffix: '',
        sql: 'SELECT COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies',
        background: '#f9fafb',
        color: '#111827',
      },
    },
    {
      type: 'QueryChart',
      props: {
        id: 'chart-1',
        sql: 'SELECT year AS release_year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY release_year ASC',
        chartType: 'bar',
        title: 'Movies by Year',
        height: 300,
      },
    },
    {
      type: 'DataTable',
      props: {
        id: 'table-1',
        sql: 'SELECT year AS release_year, COUNT(*) AS movie_count FROM mongodb.sample_mflix.movies WHERE year IS NOT NULL GROUP BY year ORDER BY release_year ASC',
        title: 'Movies by Year',
        maxRows: 100,
      },
    },
  ],
  root: {},
};

// ─── Helper: setup page view dashboard mocks ─────────────────────

async function setupPageDashboard(page, pageData = PAGE_WITH_METRIC) {
  await mockAuth(page);
  await mockHomeData(page);

  // Mock dashboard fetch with page view (handles both GET and PUT)
  const dashData = { ...PAGE_DASHBOARD, page_data: pageData };
  await page.route((url) => url.pathname === `/api/dashboards/${PAGE_DASHBOARD.id}`, (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, dashboard: dashData, tiles: [] }),
    });
  });

  // Mock cache status (empty for page view)
  await mockAPI(page, `/refresh/dashboard/${PAGE_DASHBOARD.id}/cache-status`, { tiles: [] });

  // Set auth token by visiting any page first, then setting localStorage
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
}

// ─── Tests ──────────────────────────────────────────────────────────

test.describe('Page View Dashboard', () => {
  test('page view dashboard loads and shows Edit Page button', async ({ page }) => {
    await setupPageDashboard(page, { content: [], root: {} });
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // Should show the page view empty state or Edit Page button
    await expect(page.getByText(/edit page|start building/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('page view renders content blocks in view mode', async ({ page }) => {
    const pageWithText = {
      content: [
        { type: 'Heading', props: { id: 'h1', text: 'My Dashboard Report', level: 1, align: 'left' } },
        { type: 'Text', props: { id: 't1', content: 'This is a page view test.', align: 'left' } },
        { type: 'Divider', props: { id: 'd1', color: '#e5e7eb', thickness: 1 } },
      ],
      root: {},
    };

    // Mock execute-sql for resolveData (even though these blocks don't use SQL)
    await setupPageDashboard(page, pageWithText);
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    await expect(page.getByText('My Dashboard Report')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('This is a page view test.')).toBeVisible();
  });
});

test.describe('MetricCard Block', () => {
  test('renders metric value from SQL query result', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_METRIC);

    // Mock the execute-sql endpoint for the metric query
    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(METRIC_QUERY_RESULT) })
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // The metric card should show the label
    await expect(page.getByText('Total count of movies')).toBeVisible({ timeout: 15000 });

    // Should show the formatted value (21,349) - wait for resolveData to complete
    await expect(page.getByText('21,349')).toBeVisible({ timeout: 15000 });
  });

  test('renders static value when no SQL provided', async ({ page }) => {
    const pageWithStatic = {
      content: [{
        type: 'MetricCard',
        props: { id: 'static-1', label: 'Static Metric', value: '42', format: 'number', prefix: '', suffix: '', sql: '', background: '#f9fafb', color: '#111827', _queryResult: null, _queryError: null },
      }],
      root: {},
    };

    await setupPageDashboard(page, pageWithStatic);
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    await expect(page.getByText('Static Metric')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('42')).toBeVisible();
  });

  test('shows error state when query fails', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_METRIC);

    // Mock a failed query
    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Query timeout' }) })
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // Should show error state
    await expect(page.getByText(/error|failed|timeout/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('formats currency correctly', async ({ page }) => {
    const currencyPage = {
      content: [{
        type: 'MetricCard',
        props: { id: 'm1', label: 'Revenue', value: '0', format: 'currency', prefix: '', suffix: '', sql: 'SELECT 1500000', background: '#f9fafb', color: '#111827', _queryResult: null, _queryError: null },
      }],
      root: {},
    };

    await setupPageDashboard(page, currencyPage);
    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, query_results: { columns: ['val'], rows: [[1500000]], row_count: 1 }, execution_time: 100, error: null, retry_attempts: 0, error_history: [],
      })})
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);
    await expect(page.getByText('Revenue')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/\$1,500,000/)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('QueryChart Block', () => {
  test('renders chart from SQL query result', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_CHART);

    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CHART_QUERY_RESULT) })
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // Chart title should appear
    await expect(page.getByText('Movies by Year')).toBeVisible({ timeout: 15000 });

    // Plotly chart container should be rendered (it uses a div with class js-plotly-plot)
    await expect(page.locator('.js-plotly-plot, [data-testid="chart"], svg').first()).toBeVisible({ timeout: 15000 });
  });

  test('shows placeholder when no SQL provided', async ({ page }) => {
    const emptyChart = {
      content: [{
        type: 'QueryChart',
        props: { id: 'c1', sql: '', chartType: 'bar', title: '', height: 300, _queryResult: null, _queryError: null },
      }],
      root: {},
    };

    await setupPageDashboard(page, emptyChart);
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    await expect(page.getByText('Chart Block')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/enter a sql query/i)).toBeVisible();
  });

  test('shows error when query fails', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_CHART);

    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Table not found' }) })
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);
    await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('DataTable Block', () => {
  test('renders table with columns and data from SQL query', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_TABLE);

    await page.route((url) => url.pathname === '/api/execute-sql', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CHART_QUERY_RESULT) })
    );

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // Table title
    await expect(page.getByText('Movies by Year').first()).toBeVisible({ timeout: 15000 });

    // Column headers should appear
    await expect(page.getByText('release_year').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('movie_count').first()).toBeVisible({ timeout: 15000 });

    // Data values should appear
    await expect(page.getByText('2000').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('618').first()).toBeVisible();
  });

  test('shows placeholder when no SQL provided', async ({ page }) => {
    const emptyTable = {
      content: [{
        type: 'DataTable',
        props: { id: 't1', sql: '', title: '', maxRows: 100, _queryResult: null, _queryError: null },
      }],
      root: {},
    };

    await setupPageDashboard(page, emptyTable);
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    await expect(page.getByText('Data Table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/enter a sql query/i)).toBeVisible();
  });
});

test.describe('All Data Blocks Together', () => {
  test('page with metric, chart, and table all render correctly', async ({ page }) => {
    await setupPageDashboard(page, PAGE_WITH_ALL_BLOCKS);

    // Route metric and chart/table queries differently based on SQL content
    await page.route((url) => url.pathname === '/api/execute-sql', (route) => {
      const body = route.request().postDataJSON();
      if (body?.sql?.includes('COUNT(*)') && !body?.sql?.includes('GROUP BY')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(METRIC_QUERY_RESULT) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CHART_QUERY_RESULT) });
    });

    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // MetricCard should show value
    await expect(page.getByText('Total Movies')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('21,349')).toBeVisible({ timeout: 15000 });

    // Chart should render
    await expect(page.getByText('Movies by Year').first()).toBeVisible({ timeout: 15000 });

    // Table should show column headers (scroll down since 3 blocks stack)
    await page.getByText('Movies by Year').last().scrollIntoViewIfNeeded();
    await expect(page.getByText('release_year').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Puck Editor', () => {
  test('clicking Edit Page opens Puck editor', async ({ page }) => {
    await setupPageDashboard(page, { content: [], root: {} });
    await page.goto(`/dashboard/${PAGE_DASHBOARD.id}`);

    // Click Edit Page or Start Building
    const editBtn = page.getByText(/edit page|start building/i).first();
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();

    // Puck editor should appear with component sidebar
    await expect(page.locator('[class*="Puck"], [data-puck-editor]').first()).toBeVisible({ timeout: 10000 });
  });
});
