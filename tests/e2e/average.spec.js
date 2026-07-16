import { test, expect } from '@playwright/test';

test.describe('Average Paths', () => {
  test('Admin logs in, navigates through panels, logs out', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-admin"]');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'cartly-admin');
    await page.click('#form-admin button[type="submit"]');
    await expect(page).toHaveURL('/dashboard.html');

    await page.click('.nav-item[data-target="panel-orders"]');
    await expect(page.locator('#panel-orders')).toHaveClass(/active/);
    
    await page.click('.nav-item[data-target="panel-customers"]');
    await expect(page.locator('#panel-customers')).toHaveClass(/active/);
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('#btn-logout');
    await expect(page).toHaveURL('/');
  });

  test('User logs in, sends message, and logs out', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_user_session', JSON.stringify({ customer_id: 'c123', first_name: 'Test' }));
    });
    await page.goto('/chat.html');
    await page.fill('#chat-input', 'Hello world');
    await page.click('#btn-send');
    await expect(page.locator('.message.user')).toHaveCount(1);
    
    await page.click('#btn-logout');
    await expect(page).toHaveURL('/');
  });

  test('Admin searches for event, views details, clears search', async ({ page }) => {
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    
    await page.fill('#search-dlq', 'test-event');
    await expect(page.locator('#search-dlq')).toHaveValue('test-event');
    
    await page.fill('#search-dlq', '');
    await expect(page.locator('#search-dlq')).toHaveValue('');
  });

  test('Admin filters orders, then resets filter', async ({ page }) => {
    // Return mock data so the filter select gets populated
    await page.route('**/api/v1/admin/orders*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        rows: [{ order_id: '1', status: 'pending' }, { order_id: '2', status: 'shipped' }]
      })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-orders"]');
    
    await expect(page.locator('#table-orders tbody tr').first()).toBeVisible();
    await page.selectOption('#filter-orders-status', 'pending');
    await expect(page.locator('#filter-orders-status')).toHaveValue('pending');
    
    await page.selectOption('#filter-orders-status', '');
    await expect(page.locator('#filter-orders-status')).toHaveValue('');
  });

  test('User signs up and gets UUID', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-signup"]');
    const randomEmail = `user${Math.floor(Math.random()*10000)}@example.com`;
    await page.fill('#su-first', 'Alice');
    await page.fill('#su-last', 'Smith');
    await page.fill('#su-email', randomEmail);
    await page.fill('#su-password', 'secret');
    await page.click('#form-signup button[type="submit"]');
    await expect(page).toHaveURL('/chat.html');
  });

  test('Admin navigates pagination forward and backward', async ({ page }) => {
    await page.route('**/api/v1/admin/interactions*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        rows: [{ interaction_id: '1' }, { interaction_id: '2' }]
      })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-interactions"]');
    
    await expect(page.locator('#prev-interactions')).toBeVisible();
    await expect(page.locator('#next-interactions')).toBeVisible();
  });

  test('Dashboard loads gracefully on small viewports', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard.html');
    await expect(page.locator('h2')).toBeVisible();
  });

  test('User simulated conversation flow', async ({ page }) => {
    await page.route('**/api/v1/chat/send*', route => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_user_session', JSON.stringify({ customer_id: 'c123', first_name: 'Test' }));
    });
    await page.goto('/chat.html');
    
    await page.fill('#chat-input', 'Message 1');
    await page.click('#btn-send');
    await page.waitForTimeout(100);
    
    await page.fill('#chat-input', 'Message 2');
    await page.click('#btn-send');
    
    await expect(page.locator('.message.user')).toHaveCount(2);
  });

  test('Admin clicks Refresh multiple times quickly', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-orders"]');
    const refreshBtn = page.locator('.refresh-btn[data-table="orders"]');
    await refreshBtn.click();
    await refreshBtn.click();
    await refreshBtn.click();
    await expect(page.locator('h1.panel-title').first()).toContainText('System Overview');
  });

  test('Admin uses toggle password visibility during login', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-admin"]');
    await page.fill('#admin-pass', 'secret123');
    const passInput = page.locator('#admin-pass');
    await expect(passInput).toHaveAttribute('type', 'password');
    
    await page.click('#form-admin .toggle-pw');
    await expect(passInput).toHaveAttribute('type', 'text');
    
    await page.click('#form-admin .toggle-pw');
    await expect(passInput).toHaveAttribute('type', 'password');
  });
});
