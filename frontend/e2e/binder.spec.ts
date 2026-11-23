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
  await expect(page.locator('.binder-hint')).toHaveCount(0);
  await expect(page.locator('.binder-toolbar')).toHaveCount(0);
  const geometry=await page.locator('.binder-spread').evaluate(el=>{const book=el.getBoundingClientRect(),arrow=el.querySelector('.binder-pager button')!.getBoundingClientRect();return Math.abs(arrow.y+arrow.height/2-(book.y+book.height/2));});
  expect(geometry).toBeLessThan(2);
  await expect(page.locator('.binder-page-stamp').first()).toBeVisible();
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
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await expect(page.locator('.binder-drag-ghost')).toBeVisible();
  await expect(slots.nth(8)).toHaveAttribute('data-drop','true');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  // A move must never paint its original pocket again while storage confirms it.
  const firstFrames=await page.evaluate(async()=>{
    const kinds:string[]=[];
    for(let i=0;i<3;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));kinds.push(document.querySelector('[data-pocket-index="0"]')?.getAttribute('data-kind') ?? 'missing');}
    return kinds;
  });
  expect(firstFrames).toEqual(['empty','empty','empty']);
  await expect(slots.nth(0)).toHaveAttribute('data-kind','empty');
  await expect(slots.nth(8)).toHaveAttribute('aria-label',first!.replace('pocket 1','pocket 9'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Previous page'})).toBeDisabled();
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(page.locator('[data-binder-page="1"] .binder-page-stamp')).toBeVisible();
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
  await expect(page.locator('.binder-page-stamp').first()).toBeVisible();
  await expect(slots.nth(1)).toHaveAttribute('data-kind','empty');
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(slots.nth(0)).toHaveAttribute('data-kind','empty');
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await page.getByRole('link',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Explore sample binder',exact:true}).click();
  await expect(page.locator('[data-binder-page="1"] .binder-page-stamp')).toBeVisible();
  expect(privateWrites).toEqual([]);
  await page.locator('.binder-art img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode().catch(()=>undefined))));
  await test.info().attach('binder-en',{body:await page.screenshot({path:test.info().outputPath('binder-en.png')}),contentType:'image/png'});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'עברית',exact:true}).click();
  await page.getByRole('button',{name:'סגירה',exact:true}).click();
  await expect(page.locator('[data-binder-page="1"] .binder-page-stamp')).toBeVisible();
  for(const size of [{width:320,height:568},{width:390,height:664},{width:768,height:1024}]){
    await page.setViewportSize(size);await fixedLayout(page);
  }
  await test.info().attach('binder-he',{body:await page.screenshot({path:test.info().outputPath('binder-he.png')}),contentType:'image/png'});
});
test('binder options add exact copies, wishlist pockets and empty slots; landscape reader has two pages',async({page})=>{
  await page.goto('./#/collection/binder?inventory=sample');
  await page.getByRole('button',{name:'Binder options'}).click();
  await page.getByRole('button',{name:'Add / move card'}).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.getByRole('combobox',{name:'Arrange cards',exact:true}).selectOption('wish');
  await expect(page.getByRole('searchbox')).toHaveCSS('font-size','16px');
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
  await expect(page.getByRole('dialog')).toHaveAttribute('data-entered','true');
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('dialog').locator('.binder-leaf')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('.binder-leaf').first()).toBeVisible();
  await expect(page.getByRole('dialog').locator('.binder-leaf').last()).toBeVisible();
  const header=await page.getByRole('dialog').locator('.sheet-header').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);
  expect(header!.y+header!.height).toBeLessThanOrEqual(390);
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollTop)).toBe(0);
  await test.info().attach('binder-landscape',{body:await page.screenshot({path:test.info().outputPath('binder-landscape.png')}),contentType:'image/png'});
});

