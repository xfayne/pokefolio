import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Collection overview counts received/pending copies and keeps LP wishes separate', async ({page}) => {
  const writes: string[] = [];
  page.on('request', request => { if (/firestore|workers\.dev/.test(request.url())) writes.push(request.url()); });
  await page.goto('./#/collection/overview?inventory=sample');
  const overview = page.getByRole('article', {name:'Collection overview'});
  await expect(overview.locator('[data-metric="received"] .collection-metric-value')).toHaveText('4');
  await expect(overview.locator('[data-metric="pending"] .collection-metric-value')).toHaveText('1');
  await expect(overview.locator('[data-metric="wishlist"] .collection-metric-value')).toHaveText('9');
  await expect(overview.locator('[data-metric="budget"] .collection-metric-value')).toContainText('$670');
  await expect(overview.locator('.collection-budget-note')).toContainText('8/9 priced');
  await expect(overview.locator('.collection-budget-note')).toContainText('Partial estimate');
  await expect(overview.getByRole('combobox')).toHaveCount(0);
  await expect(overview.getByText('LP · card prices only')).toBeVisible();
  await expect(overview.locator('.collection-concentration')).toContainText('3/4 received copies priced');
  await overview.locator('[data-metric="received"]').click();
  await expect(page.getByLabel('Delivery status')).toHaveValue('received');
  await page.goBack();
  await overview.locator('[data-metric="pending"]').click();
  await expect(page.getByLabel('Delivery status')).toHaveValue('pending');
  await page.goBack();
  await overview.locator('[data-metric="wishlist"]').click();
  await expect(page).toHaveURL(/wishlist\/cards\?remaining=1&wishlist=sample$/);
  await expect(page.locator('[data-wish-id="base1-4"]')).toHaveCount(0);
  await expect(page.locator('[data-wish-id="base3-5"]')).toHaveCount(0);
  await expect(page.locator('[data-wish-id="neo2-13"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Still to buy ×'}).click();
  await expect(page.locator('[data-wish-id="base1-4"]')).toHaveCount(1);
  await page.goto('./#/collection/overview?inventory=sample');
  const highlights = page.getByRole('region',{name:'Your Highlights'});
  await highlights.getByRole('button',{name:'Choose cards'}).click();
  const picker = page.getByRole('dialog',{name:'Choose your highlights'});
  await expect(picker.getByRole('button',{pressed:true})).toHaveCount(3);
  await picker.getByRole('button',{name:/Charizard/}).click();
  await picker.getByRole('button',{name:'Save selection'}).click();
  await expect(highlights.getByRole('button',{name:/Charizard/})).toHaveCount(0);
  await highlights.getByRole('button',{name:/Gengar/}).click();
  await expect(page.getByRole('dialog',{name:/Card details/i})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Gengar',exact:true})).toBeVisible();
  expect(writes).toEqual([]);
});

test('Collection overview fits narrow screens, remains accessible, and supports RTL', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./#/collection/overview?inventory=sample');
  await expect(page.locator('[data-metric="received"] .collection-metric-value')).toHaveText('4');
  await page.evaluate(()=>document.fonts.ready);
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:test.info().outputPath('collection-overview-en.png'),fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'עברית',exact:true}).click();
  await page.getByRole('button',{name:'סגירה',exact:true}).click();
  await expect(page.getByRole('article',{name:'סקירת האוסף'})).toBeVisible();
  await expect(page.getByRole('article').getByText('LP · מחירי קלפים בלבד')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.screenshot({path:test.info().outputPath('collection-overview-he.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
