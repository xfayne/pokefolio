import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('purchase/sale tabs and icon-only save stay in the header while only form fields scroll',async({page})=>{
  for (const [route,label] of [['new','Save purchase'],['new-sale','Save sale']]) {
    await page.goto(`./#/transactions/${route}?transactions=sample`);
    const header=page.locator('.app-shell > header');
    const save=header.getByRole('button',{name:label,exact:true});
    const tabs=header.locator('.new-purchase-kind');
    await expect(save).toBeVisible();
    expect((await save.innerText()).trim()).toBe('');
    await expect(save).toHaveAttribute('form',await page.locator('form.new-purchase-form').getAttribute('id') as string);
    await expect(page.locator('main button[type="submit"]')).toHaveCount(0);
    for (const width of [320,390,768]) {
      await page.setViewportSize({width,height:600});
      await page.evaluate(()=>window.scrollTo(0,0));
      const before=await tabs.boundingBox();
      await page.evaluate(()=>window.scrollTo(0,500));
      const after=await tabs.boundingBox();
      expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
      await expect(save).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await tabs.evaluate(el=>{ const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.new-purchase-kind')===el; })).toBe(true);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:test.info().outputPath(`${route}-header-save.png`)});
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  }
  await page.getByRole('button',{name:'Back to History',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'עברית',exact:true}).click();
  await page.getByRole('button',{name:'סגירה',exact:true}).click();
  await page.getByRole('button',{name:'עסקה חדשה',exact:true}).click();
  await expect(page.locator('.app-shell > header').getByRole('button',{name:'שמירת רכישה',exact:true})).toBeVisible();
});