test('Add empty page inserts nine blank pockets after the current page, keeps adjacent pages and uses no account writes in sample mode',async({page})=>{
  const privateWrites:string[]=[];
  page.on('request',r=>{if(/firestore|workers\.dev/.test(r.url())&&r.method()!=='GET')privateWrites.push(r.url());});
  await page.goto('./#/collection/binder?inventory=sample');
  const slots=page.locator('.binder-slot');
  const firstCard=await slots.first().getAttribute('aria-label');
  await page.getByRole('button',{name:'Binder options'}).click();
  await page.getByRole('button',{name:'Add empty page'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-binder-page="1"] .binder-page-stamp')).toHaveText('2/4');
  await expect(slots).toHaveCount(9);
  await expect(slots.filter({has:page.locator('.binder-art')})).toHaveCount(0);
  for(let i=0;i<9;i++) await expect(slots.nth(i)).toHaveAttribute('data-kind','empty');
  await fixedLayout(page);
  await page.getByRole('button',{name:'Previous page'}).click();
  await expect(slots.first()).toHaveAttribute('aria-label',firstCard!);
  await page.getByRole('button',{name:'Next page'}).click();
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(slots.first()).toHaveAttribute('data-kind','owned');
  await expect(page.locator('.binder-page-stamp').first()).toHaveText('3/4');
  expect(privateWrites).toEqual([]);
});
test('dragging a card outside removes only its binder placement and makes its copy selectable again',async({page})=>{
  const privateWrites:string[]=[];
  page.on('request',r=>{if(/firestore|workers\.dev/.test(r.url()) && r.method()!=='GET')privateWrites.push(r.url());});
  await page.goto('./#/collection/binder?inventory=sample');
  const slots=page.locator('.binder-slot');
  const source=(await slots.first().boundingBox())!;
  const leaf=(await page.locator('.binder-leaf').boundingBox())!;
  const untouched=await slots.nth(1).getAttribute('aria-label');
  const touch=await page.context().newCDPSession(page);
  const start={x:source.x+source.width/2,y:source.y+source.height/2};
  const outside={x:start.x,y:Math.max(10,leaf.y-16)};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[outside]});
  await expect(page.locator('.binder-drag-remove')).toContainText('Release to remove');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  // The previous layout must not reappear for even one paint while saving.
  const frames=await page.evaluate(async()=>{
    const observed:string[]=[];
    for(let i=0;i<3;i++) {
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      observed.push(document.querySelector('[data-pocket-index="0"]')?.getAttribute('data-kind') ?? 'missing');
    }
    return observed;
  });
  expect(frames).toEqual(['empty','empty','empty']);
  await expect(slots.nth(1)).toHaveAttribute('aria-label',untouched!);
  await expect(slots.nth(0)).toHaveAttribute('data-kind','empty');
  await expect(page.locator('.binder-page')).toHaveAttribute('aria-busy','false');
  // The post-drag test checks copy re-selection, not the mobile tap event ordering.
  // Use accessible keyboard activation; touch drag is exercised above.
  await slots.first().press('Enter');
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('Charizard');
  await expect(dialog.locator('.catalog-result')).toHaveCount(1);
  await dialog.getByRole('button',{name:/Charizard/}).click();
  await expect(dialog).toHaveCount(0);
  await expect(slots.nth(0)).toHaveAttribute('aria-label',/Charizard/);
  expect(privateWrites).toEqual([]);
});
test('empty pocket opens the shared eligible catalog and adds its sole copy in place',async({page})=>{
 await page.goto('./#/collection/binder?inventory=sample');
 const empty=page.locator('.binder-slot[data-kind="empty"]').first();
 // Picker content is the assertion here; avoid a separate mobile synthetic-click race.
 await empty.press('Enter');
 const dialog=page.getByRole('dialog');
 await expect(dialog).toHaveAttribute('data-entered','true');
 await dialog.getByRole('searchbox').fill('Pikachu');
 await expect(dialog.locator('.catalog-result')).toHaveCount(1);
 await test.info().attach('binder-catalog',{body:await page.screenshot({path:test.info().outputPath('binder-catalog.png')}),contentType:'image/png'});
 await dialog.getByRole('button',{name:/Pikachu/}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator('[data-pocket-index="8"]')).toHaveAttribute('aria-label',/Pikachu/);
 await expect(page.locator('[data-pocket-index="0"]')).toHaveAttribute('aria-label',/Charizard/);
});

