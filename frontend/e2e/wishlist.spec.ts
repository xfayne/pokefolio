import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Wishlist Cards is compact, touch-draggable, position-editable, localized and read-only in sample mode', async ({page}) => {
  const writes:string[] = [];
  page.on('request', request => {
    if (/firestore\.googleapis|workers\.dev/.test(request.url()) && request.method() !== 'GET') writes.push(request.url());
  });
  // Sample prices are never fabricated if the external provider has no matching products.
  await page.route('https://openapi.tcgtracking.com/**', route => route.fulfill({json:{sets:[]}}));
  await page.goto('./#/wishlist/cards?wishlist=sample');
  const rows = page.locator('.wishlist-rows > li');
  await expect(rows).toHaveCount(12);
  await expect(page.getByRole('searchbox',{name:'Search your wishlist'})).toBeVisible();
  await expect(page.getByText('12 cards')).toBeVisible();
  expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(76);
  const first = await rows.first().getAttribute('data-wish-id');
  expect(first).toBe('neo2-13');
  await page.getByRole('button',{name:'Move Umbreon'}).press('End');
  await expect(rows.last()).toHaveAttribute('data-wish-id','neo2-13');
  await page.getByRole('button',{name:'Move Umbreon'}).press('Enter');
  const dialog = page.getByRole('dialog',{name:'Change card position'});
  await expect(dialog).toBeVisible();
  await expect(page.locator('.wishlist-position-input')).toHaveCSS('font-size','16px');
  await dialog.getByRole('spinbutton',{name:'New position'}).fill('2');
  await dialog.getByRole('button',{name:'Save'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows.nth(1)).toHaveAttribute('data-wish-id','neo2-13');

  // A real iPhone touch pointer must be able to drag a visible grip.
  const from = (await page.getByRole('button',{name:'Move Umbreon'}).boundingBox())!;
  const to = (await rows.nth(4).boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const begin = {x:from.x+from.width/2,y:from.y+from.height/2};
  const end = {x:to.x+to.width/2,y:to.y+to.height/2};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[begin]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await expect(page.locator('.wishlist-drag-preview')).toBeVisible();
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(rows.nth(4)).toHaveAttribute('data-wish-id','neo2-13');
  await page.getByRole('combobox',{name:'Sort Wishlist'}).selectOption('name');
  await expect(page.getByRole('button',{name:'Move Umbreon'})).toBeDisabled();
  await page.getByRole('combobox',{name:'Sort Wishlist'}).selectOption('custom');
  await page.getByRole('searchbox',{name:'Search your wishlist'}).fill('Gengar');
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Move Gengar'})).toBeDisabled();
  await page.getByRole('searchbox',{name:'Search your wishlist'}).fill('');
  await test.info().attach('wishlist-mobile-en',{body:await page.screenshot(),contentType:'image/png'});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Settings'}).click();
  await page.getByRole('button',{name:'עברית'}).click();
  await page.getByRole('button',{name:'סגירה'}).click();
  await expect(page.getByRole('searchbox',{name:'חיפוש ברשימת המשאלות'})).toBeVisible();
  await page.setViewportSize({width:320,height:568});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await test.info().attach('wishlist-mobile-he',{body:await page.screenshot(),contentType:'image/png'});
  expect(writes).toEqual([]);
});
