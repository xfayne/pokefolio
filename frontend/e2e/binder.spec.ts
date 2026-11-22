import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fixedLayout(page:import('@playwright/test').Page) {
  const dimensions=await page.locator('.binder-book').evaluate(el=>{
    const book=el.getBoundingClientRect(),nav=document.querySelector('.bottom-bar')!.getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,bodyHeight:document.documentElement.scrollHeight,bodyWidth:document.documentElement.scrollWidth,bookBottom:book.bottom,navTop:nav.top,
      scrollers:Array.from(el.querySelectorAll('*')).filter(x=>x.scrollHeight>x.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(x).overflowY)).length};
  });
  expect(dimensions.bodyHeight).toBeLessThanOrEqual(dimensions.height+1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.bookBottom).toBeLessThanOrEqual(dimensions.navTop+1);
  expect(dimensions.scrollers).toBe(0);
}
test('binder stays fixed, clicking never opens details, drag preserves gaps and page moves preserve partial pages',async({page})=>{
  const privateWrites:string[]=[];
  page.on('request',r=>{if(/firestore|workers\.dev/.test(r.url())&&r.method()!=='GET')privateWrites.push(r.url());});
  await page.goto('./#/collection/binder?inventory=sample');
  const slots=page.locator('.binder-slot');
  await expect(slots).toHaveCount(9);
  await expect(page.getByRole('heading',{name:'My Binder'})).toHaveCount(0);
  await expect(page.getByText('Page 1 of 3',{exact:true})).toBeVisible();
  await fixedLayout(page);
  await test.info().attach('binder-initial',{body:await page.screenshot({path:test.info().outputPath('binder-initial.png')}),contentType:'image/png'});
  await slots.first().tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const first=await slots.first().getAttribute('aria-label');
  const source=(await slots.nth(0).boundingBox())!,target=(await slots.nth(8).boundingBox())!;
  // Touch hold activates drag; tap and ordinary horizontal movement remain navigation only.
  const touch=await page.context().newCDPSession(page);
  const start={x:source.x+source.width/2,y:source.y+source.height/2};
  const end={x:target.x+target.width/2,y:target.y+target.height/2};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await expect(page.locator('.binder-drag-ghost')).toBeVisible();
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await expect(slots.nth(8)).toHaveAttribute('data-drop','true');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(slots.nth(0)).toHaveAttribute('data-kind','empty');
  await expect(slots.nth(8)).toHaveAttribute('aria-label',first!.replace('pocket 1','pocket 9'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Previous page'})).toBeDisabled();
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(page.getByText('Page 2 of 3',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Binder options'}).click();
  await page.getByRole('button',{name:'Move page',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.getByLabel('From page',{exact:true}).selectOption('3');
  await expect(page.getByLabel('From page',{exact:true})).toHaveValue('3');
  await page.getByLabel('To page',{exact:true}).selectOption('1');
  await expect(page.getByLabel('From page',{exact:true})).toHaveValue('3');
  await expect(page.getByLabel('To page',{exact:true})).toHaveValue('1');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Page 1 of 3',{exact:true})).toBeVisible();
  await expect(slots.nth(1)).toHaveAttribute('data-kind','empty');
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(slots.nth(0)).toHaveAttribute('data-kind','empty');
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();
  await page.getByRole('link',{name:'Collection',exact:true}).click();
  await expect(page.getByText('Page 2 of 3',{exact:true})).toBeVisible();
  expect(privateWrites).toEqual([]);
  await page.locator('.binder-art img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode().catch(()=>undefined))));
  await test.info().attach('binder-en',{body:await page.screenshot({path:test.info().outputPath('binder-en.png')}),contentType:'image/png'});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'עברית',exact:true}).click();
  await page.getByRole('button',{name:'סגירה',exact:true}).click();
  await expect(page.getByText('עמוד 2 מתוך 3',{exact:true})).toBeVisible();
  for(const size of [{width:320,height:568},{width:390,height:664},{width:768,height:1024}]){
    await page.setViewportSize(size);await fixedLayout(page);
  }
  await test.info().attach('binder-he',{body:await page.screenshot({path:test.info().outputPath('binder-he.png')}),contentType:'image/png'});
});
test('binder options add exact copies, wishlist pockets and empty slots; landscape reader has two pages',async({page})=>{
  await page.goto('./#/collection/binder?inventory=sample');
  await page.getByRole('button',{name:'Binder options'}).click();
  await page.getByRole('button',{name:'Add / move card'}).click();
  await expect(page.getByRole('searchbox')).toHaveCSS('font-size','16px');
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.getByRole('combobox',{name:'Arrange cards',exact:true}).selectOption('wish');
  await page.getByRole('searchbox').fill('Umbreon');
  await page.getByRole('button',{name:/Umbreon.*13\/75/}).click();
  await page.getByLabel('Pocket',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(page.locator('.binder-slot').first()).toHaveAttribute('data-kind','wish');
  await page.getByRole('button',{name:'Binder options'}).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.getByLabel('Show Wishlist cards',{exact:true}).click();
  await expect(page.locator('.binder-wish').first()).toHaveAttribute('data-hidden','true');
  await page.getByRole('button',{name:'View binder',exact:true}).click();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('dialog').locator('.binder-leaf')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('.binder-leaf').first()).toBeVisible();
  await expect(page.getByRole('dialog').locator('.binder-leaf').last()).toBeVisible();
  await test.info().attach('binder-landscape',{body:await page.screenshot({path:test.info().outputPath('binder-landscape.png')}),contentType:'image/png'});
});