test('an empty pocket offers Wishlist-only cards without creating an owned copy', async ({page}) => {
  const writes:string[]=[];
  page.on('request',request=>{if(/firestore\.googleapis|workers\.dev/.test(request.url()) && request.method()!=='GET')writes.push(request.url());});
  await page.goto('./#/collection/binder?inventory=sample');
  const pocket=page.locator('.binder-slot').nth(8);
  await expect(pocket).toHaveAttribute('data-kind','empty');
  await pocket.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('searchbox').fill("Blaine's Moltres");
  await page.getByRole('button',{name:/Blaine's Moltres/}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pocket).toHaveAttribute('data-kind','wish');
  await expect(pocket).toContainText('Wishlist');
  expect(writes).toEqual([]);
});

test('Binder reuses exactly the same Collection tabs sizing as Cards',async({page})=>{
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    const dimensions=[];
    for(const path of ['/collection/cards?inventory=sample','/collection/binder?inventory=sample']){
      await page.goto(`./#${path}`);
      const tabs=page.getByRole('navigation',{name:'Section navigation'});
      await expect(tabs).toBeVisible();
      const metrics=await tabs.evaluate(nav=>{
        const pill=nav.getBoundingClientRect();
        const container=nav.parentElement!.getBoundingClientRect();
        const style=getComputedStyle(nav);
        return {width:pill.width,height:pill.height,containerWidth:container.width,
          left:pill.left,top:pill.top,flexGrow:style.flexGrow,borderRadius:style.borderRadius,
          backgroundColor:style.backgroundColor,padding:style.padding};
      });
      // The shared pill must occupy the whole available tab bar, not
      // shrink to fit only its labels when inside the fixed Binder layout.
      expect(metrics.width).toBeGreaterThanOrEqual(metrics.containerWidth-16);
      expect(metrics.flexGrow).toBe('1');
      dimensions.push(metrics);
    }
    expect(dimensions[1]!.width).toBeCloseTo(dimensions[0]!.width,0);
    expect(dimensions[1]!.height).toBeCloseTo(dimensions[0]!.height,0);
    expect(dimensions[1]!.left).toBeCloseTo(dimensions[0]!.left,0);
    expect(dimensions[1]!.top).toBeCloseTo(dimensions[0]!.top,0);
    expect(dimensions[1]!.borderRadius).toBe(dimensions[0]!.borderRadius);
    expect(dimensions[1]!.backgroundColor).toBe(dimensions[0]!.backgroundColor);
    expect(dimensions[1]!.padding).toBe(dimensions[0]!.padding);
  }
});

test('shared rounded bottom navigation is visibly rounded on Binder and Cards',async({page})=>{
  // A CSS radius alone is insufficient when its transparent corners show the
  // same navy shell background. Check actual rendered pixels as well.
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const route of ['collection/cards?inventory=sample','collection/binder?inventory=sample']){
      await page.goto(`./#/${route}`);
      const nav=page.locator('.bottom-bar');
      await expect(nav).toHaveCSS('border-top-left-radius','20px');
      await expect(nav).toHaveCSS('border-top-right-radius','20px');
      const bounds=await nav.boundingBox();
      expect(bounds).not.toBeNull();
      const png=(await page.screenshot({scale:'css'})).toString('base64');
      const colors=await page.evaluate(async ({png,x,y,w})=>{
        const picture=new Image();
        picture.src='data:image/png;base64,'+png;
        await picture.decode();
        const canvas=document.createElement('canvas');
        canvas.width=picture.naturalWidth;canvas.height=picture.naturalHeight;
        const context=canvas.getContext('2d')!;
        context.drawImage(picture,0,0);
        return [[x+2,y+2],[x+w-3,y+2],[x+28,y+2],[x+w-29,y+2]].map(([px,py])=>
          [...context.getImageData(Math.round(px),Math.round(py),1,1).data].slice(0,3));
      },{png,x:bounds!.x,y:bounds!.y,w:bounds!.width});
      // Light page surface is visible outside both curved corners, while
      // the interior of the same bar remains the original dark navy.
      for(const corner of colors.slice(0,2))expect(Math.min(...corner)).toBeGreaterThan(175);
      for(const navy of colors.slice(2))expect(Math.max(...navy)).toBeLessThan(85);
    }
  }
});
