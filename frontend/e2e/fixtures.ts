import { test as base, expect, Page } from '@playwright/test';

const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000';

/** Authenticate via API and return the JWT token */
async function getAuthToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token || data.access_token;
}

/**
 * Custom test fixture that provides an authenticated page.
 * Sets the auth token in localStorage before each test.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    const token = await getAuthToken();
    await page.goto('/');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);
    await page.goto('/');
    await use(page);
  },
});

export { expect };

/** Mock an API route with a JSON response.
 *  Routes through the NGINX proxy at /api/ prefix.
 *  Uses URL predicate to match pathname regardless of query params. */
export async function mockAPI(page: Page, path: string, body: unknown, status = 200) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const hasWildcard = cleanPath.includes('*');

  await page.route((url) => {
    const pathname = url.pathname;
    if (hasWildcard) {
      // Convert glob-like pattern to regex: * → [^/]*, ** → .*
      const regexStr = '/api' + cleanPath
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*');
      return new RegExp(`^${regexStr}$`).test(pathname);
    }
    return pathname === `/api${cleanPath}`;
  }, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

/** Mock the full auth flow so tests don't need a running backend */
export async function mockAuth(page: Page) {
  // Mock login — returns token in access_token field (FastAPI OAuth2)
  await page.route('**/auth/login*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'mock-jwt-token', token_type: 'bearer' }),
    })
  );
  // Mock current user
  await page.route('**/auth/users/me*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'admin', email: 'admin@test.com', role: 'ADMIN', is_active: true }),
    })
  );
}

/** Mock the home page data endpoints */
export async function mockHomeData(page: Page) {
  await page.route((url) => url.pathname === '/api/query-history', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ queries: [], total: 0 }) })
  );
  await page.route((url) => url.pathname === '/api/dashboards', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dashboards: [] }) })
  );
  // Mock explorer/databases globally to prevent 401 → logout redirect
  await page.route((url) => url.pathname === '/api/explorer/databases', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ databases: [] }) })
  );
}
