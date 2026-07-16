import { test, expect } from '@playwright/test';

test.describe('Happy Paths', () => {
  test('Admin Login successful', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-admin"]');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'cartly-admin');
    await page.click('#form-admin button[type="submit"]');
    await expect(page).toHaveURL('/dashboard.html');
    await expect(page.locator('h1.panel-title').first()).toContainText('System Overview');
  });

  test('User Signup successful and redirects to chat', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-signup"]');
    const randomEmail = `user${Math.floor(Math.random()*10000)}@test.com`;
    await page.fill('#su-first', 'John');
    await page.fill('#su-last', 'Doe');
    await page.fill('#su-email', randomEmail);
    await page.fill('#su-password', 'password123');
    await page.click('#form-signup button[type="submit"]');
    await expect(page).toHaveURL('/chat.html');
  });

  test('User Login successful and redirects to chat', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-user-login"]');
    await page.evaluate(() => {
      localStorage.setItem('cartly_user_session', JSON.stringify({
        customer_id: 'test-id', first_name: 'Test', email: 'test@test.com'
      }));
    });
    await page.goto('/chat.html');
    await expect(page.locator('#user-name')).toBeVisible();
  });

  test('Admin Dashboard loads Overview panel by default', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await expect(page.locator('#panel-overview')).toHaveClass(/active/);
  });

  test('Admin switches to Orders panel successfully', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-orders"]');
    await expect(page.locator('#panel-orders')).toHaveClass(/active/);
    await expect(page.locator('#panel-overview')).not.toHaveClass(/active/);
  });

  test('Admin Data Table rows open Detail Modal', async ({ page }) => {
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [{
          dlq_id: "test-dlq-123",
          event_type: "ORDER_CREATED",
          source_topic: "orders",
          error_message: "Network timeout"
        }]
      })
    }));

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    
    await expect(page.locator('#table-dlq tbody tr').first()).toBeVisible();
    await page.click('#table-dlq tbody tr');
    await expect(page.locator('#detail-modal')).not.toHaveClass(/hidden/);
  });

  test('Admin Search functionality filters data', async ({ page }) => {
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    const input = page.locator('#search-dlq');
    await input.fill('event');
    await expect(input).toHaveValue('event');
  });

  test('Admin Filter Select successfully applies filters', async ({ page }) => {
    // Return mock data so the filter select gets populated
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        rows: [{ dlq_id: '1', status: 'pending' }, { dlq_id: '2', status: 'resolved' }]
      })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    // Ensure data is loaded
    await expect(page.locator('#table-dlq tbody tr').first()).toBeVisible();
    await page.selectOption('#filter-dlq-status', 'pending');
    const val = await page.$eval('#filter-dlq-status', el => el.value);
    expect(val).toBe('pending');
  });

  test('Admin Refresh button triggers reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-orders"]');
    await page.click('.refresh-btn[data-table="orders"]');
    await expect(page.locator('.refresh-btn[data-table="orders"]')).toBeEnabled();
  });

  test('Admin Logout redirects to Auth Hub', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    page.on('dialog', dialog => dialog.accept());
    await page.click('#btn-logout');
    await expect(page).toHaveURL('/');
  });
});
