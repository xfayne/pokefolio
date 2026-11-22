import { expect, test } from '@playwright/test';

test('sells an exact received copy, edits fees, reverses safely, and restores that copy for selection', async ({page})=>{
  await page.goto('#/transactions/new?transactions=sample');
  await page.getByRole('button',{name:'Sale',exact:true}).click();
  await expect(page.getByRole('form',{name:'New sale'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('new-sale.png'),fullPage:true});
  await page.getByLabel('Buyer',{exact:true}).fill('Demo buyer');
  await page.getByRole('button',{name:'Select owned copies',exact:true}).click();
  const sheet=page.getByRole('dialog');
  await expect(sheet.getByText('Only received, unsold copies are available.')).toBeVisible();
  await expect(sheet.getByRole('checkbox',{name:/Gengar/})).toHaveCount(0);
  await sheet.getByRole('checkbox',{name:/Jolteon/}).check();
  await page.screenshot({path:test.info().outputPath('sale-copy-picker.png')});
  await sheet.getByRole('button',{name:/Use selected copies/}).click();
  await page.getByLabel('Sale price 1',{exact:true}).fill('50');
  await page.getByLabel('Selling fees',{exact:true}).fill('2');
  await page.getByLabel('Shipping paid by you',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Save sale',exact:true}).click();
  await expect(page).toHaveURL(/transactions\/sales\/sale-/);
  await expect(page.getByRole('heading',{name:'Sale details'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('sale-details.png'),fullPage:true});
  await expect(page.getByText('$45.00',{exact:true})).toHaveCount(2);
  await expect(page.getByText('$3.00',{exact:true})).toHaveCount(3); // shipping and two profit values
  await page.getByRole('button',{name:'Edit sale',exact:true}).click();
  await page.getByLabel('Selling fees',{exact:true}).fill('4');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByText('$43.00',{exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'Reverse sale',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Reverse sale',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Sale reversed',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit sale',exact:true})).toHaveCount(0);
  await page.goto('#/transactions/new-sale?transactions=sample');
  await page.getByRole('button',{name:'Select owned copies',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox',{name:/Jolteon/})).toBeVisible();
});

test('new sale retains the shared mobile form sizing and supports Hebrew and an empty account', async ({page})=>{
  await page.goto('#/transactions/new-sale');
  await expect(page.getByRole('button',{name:'Save sale',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Select owned copies',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'No eligible copies'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.locator('.new-purchase-input').first()).toHaveCSS('font-size','16px');
  for(const width of [320,390,768]) { await page.setViewportSize({width,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
  await page.getByRole('button',{name:'Back to History',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'עברית',exact:true}).click();
  await page.getByRole('button',{name:'סגירה',exact:true}).click();
  await page.getByRole('button',{name:'עסקה חדשה',exact:true}).click();
  await page.getByRole('button',{name:'מכירה',exact:true}).click();
  await expect(page.getByRole('form',{name:'מכירה חדשה'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.screenshot({path:test.info().outputPath('new-sale-he.png'),fullPage:true});
});
