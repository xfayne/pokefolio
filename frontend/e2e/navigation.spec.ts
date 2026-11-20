import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('five destinations, nested sections, catalog focus and back restore', async ({ page }) => {
  await page.goto('./#/collection/binder');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.getByRole('link', { name: 'Collection', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.evaluate(() => { document.querySelector('main')!.style.minHeight = '1500px'; });
  await page.evaluate(() => window.scrollTo(0, 300));
  const scroll = await page.evaluate(() => window.scrollY);
  const opener = page.getByRole('button', { name: 'Search', exact: true });
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(nav).toBeHidden();
  await page.getByRole('searchbox').fill('mew');
  // Native modal traps keyboard focus and makes the retained screen inert.
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/collection\/binder$/);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await opener.click();
  await expect(page.getByRole('searchbox')).toHaveValue('mew');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});

test('mobile English / Hebrew visuals, contrast and narrow safe layout', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('shell-en.png', { fullPage: true, scale: 'device' });
  await expect(page.locator('header')).toHaveCSS('background-color', 'oklch(0.208 0.042 265.755)');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'עברית' }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('shell-he.png', { fullPage: true, scale: 'device' });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const links = page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link');
    for (const link of await links.all()) {
      const bounds = await link.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('direct catalog route closes safely and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/search');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('searchbox').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('./#/deals');
  await expect(page).toHaveURL(/wishlist\/deals$/);
});

// Reduced viewport is a layout guard, not a physical iOS keyboard simulation.
test('catalog controls remain reachable in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.goto('./#/search');
  const input = page.getByRole('searchbox');
  await input.focus();
  await expect(input).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  await input.fill('Pikachu');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
});

