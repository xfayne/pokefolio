import { expect, test } from '@playwright/test';

test('receives purchased copies manually without tracking and keeps the header action disabled',async({page})=>{
  await page.goto('#/transactions/new?transactions=sample');
  await page.getByRole('button',{name:'Save purchase',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Purchase details',exact:true})).toBeVisible();
  const before=await page.locator('.purchase-total').innerText();
  await expect(page.getByText('No shipment linked',{exact:true})).toBeVisible();
  const action=page.locator('header').getByRole('button',{name:'Mark received',exact:true});
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page.locator('header').getByRole('button',{name:'Received',exact:true})).toBeDisabled();
  await expect(page.locator('.purchase-summary').getByText('Received',{exact:true})).toBeVisible();
  expect(await page.locator('.purchase-total').innerText()).toBe(before);
  await page.getByRole('button',{name:'Back to History',exact:true}).click();
  await expect(page.locator('.history-status-received')).toHaveCount(3);
  await page.getByRole('button',{name:/View transaction: demo-purchase-/}).click();
  await expect(page.locator('header').getByRole('button',{name:'Received',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Back to History',exact:true}).click();
  await page.getByRole('button',{name:'New transaction',exact:true}).click();
  await page.getByRole('button',{name:'Sale',exact:true}).click();
  await page.getByRole('button',{name:'Select owned copies',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox',{name:/Gengar/})).toBeVisible();
});

test('receipt is independent of tracking events and the compact market controls share a right column',async({page})=>{
  await page.goto('#/transactions/purchases/sample-nov-19?transactions=sample');
  for(const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.locator('header').getByRole('button',{name:'Mark received',exact:true}).click();
  await expect(page.locator('header').getByRole('button',{name:'Received',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Back to History',exact:true}).click();
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search cards',exact:true}).fill('Gengar');
  await page.locator('.catalog-result').first().click();
  const condition=page.getByRole('combobox',{name:'Price condition'});
  const edition=page.getByRole('checkbox',{name:'First Edition',exact:true});
  await expect(edition).toBeVisible();
  const selector=await condition.boundingBox(),checkbox=await edition.boundingBox();
  expect(checkbox!.y).toBeGreaterThanOrEqual(selector!.y+selector!.height);
  expect(checkbox!.x).toBeGreaterThan(150);
  await page.screenshot({path:test.info().outputPath('compact-market-edition.png')});
});
