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
