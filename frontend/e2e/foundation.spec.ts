import { expect, test } from '@playwright/test';
test('Pages subpath, reload, RTL and isolated new app', async ({ page }) => {
  const failures: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Wishlist' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
  await page.getByRole('button', { name: 'עברית' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'רשימת משאלות' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(requests.filter(url => /firebase-cloud|catalog-ui|binder\.js|firestore\.googleapis/.test(url))).toEqual([]);
  expect(failures).toEqual([]);
});
