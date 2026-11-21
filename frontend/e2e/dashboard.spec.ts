import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dashboard follows the approved sections and links each physical copy safely',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-21T12:00:00Z'));
 const privateRequests:string[]=[];
 page.on('request',r=>{if(/firestore|workers\.dev/.test(r.url()))privateRequests.push(r.url());});
 await page.goto('./#/dashboard?dashboard=sample');
 await expect(page.getByRole('heading',{name:'Pokefolio',exact:true})).toBeVisible();
 await expect(page.locator('.dashboard-big')).toHaveText('$255');
 await expect(page.locator('.dashboard-acquisitions > button')).toHaveCount(3);
 await expect(page.locator('.dashboard-holdings li')).toHaveCount(3);
 await expect(page.locator('.dashboard-holdings')).not.toContainText('Gengar');
 await expect(page.locator('.dashboard-periods button[aria-pressed=true]')).toHaveText('3M');
 await page.getByRole('button',{name:'1M',exact:true}).click();
 await expect(page.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Chart metric').selectOption('realized');
 await expect(page.locator('.dashboard-big')).toHaveText('—');
 await expect(page.locator('.dashboard-coverage')).toHaveText('0/1 completed sales');
 await page.getByLabel('Chart metric').selectOption('value');
 await page.getByLabel('Reporting month').fill('2026-10');
 await expect(page.locator('.dashboard-month h2')).toHaveText('October 2026');
 await expect(page.locator('.dashboard-month .dashboard-kpis bdi').first()).toHaveText('$0');
 await page.getByLabel('Reporting month').fill('2026-11');
 await expect(page.locator('.dashboard-month .dashboard-kpis bdi').first()).toHaveText('$312');
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('.dashboard img').evaluateAll(imgs=>Promise.all(imgs.map(img=>(img as HTMLImageElement).decode().catch(()=>undefined))));
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
 await page.screenshot({path:test.info().outputPath('dashboard-top-en.png')});
 await page.locator('.dashboard-month').scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('dashboard-scrolled-en.png')});
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.locator('.dashboard-acquisitions > button').nth(1).click();
 await expect(page).toHaveURL(/purchases\/sample-nov-19\?transactions=sample&copy=sample-nov-19-copy-1$/);
 await expect(page.locator('[data-copy-id="sample-nov-19-copy-1"]')).toBeFocused();
 await page.goto('./#/dashboard?dashboard=sample');
 const top=page.locator('.dashboard-holdings li > button').first();
 const copy=(await top.getAttribute('data-copy-id'))!;
 await top.click();
 await expect(page).toHaveURL(new RegExp(`collection/cards\\?transactions=sample&copy=${copy}$`));
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').getByRole('button',{name:'Edit copy'})).toBeDisabled();
 expect(privateRequests).toEqual([]);
});

test('dashboard stays within narrow viewports and supports Hebrew and reduced motion',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-21T12:00:00Z'));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./#/dashboard?dashboard=sample');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'עברית',exact:true}).click();
 await page.getByRole('button',{name:'סגירה',exact:true}).click();
 await expect(page.getByRole('heading',{name:'שווי האוסף'})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:test.info().outputPath('dashboard-top-he.png')});
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('signed-out dashboard never invents money or calls authenticated price APIs',async({page})=>{
 const calls:string[]=[];
 page.on('request',r=>{if(/\/api\/market\/prices/.test(r.url()))calls.push(r.url());});
 await page.goto('./#/dashboard');
 await expect(page.locator('.dashboard-big')).toHaveText('—');
 await expect(page.getByText('Sign in through Settings to view your portfolio.')).toBeVisible();
 await expect(page.locator('.dashboard-acquisitions > button')).toHaveCount(0);
 expect(calls).toEqual([]);
});
