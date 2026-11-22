import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Pokédex input modes, photo gallery, keyboard/RTL and reduced motion',async({page})=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto('./#/analyze');await expect(page.getByRole('heading',{name:'Card Condition'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Analyze card'})).toBeDisabled();
 await expect(page.getByRole('button',{name:/Take photo|Add close-up/})).toHaveCount(0);
 await expect(page.getByText('Use clear photos without glare.',{exact:false})).toHaveCount(0);
 for(const size of [{width:390,height:844},{width:320,height:568},{width:768,height:600}]){
   await page.setViewportSize(size);
   const bounds=await page.locator('.pokedex-frame').evaluate(el=>{
     const r=el.getBoundingClientRect(),header=document.querySelector('.app-shell>header')!.getBoundingClientRect(),nav=document.querySelector('.bottom-bar')!.getBoundingClientRect(),main=document.querySelector('#main-content')!.getBoundingClientRect();
     return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,headerBottom:header.bottom,navTop:nav.top,mainLeft:main.left,mainRight:main.right,scroll:document.documentElement.scrollHeight,viewport:innerHeight};
   });
   expect(Math.abs(bounds.top-bounds.headerBottom)).toBeLessThan(1);
   expect(Math.abs(bounds.bottom-bounds.navTop)).toBeLessThan(1);
   expect(bounds.left).toBe(bounds.mainLeft);expect(bounds.right).toBe(bounds.mainRight);
   expect(bounds.scroll).toBeLessThanOrEqual(bounds.viewport);
   await page.locator('.pokedex-display').evaluate(el=>{el.scrollTop=1000;});
   expect(await page.locator('.pokedex-frame').evaluate(el=>el.getBoundingClientRect().top)).toBe(bounds.top);
   expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.pokedex-display').evaluate(el=>{el.scrollTop=0;});
 await page.getByRole('button',{name:'eBay',exact:true}).click();await expect(page.getByRole('textbox',{name:'eBay listing URL'})).toBeVisible();
 await page.getByRole('button',{name:'Photos',exact:true}).click();
 await page.locator('input[type=file]').first().setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAgCAIAAACHPC9vAAAAJ0lEQVR4nGO8e2kxAzUAE1VMGTVo1KBRg0YNGjVo1KBRg0YNGnCDAFZAApJq8lFgAAAAAElFTkSuQmCC','base64')});
 await expect(page.getByRole('button',{name:'Inspect photo 1'})).toBeVisible();
 await expect(page.locator('.pokedex-bottom')).toHaveCSS('overflow','hidden');
 expect(await page.locator('.pokedex-middle').evaluate(el=>Math.abs(el.getBoundingClientRect().bottom-document.querySelector('.pokedex-bottom')!.getBoundingClientRect().top))).toBeLessThan(1);
 await page.screenshot({path:'test-results/analyzer-en.png',fullPage:true});
 await page.getByRole('button',{name:'Inspect photo 1'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 expect((await new AxeBuilder({page}).include('.pokedex-frame').analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'עברית'}).click();await page.getByRole('button',{name:'סגירה',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'מצב הקלף'})).toBeVisible();
 await page.setViewportSize({width:320,height:640});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 // Exercise the real vector colors/animations without a paid provider call.
 await page.locator('.pokedex-frame').evaluate(el=>el.setAttribute('data-status','busy'));
 expect(await page.locator('.pokedex-top .pokedex-lens-gradient stop').nth(2).evaluate(el=>getComputedStyle(el).stopColor)).toBe('rgb(237, 244, 252)');
 await expect(page.locator('.pokedex-top .pokedex-glass')).toHaveCSS('animation-name','pokedex-white-blink');
 await expect(page.locator('.pokedex-top .pokedex-green')).toHaveCSS('animation-delay','0s');
 await expect(page.locator('.pokedex-top .pokedex-yellow')).toHaveCSS('animation-delay','-0.8s');
 await page.screenshot({path:'test-results/analyzer-busy-white.png'});
 for(const [grade,color] of [['NM','rgb(19, 223, 128)'],['LP','rgb(162, 230, 53)'],['MP','rgb(250, 204, 21)'],['HP','rgb(251, 146, 60)'],['DMG','rgb(244, 63, 94)']]){
   await page.locator('.pokedex-frame').evaluate((el,g)=>{el.setAttribute('data-status','complete');el.setAttribute('data-grade',g!);},grade);
   expect(await page.locator('.pokedex-top .pokedex-lens-gradient stop').nth(2).evaluate(el=>getComputedStyle(el).stopColor)).toBe(color);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 // Simulate only the visual state to verify CSS; no request is triggered.
 await page.locator('.pokedex-frame').evaluate(el=>el.setAttribute('data-status','busy'));
 expect(await page.locator('.pokedex-top .pokedex-glass').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.locator('#main-content').focus();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'test-results/analyzer-he-320.png',fullPage:true});expect(failures).toEqual([]);
});
