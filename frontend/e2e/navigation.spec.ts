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
  await expect(page.getByText('Pokefolio · Staging · Test environment')).toHaveCount(0);
  await expect(page.locator('header > div')).toHaveCSS('min-height', '64px');
  await page.evaluate(() => document.fonts.ready);
  const header = page.locator('.app-shell > header');
  const content = page.locator('#main-content');
  await expect(header).toHaveCSS('border-top-left-radius', '0px');
  await expect(header).toHaveCSS('border-top-right-radius', '0px');
  // Inverted navy corners are an overlay at the header's BOTTOM, not regular
  // downward-rounded header edges or rounded corners at the content's bottom.
  await expect(header).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(header).toHaveCSS('border-bottom-right-radius', '0px');
  await expect(content).toHaveCSS('border-top-left-radius', '20px');
  await expect(content).toHaveCSS('border-top-right-radius', '20px');
  await expect(content).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(content).toHaveCSS('border-bottom-right-radius', '0px');
  const corners = await header.evaluate(el => ['::before', '::after'].map(which => {
    const style = getComputedStyle(el, which);
    return { which, width: style.width, height: style.height, top: style.top,
      position: style.position, background: style.backgroundImage, pointerEvents: style.pointerEvents };
  }));
  expect(corners).toHaveLength(2);
  for (const corner of corners) {
    expect(corner.width).toBe('20px');
    expect(corner.height).toBe('20px');
    expect(corner.top).toBe('64px');
    expect(corner.position).toBe('absolute');
    expect(corner.background).toContain('radial-gradient(');
    expect(corner.pointerEvents).toBe('none');
  }
  expect(corners[0]!.background).toContain('right');
  expect(corners[1]!.background).toContain('left');
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(3, 35, 62)');
  await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(3, 35, 62)');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered', 'true');
  await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished)));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Pokefolio · Staging · Test environment')).toBeVisible();
  await page.getByRole('button', { name: 'עברית' }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { document.querySelector('main')!.style.minHeight = '1500px'; window.scrollTo(0, 300); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(header).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(header).toHaveCSS('border-bottom-right-radius', '0px');
  await expect(header).toHaveCSS('border-top-left-radius', '0px');
  await expect(content).toHaveCSS('border-top-left-radius', '20px');
  await expect(content).toHaveCSS('border-top-right-radius', '20px');
  await expect(content).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(content).toHaveCSS('border-bottom-right-radius', '0px');
  // Pseudo-element corners remain anchored to the viewport-sticky header.
  const position = await header.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const left = getComputedStyle(el, '::before');
    const right = getComputedStyle(el, '::after');
    return { headerY: rect.y, leftTop: left.top, rightTop: right.top, leftBg: left.backgroundImage, rightBg: right.backgroundImage };
  });
  expect(position.headerY).toBeGreaterThanOrEqual(-1);
  expect(position.headerY).toBeLessThanOrEqual(1);
  expect(position.leftBg).toContain('radial-gradient(');
  expect(position.rightBg).toContain('radial-gradient(');
  await test.info().attach('scrolled-header', { body: await page.screenshot(), contentType: 'image/png' });
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
