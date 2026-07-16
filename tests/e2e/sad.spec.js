import { test, expect } from '@playwright/test';

test.describe('Sad Paths', () => {
  test('Admin Login fails with incorrect password', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-admin"]');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'wrongpass');
    await page.click('#form-admin button[type="submit"]');
    await expect(page.locator('#admin-error')).not.toHaveClass(/hidden/);
  });

  test('User Login fails with unregistered email', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-user-login"]');
    await page.fill('#ul-email', 'doesnotexist@example.com');
    await page.fill('#ul-password', 'pass123');
    await page.click('#form-user-login button[type="submit"]');
    await expect(page.locator('#ul-error')).not.toHaveClass(/hidden/);
  });

  test('User Signup fails with missing fields', async ({ page }) => {
    await page.goto('/');
    await page.click('button[data-target="form-signup"]');
    await page.fill('#su-first', 'John');
    await page.fill('#su-last', 'Doe');
    await page.click('#form-signup button[type="submit"]');
    const emailField = page.locator('#su-email');
    const isInvalid = await emailField.evaluate(el => el.validationMessage !== '');
    expect(isInvalid).toBe(true);
  });

  test('Empty state UI displays when no data in panel', async ({ page }) => {
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [] })
    }));

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    
    await expect(page.locator('#table-dlq .empty-msg')).toBeVisible();
  });

  test('Search query matching no records displays Empty State UI', async ({ page }) => {
    await page.route('**/api/v1/admin/dlq*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-dlq"]');
    await page.fill('#search-dlq', 'DOESNOTEXIST999');
    
    await page.waitForTimeout(500); 
    await expect(page.locator('#table-dlq')).toContainText('No records found');
  });

  test('User chat submission fails if message is empty', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_user_session', JSON.stringify({ customer_id: '123' }));
    });
    await page.goto('/chat.html');
    await page.fill('#chat-input', '');
    await page.click('#btn-send');
    
    // There is 1 default agent welcome message, sending empty shouldn't increase it
    await expect(page.locator('.message')).toHaveCount(1);
  });

  test('Unauthorized access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL('/');
  });

  test('Unauthorized access to chat redirects to login', async ({ page }) => {
    await page.goto('/chat.html');
    await expect(page).toHaveURL('/');
  });

  test('Network failure during refresh shows toast error', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.route('**/api/v1/**', route => route.abort('failed'));
    await page.goto('/dashboard.html');
    await expect(page.locator('.toast')).toBeVisible();
  });

  test('Invalid UUID in search handles gracefully', async ({ page }) => {
    await page.route('**/api/v1/admin/orders*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] })
    }));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cartly_admin_session', JSON.stringify({ user: 'admin', token: 'mock-jwt-token-admin' }));
    });
    await page.goto('/dashboard.html');
    await page.click('.nav-item[data-target="panel-orders"]');
    await page.fill('#search-orders', 'not-a-uuid!!@#$');
    await page.waitForTimeout(500);
    await expect(page.locator('#table-orders')).toContainText('No records found');
  });
});
