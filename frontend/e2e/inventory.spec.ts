import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sample physical-copy journey stays isolated, accessible and fits English/Hebrew mobile layouts', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (/firestore|workers\.dev/.test(r.url()) && r.method() !== 'GET') writes.push(r.url()); });
  await page.goto('./#/collection/cards');
  await page.getByRole('button', { name: 'Explore sample collection' }).click();
  await expect(page.getByText('Sample collection', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Priced holdings')).toHaveCount(0);
  await expect(page.getByLabel('Sort cards', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sort cards', { exact: true }).locator('option[value="acquired"]')).toHaveText('Purchase date ↓');
  await expect(page.getByLabel('Sort cards', { exact: true }).locator('option[value="setNumber"]')).toHaveText('Set / number');
  await expect(page.getByRole('button', { name: /^Card details: Charizard/ }).getByText('Charizard', { exact: true })).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('button', { name: '1 copy: Snorlax' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: '2 copies: Charizard' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('searchbox')).toHaveCSS('font-style', 'normal');
  await expect(page.locator('.inventory-card').first()).toHaveCSS('background-color', 'rgb(242, 247, 253)');
  await expect(page.getByText('3 cards · 5 copies', { exact: true })).toHaveCSS('font-weight', '700');
  await expect(page.getByText('3 cards · 5 copies', { exact: true })).toBeVisible();
  const toolbar = page.locator('.collection-toolbar');
  const tabsBottom = await page.getByRole('navigation', { name: 'Section navigation' }).evaluate(el => el.getBoundingClientRect().bottom);
  const inputTop = await page.getByRole('searchbox').evaluate(el => el.getBoundingClientRect().top);
  expect(inputTop - tabsBottom).toBeLessThanOrEqual(12);
  const listTop = await page.locator('section[aria-label="Your cards"] > ul').evaluate(el => el.getBoundingClientRect().top);
  const toolbarBottom = await toolbar.evaluate(el => el.getBoundingClientRect().bottom);
  expect(listTop - toolbarBottom).toBeLessThanOrEqual(8);
  await page.getByRole('button', { name: '2 copies: Charizard' }).click();
  const expanded = page.locator('.inventory-card').first().locator('.copy-accordion');
  await expect(expanded).toHaveAttribute('data-open', 'true');
  await expect(expanded).toHaveCSS('transition-duration', '0.24s, 0.18s');
  await expanded.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  await page.locator('.pokemon-art img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => undefined))));
  await test.info().attach('cards', { body: await page.screenshot({ path: test.info().outputPath('cards.png') }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Edit copy charizard-b' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('data-entered', 'true');
  await expect(dialog.locator('.sheet-frame')).toHaveCSS('animation-name', 'card-sheet-enter');
  await expect(dialog).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(dialog).toHaveCSS('outline-style', 'none');
  await expect(dialog).toHaveCSS('border-top-left-radius', '0px');
  await dialog.getByLabel('Condition', { exact: true }).selectOption('MP');
  await dialog.getByLabel('Notes', { exact: true }).fill('Second copy only');
  await dialog.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished)));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save copy' }).click();
  await expect(dialog.getByRole('button', { name: /Your copies/ })).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByRole('button', { name: /Your copies/ }).click();
  await expect(dialog.getByRole('listitem', { name: 'Copy 1 · NM', exact: true })).toBeVisible();
  await expect(dialog.getByRole('listitem', { name: 'Copy 2 · MP', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Price condition', { exact: true })).toHaveValue('NM');
  await expect(dialog.getByLabel('Price condition', { exact: true })).toHaveCSS('font-weight', '700');
  await expect(dialog.locator('.pokemon-art-large')).toHaveCSS('aspect-ratio', '1 / 1');
  await expect(dialog.getByRole('img', { name: 'Charizard', exact: true })).toHaveCSS('object-fit', 'cover');
  await expect(dialog.getByRole('img', { name: 'Charizard', exact: true })).toHaveCSS('object-position', '50% 10%');
  await expect(dialog.locator('.pokemon-art-large .pokemon-art-window')).toHaveCSS('padding-top', '0px');
  // Both UI sizes must crop away the native yellow image border consistently.
  const detailCrop = await dialog.locator('.pokemon-art-large img').evaluate(el => {
    const style = getComputedStyle(el);
    return { position: style.objectPosition, transform: style.transform };
  });
  const thumbCrop = await page.locator('.inventory-card').first().locator('.pokemon-art img').evaluate(el => {
    const style = getComputedStyle(el);
    return { position: style.objectPosition, transform: style.transform };
  });
  expect(thumbCrop).toEqual(detailCrop);
  const artTop = await dialog.locator('.pokemon-art-large .pokemon-art-window').boundingBox();
  const imageTop = await dialog.locator('.pokemon-art-large img').boundingBox();
  expect(artTop).not.toBeNull();
  expect(imageTop).not.toBeNull();
  expect(Math.abs(imageTop!.y - artTop!.y)).toBeLessThanOrEqual(1);
  const detailBox = await dialog.locator('.pokemon-art-large').boundingBox();
  expect(detailBox).not.toBeNull();
  expect(Math.abs(detailBox!.width - detailBox!.height)).toBeLessThanOrEqual(1);
  await expect(dialog.getByText('$260.00', { exact: true }).first()).toBeVisible();
  await test.info().attach('card-details', { body: await dialog.screenshot({ path: test.info().outputPath('card-details.png') }), contentType: 'image/png' });
  await dialog.getByLabel('Price condition', { exact: true }).selectOption('LP');
  await expect(dialog.getByText('$220.00', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('listitem', { name: 'Copy 1 · NM', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'View purchase' }).nth(1).click();
  await expect(dialog.getByText('purchase-charizard-b', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit copy charizard-b' })).toBeFocused();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Sort and filter' }).click();
  await expect(page.getByLabel('Delivery status', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sort and filter' }).click();
  await expect(page.getByLabel('Delivery status', { exact: true })).toBeHidden();
  await page.setViewportSize({ width: 320, height: 400 });
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(page.getByRole('searchbox')).toBeInViewport();
  const searchTop = await page.getByRole('searchbox').evaluate(el => el.getBoundingClientRect().top);
  const headerBottom = await page.locator('header').evaluate(el => el.getBoundingClientRect().bottom);
  expect(searchTop).toBeGreaterThanOrEqual(headerBottom);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'עברית', exact: true }).click();
  await page.getByRole('button', { name: 'סגירה', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(writes).toEqual([]);
});


test('Card Details loading shimmer has no yellow frame; the original frame appears after loading', async ({ page }) => {
  let reveal: (() => Promise<void>) | undefined;
  await page.route('https://images.pokemontcg.io/base1/4_hires.png', route => {
    reveal = () => route.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==', 'base64'),
    });
  });
  await page.goto('./#/collection/cards?inventory=sample');
  await page.getByRole('button', { name: /^Card details: Charizard/ }).click();
  const art = page.getByRole('dialog').locator('.pokemon-art-large');
  await expect(art).toHaveAttribute('data-image-state', 'loading');
  await expect(art).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(art).toHaveCSS('box-shadow', 'none');
  await expect(art.locator('img')).toHaveCSS('opacity', '0');
  await expect(art.locator('.pokemon-art-window')).toHaveCSS('padding-top', '0px');
  await expect.poll(() => Boolean(reveal)).toBe(true);
  await reveal!();
  await expect(art).toHaveAttribute('data-image-state', 'ready');
  await expect(art).toHaveCSS('border-top-color', 'rgb(244, 202, 39)');
  const bounds = await art.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(1);
});

test('Collection card thumbnails stay frameless during loading and gain their yellow border only when ready', async ({ page }) => {
  let release: (() => Promise<void>) | undefined;
  await page.route('https://images.pokemontcg.io/base1/4.png', route => {
    release = () => route.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==', 'base64'),
    });
  });
  await page.goto('./#/collection/cards?inventory=sample');
  const art = page.getByRole('button', { name: /^Card details: Charizard/ }).locator('.pokemon-art');
  await expect(art).toHaveAttribute('data-image-state', 'loading');
  await expect(art).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(art).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect.poll(() => Boolean(release)).toBe(true);
  await release!();
  await expect(art).toHaveAttribute('data-image-state', 'ready');
  await expect(art).toHaveCSS('border-top-color', 'rgb(244, 202, 39)');
});
