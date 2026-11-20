import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sample physical-copy journey stays isolated, accessible and fits English/Hebrew mobile layouts', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (/firestore|workers\.dev/.test(r.url()) && r.method() !== 'GET') writes.push(r.url()); });
  await page.goto('./#/collection/cards');
  await page.getByRole('button', { name: 'Explore sample collection' }).click();
  await expect(page.getByText('Sample collection', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Priced holdings')).toHaveCount(0);
  await expect(page.getByLabel('Sort cards', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '2 copies: Charizard' }).click();
  await page.getByRole('button', { name: 'Edit copy charizard-b' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Condition', { exact: true }).selectOption('MP');
  await dialog.getByLabel('Notes', { exact: true }).fill('Second copy only');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save copy' }).click();
  await expect(dialog.getByText('Copy 1 · NM', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Copy 2 · MP', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Price condition', { exact: true })).toHaveValue('NM');
  await expect(dialog.getByText('$260.00', { exact: true }).first()).toBeVisible();
  await dialog.getByLabel('Price condition', { exact: true }).selectOption('LP');
  await expect(dialog.getByText('$220.00', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Copy 1 · NM', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'View purchase' }).nth(1).click();
  await expect(dialog.getByText('purchase-charizard-b', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit copy charizard-b' })).toBeFocused();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Sort and filter' }).click();
  await expect(page.getByLabel('Sort cards', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sort and filter' }).click();
  await expect(page.getByLabel('Sort cards', { exact: true })).toBeHidden();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'עברית', exact: true }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(writes).toEqual([]);
});
