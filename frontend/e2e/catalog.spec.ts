import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('shared catalog picks duplicate copies and global search opens details', async ({page}) => {
 await page.goto('./#/transactions/new?transactions=sample');
 for (let i=0;i<2;i++) {
  await page.getByRole('button',{name:'Add card',exact:true}).click();
  await page.getByRole('searchbox').fill('shining gyarados');
  await expect(page.getByRole('dialog').getByRole('listitem').filter({hasText:'Shining Gyarados'})).toHaveCount(1);
  if (i===0) { await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true'); await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a => a.finished))); await expect(page.getByRole('heading',{name:'Search cards',exact:true})).toBeInViewport(); await page.screenshot({path:test.info().outputPath('catalog-picker.png')}); expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]); }
  await page.getByRole('dialog').getByRole('button',{name:/Shining Gyarados/}).click();
 }
 await expect(page.locator('.new-purchase-copy')).toHaveCount(5);
 await page.goto('./#/search');
 await page.getByRole('searchbox').fill('ancient mew');
 await page.getByRole('button',{name:/Ancient Mew/}).click();
 await expect(page.getByRole('heading',{name:'Ancient Mew'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('searchbox')).toHaveValue('ancient mew');
});

test('catalog density, subtle detail entry and condition prices', async ({page}) => {
 await page.route('https://openapi.tcgtracking.com/**',async route => {
 const url=route.request().url();
 const data=url.endsWith('/sets') ? {sets:[{id:630,name:'Fossil'}]} : url.endsWith('/cards') ? {products:[{id:1,name:'Gengar (5)',number:'05/62'}]} : {updated:'2026-11-20T12:00:00Z',products:{1:{a:{lng:'EN',cnd:'LP',var:'Unlimited Holofoil',mkt:25.42},b:{lng:'EN',cnd:'NM',var:'Unlimited Holofoil',mkt:40}}}};
 await route.fulfill({json:data});
 });
 await page.goto('./#/search');await page.getByRole('searchbox').fill('gengar #5/62');
 expect((await page.locator('.catalog-result').boundingBox())!.height).toBeLessThanOrEqual(72);
 expect((await page.getByRole('button',{name:'Filters'}).boundingBox())!.height).toBeLessThanOrEqual(32);
 await page.getByRole('button',{name:/Gengar/}).click();
 await expect(page.getByRole('dialog')).toHaveAttribute('data-transition','subtle');
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
 await page.getByRole('searchbox').fill('jolteon');
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await page.getByRole('button',{name:/Jolteon/}).first().click();
 await page.getByRole('button',{name:'Back to card',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Fossil',exact:true})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Jungle',exact:true})).toBeChecked();
 await expect(page.getByRole('searchbox')).toHaveValue('jolteon');
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await page.screenshot({path:test.info().outputPath('catalog-multiple-sets.png')});
});
