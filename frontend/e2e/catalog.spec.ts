import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('shared catalog picks duplicate copies and global search opens details', async ({page}) => {
 await page.goto('./#/transactions/new?transactions=sample');
 for (let i=0;i<2;i++) {
  await page.getByRole('button',{name:'Add card',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('shining gyarados');
  await expect(page.getByRole('dialog').getByRole('listitem').filter({hasText:'Shining Gyarados'})).toHaveCount(1);
  if (i===0) { await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true'); await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations({subtree:true}).filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished))); await expect(page.getByRole('heading',{name:'Search cards',exact:true})).toBeInViewport(); await page.screenshot({path:test.info().outputPath('catalog-picker.png')}); expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]); }
  await page.getByRole('dialog').getByRole('button',{name:/Shining Gyarados/}).click();
 }
 await expect(page.locator('.new-purchase-copy')).toHaveCount(5);
 await page.goto('./#/search');
 await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('ancient mew');
 await page.getByRole('button',{name:/Ancient Mew/}).click();
 await expect(page.getByRole('heading',{name:'Ancient Mew'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('searchbox',{name:'Search cards',exact:true})).toHaveValue('ancient mew');
});

test('catalog search controls sit outside the scrollport so card results never bleed above them', async ({ page }) => {
  await page.goto('./#/search');
  const scrollport = page.locator('.catalog-scroll-region');
  const sticky = page.locator('.catalog-pinned-tools');
  const outer = page.locator('.sheet-content-contained');
  await expect(outer).toHaveCSS('overflow-y', 'hidden');
  await expect(scrollport).toHaveCSS('overflow-y', 'auto');
  expect(await sticky.evaluate(el => el.parentElement?.contains(document.querySelector('.catalog-scroll-region')))).toBe(true);
  expect(await scrollport.evaluate(el => el.contains(document.querySelector('.catalog-pinned-tools')))).toBe(false);
  const input = page.getByRole('searchbox', { name: 'Search cards', exact: true });
  const filter = page.getByRole('button', { name: 'Filters', exact: true });
  await expect(input).toBeVisible();
  await expect(filter).toBeVisible();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('data-entered', 'true');
  await dialog.locator('.sheet-frame').evaluate(el =>
    Promise.all(el.getAnimations({ subtree: true })
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished)));
  const before = await sticky.boundingBox();
  const viewportBefore = await scrollport.boundingBox();
  expect(viewportBefore!.y).toBeGreaterThanOrEqual(before!.y + before!.height - 2);
  const controls = [
    input,
    filter,
    page.getByRole('button', { name: 'List', exact: true }),
    page.getByRole('button', { name: 'Grid', exact: true }),
  ];
  for (const control of controls) {
    expect(Math.abs((await control.boundingBox())!.height - 36)).toBeLessThanOrEqual(1);
  }
  const scrollHeight = await scrollport.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(scrollHeight).toBeGreaterThan(100);
  await scrollport.evaluate(el => { el.scrollTop = 450; });
  await expect.poll(() => scrollport.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  const after = await sticky.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
  const viewportAfter = await scrollport.boundingBox();
  expect(viewportAfter!.y).toBeGreaterThanOrEqual(after!.y + after!.height - 2);
  const visible = await page.evaluate(() => {
    const tools = document.querySelector('.catalog-pinned-tools')!.getBoundingClientRect();
    const target = document.elementFromPoint(tools.left + 20, tools.top + 15);
    return !!target?.closest('.catalog-pinned-tools');
  });
  expect(visible).toBe(true);
  await test.info().attach('catalog-clipped-scroll', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(input).toBeInViewport();
  await expect(filter).toBeInViewport();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(input).toBeInViewport();
  await expect(filter).toBeInViewport();
  const narrowTools = await sticky.boundingBox();
  const narrowScroll = await scrollport.boundingBox();
  expect(narrowScroll!.y).toBeGreaterThanOrEqual(narrowTools!.y + narrowTools!.height - 2);
  await expect(filter).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('catalog density, subtle detail entry and condition prices', async ({page}) => {
 await page.route('https://openapi.tcgtracking.com/**',async route => {
 const url=route.request().url();
 const data=url.endsWith('/sets') ? {sets:[{id:630,name:'Fossil'}]} : url.endsWith('/cards') ? {products:[{id:1,name:'Gengar (5)',number:'05/62'}]} : {updated:'2026-11-20T12:00:00Z',products:{1:{a:{lng:'EN',cnd:'LP',var:'Unlimited Holofoil',mkt:25.42},b:{lng:'EN',cnd:'NM',var:'Unlimited Holofoil',mkt:40}}}};
 await route.fulfill({json:data});
 });
 await page.goto('./#/search');await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('gengar #5/62');
 expect((await page.locator('.catalog-result').boundingBox())!.height).toBeLessThanOrEqual(88);
 expect((await page.getByRole('button',{name:'Filters'}).boundingBox())!.height).toBeCloseTo(36, 2);
 await page.getByRole('button',{name:/Gengar/}).click();
 await expect(page.getByRole('dialog').last()).toHaveAttribute('data-transition','subtle');
 await expect(page.getByText('$25.42',{exact:true})).toBeVisible();
 await page.getByLabel('Price condition').selectOption('NM');
 await expect(page.getByText('$40.00',{exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('catalog-price-detail.png')});
 await page.goto('./#/collection/cards?inventory=sample');
 await page.getByRole('button',{name:/Card details: Gengar/}).click();
 await expect(page.getByRole('dialog')).toHaveAttribute('data-transition','slide');
});
test('multiple sets survive opening details and returning to catalog',async({page})=>{
 await page.goto('./#/search');
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 await page.getByRole('checkbox',{name:'Fossil',exact:true}).check();
 await page.getByRole('checkbox',{name:'Jungle',exact:true}).check();
 await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('jolteon');
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await page.getByRole('button',{name:/Jolteon/}).first().click();
 await page.getByRole('button',{name:'Back to card',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Fossil',exact:true})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Jungle',exact:true})).toBeChecked();
 await expect(page.getByRole('searchbox',{name:'Search cards',exact:true})).toHaveValue('jolteon');
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await page.screenshot({path:test.info().outputPath('catalog-multiple-sets.png')});
});

test('catalog filters animate, fill a two-column mobile grid and combine card types',async({page})=>{
 await page.goto('./#/collection/cards?inventory=sample');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('gengar');
 await expect(page.getByText('Owned',{exact:true})).toBeVisible();
 const filter=page.getByRole('button',{name:'Filters',exact:true});await filter.click();
 const panel=page.locator('.catalog-search .ui-disclosure');await expect(panel).toHaveAttribute('data-open','true');
 expect(await page.locator('.catalog-set-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
 await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('');
 await page.getByRole('checkbox',{name:'Holo only',exact:true}).check();
 await page.getByRole('checkbox',{name:'Exclude Energy',exact:true}).check();
 await page.getByRole('checkbox',{name:'Exclude Trainers',exact:true}).check();
 await page.screenshot({path:test.info().outputPath('catalog-filter-grid.png'),animations:'disabled'});
 await filter.click();await expect(panel).toHaveAttribute('data-open','false');
 await expect(panel).toHaveAttribute('inert','');
 await page.screenshot({path:test.info().outputPath('catalog-toolbar-badges.png'),animations:'disabled'});
});

test('First Edition checkbox selects exact printing prices without a fallback',async({page})=>{
 await page.route('https://openapi.tcgtracking.com/**',async route=>{
  const url=route.request().url();
  const data=url.endsWith('/sets') ? {sets:[{id:630,name:'Fossil'}]} : url.endsWith('/cards') ? {products:[{id:1,name:'Gengar (5)',number:'05/62'}]} : {products:{1:{a:{lng:'EN',cnd:'LP',var:'Unlimited Holofoil',mkt:25.42},b:{lng:'EN',cnd:'LP',var:'1st Edition Holofoil',mkt:60}}}};
  await route.fulfill({json:data});
 });
 await page.goto('./#/search');
 await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('gengar #5/62');
 await page.getByRole('button',{name:/Gengar/}).click();
 await expect(page.getByText('$25.42',{exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:'First Edition',exact:true}).check();
 await expect(page.getByText('$60.00',{exact:true})).toBeVisible();
 await page.getByLabel('Price condition').selectOption('NM');
 await expect(page.getByText('Unpriced',{exact:true})).toBeVisible();
});

test('returning from catalog card details restores the exact scroll offset', async ({ page }) => {
  await page.goto('./#/search');
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  const results = page.locator('.catalog-scroll-region');
  await expect(results.locator('.catalog-result')).toHaveCount(60);
  await results.evaluate(el => { el.scrollTop = 850; });
  await expect.poll(() => results.evaluate(el => el.scrollTop)).toBeGreaterThan(600);
  const selected = results.locator('.catalog-result').nth(14);
  await selected.scrollIntoViewIfNeeded();
  const before = await results.evaluate(el => el.scrollTop);
  await selected.click();
  await page.getByRole('button', { name: 'Back to card', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search cards', exact: true })).toBeVisible();
  await expect.poll(() => results.evaluate(el => el.scrollTop)).toBeGreaterThan(600);
  expect(Math.abs((await results.evaluate(el => el.scrollTop)) - before)).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => page.locator('.catalog-scroll-region').evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(before - 2);
});

test('catalog return reveals the same mounted search and ready artwork without replaying entrance animation', async ({ page }) => {
  // The real provider can be slow; this verifies the component lifecycle independently.
  await page.route('https://images.pokemontcg.io/**', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/omQAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.goto('./#/search');
  const searchDialog = page.locator('.utility-dialog').first();
  await expect(searchDialog).toHaveAttribute('data-entered', 'true');
  const list = page.locator('.catalog-scroll-region');
  const art = page.locator('.catalog-result').nth(14).locator('.pokemon-art');
  await art.locator('img').evaluate(img => img.dispatchEvent(new Event('load')));
  await expect(art).toHaveAttribute('data-image-state', 'ready');
  await searchDialog.evaluate(el => { el.dataset.searchIdentity = 'original-dialog'; });
  await art.evaluate(el => { el.dataset.artIdentity = 'decoded-card'; });
  const cardButton = art.locator('..');
  await cardButton.scrollIntoViewIfNeeded();
  const before = await list.evaluate(el => el.scrollTop);
  expect(before).toBeGreaterThan(0);
  await cardButton.click();
  await expect(page.locator('.utility-dialog')).toHaveCount(2);
  // Playwright may scroll when focusing the clicked button. Measure the real
  // selection offset after the click, then verify modal teardown preserves it.
  // The preceding test separately asserts the exact pre-click search offset.
  const selectedOffset = await list.evaluate(el => el.scrollTop);
  await expect(searchDialog).toHaveAttribute('data-search-identity', 'original-dialog');
  await expect(page.getByRole('dialog').last()).toHaveAttribute('data-transition', 'subtle');
  await page.getByRole('button', { name: 'Back to card', exact: true }).click();
  await expect(page.locator('.utility-dialog')).toHaveCount(1);
  await expect(searchDialog).toHaveAttribute('data-search-identity', 'original-dialog');
  await expect(searchDialog).toHaveAttribute('data-entered', 'true');
  await expect(art).toHaveAttribute('data-art-identity', 'decoded-card');
  await expect(art).toHaveAttribute('data-image-state', 'ready');
  // Wait for the dialog close/focus restoration to settle before measuring.
  // A persistent jump still fails; only the transient animation is tolerated.
  await expect.poll(async () => Math.abs((await list.evaluate(el => el.scrollTop)) - selectedOffset), {
    timeout: 5_000,
  }).toBeLessThanOrEqual(2);
});
