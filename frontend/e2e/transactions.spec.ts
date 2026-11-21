import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('History follows the approved mock, keeps month and total inline, and isolates sample data', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (/firestore|workers\.dev/.test(r.url())) writes.push(r.url()); });
  await page.goto('./#/transactions');
  await expect(page).toHaveURL(/transactions\/overview$/);
  const tabs = page.getByRole('navigation', { name: 'Section navigation' }).getByRole('link');
  await expect(tabs).toHaveText(['Overview', 'History']);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore sample history' }).click();
  await expect(page.getByText('Demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('4 copies', { exact: true })).toBeVisible();
  const add = page.getByRole('button', { name: 'New transaction', exact: true });
  await expect(add).toBeEnabled();
  await expect(add.locator('svg')).toHaveCount(1);
  await expect(add).not.toContainText('New transaction');
  const kindSelect = page.getByRole('combobox', { name: 'Transaction type' });
  await expect(kindSelect).toHaveValue('all');
  const search = page.getByRole('searchbox', { name: 'Search transactions' });
  const filterButton = page.getByRole('button', { name: 'Filter transactions' });
  for (const control of [search, kindSelect, filterButton, add]) {
    expect(Math.abs((await control.boundingBox())!.height - 36)).toBeLessThanOrEqual(1);
  }
  const row = page.locator('.history-search-row');
  const rowBox = await row.boundingBox();
  const controlBounds = await Promise.all([search, kindSelect, filterButton].map(el => el.boundingBox()));
  for (const box of controlBounds) {
    expect(Math.abs(box!.y - rowBox!.y)).toBeLessThanOrEqual(1);
  }
  await expect(page.getByText('−$227.00', { exact: true })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const heading = await page.getByRole('heading', { name: 'November 2026' }).boundingBox();
    const total = await page.getByText('−$227.00', { exact: true }).boundingBox();
    expect(Math.abs(heading!.y - total!.y)).toBeLessThan(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const lastRow = page.getByRole('listitem').last();
    await lastRow.scrollIntoViewIfNeeded();
    const row = await lastRow.boundingBox();
    const topHeader = await page.locator('.app-shell > header').boundingBox();
    const pinnedTabs = await page.locator('.transactions-nav-sticky').boundingBox();
    const pinnedTools = await page.locator('.history-tools').boundingBox();
    expect(pinnedTabs!.y).toBeGreaterThanOrEqual(topHeader!.y + topHeader!.height - 2);
    expect(pinnedTools!.y).toBeGreaterThanOrEqual(pinnedTabs!.y + pinnedTabs!.height - 2);
    expect(pinnedTools!.y + pinnedTools!.height).toBeLessThanOrEqual((await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox())!.y);
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(row!.y + row!.height).toBeLessThanOrEqual(nav!.y);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; });
  await page.locator('.pokemon-art img').evaluateAll(imgs => Promise.all(imgs.map(img => (img as HTMLImageElement).decode().catch(() => undefined))));
  await test.info().attach('transaction-history-en', { body: await page.screenshot({ path: test.info().outputPath('transaction-history-en.png') }), contentType: 'image/png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await kindSelect.selectOption('sale');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('+$85.00', { exact: true })).toBeVisible();
  await kindSelect.selectOption('all');
  await page.getByRole('searchbox').fill('gengar');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  const filter = filterButton;
  await expect(filter).toHaveAttribute('aria-expanded', 'false');
  await filter.click();
  await page.getByLabel('Status', { exact: true }).selectOption('received');
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await filter.click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New transaction', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'עברית', exact: true }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await test.info().attach('transaction-history-he', { body: await page.screenshot({ path: test.info().outputPath('transaction-history-he.png') }), contentType: 'image/png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto('./#/transactions/history');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('one saved display currency converts monthly totals while purchase entry keeps its currency',async({page})=>{
 await page.route('https://api.frankfurter.dev/**',route=>route.fulfill({json:[{base:'USD',quote:'EUR',rate:0.8,date:'2026-11-20'},{base:'USD',quote:'GBP',rate:0.5,date:'2026-11-20'},{base:'USD',quote:'ILS',rate:4,date:'2026-11-20'}]}));
 await page.goto('./#/settings');
 await page.getByRole('combobox',{name:'Display currency'}).selectOption('ILS');
 await page.reload();await expect(page.getByRole('combobox',{name:'Display currency'})).toHaveValue('ILS');
 await page.goto('./#/transactions/history?transactions=sample');
 await expect(page.locator('.history-month-totals').first()).toContainText('₪');
 for(const heading of await page.locator('.history-month-totals').all()) await expect(heading.locator('bdi')).toHaveCount(1);
 await page.goto('./#/transactions/new?transactions=sample');
 await expect(page.getByRole('combobox',{name:'Currency',exact:true})).toHaveValue('USD');
 await expect(page.getByRole('textbox',{name:'Card cost 1',exact:true})).toHaveValue('52.00');
});
