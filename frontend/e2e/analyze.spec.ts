import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Pokédex input modes, photo gallery, keyboard/RTL and reduced motion',async({page})=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto('./#/analyze');await expect(page.getByRole('heading',{name:'Card Condition'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Analyze card'})).toBeDisabled();
 await page.getByRole('button',{name:'eBay',exact:true}).click();await expect(page.getByRole('textbox',{name:'eBay listing URL'})).toBeVisible();
 await page.getByRole('button',{name:'Photos',exact:true}).click();
 await page.locator('input[type=file]').first().setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAgCAIAAACHPC9vAAAAJ0lEQVR4nGO8e2kxAzUAE1VMGTVo1KBRg0YNGjVo1KBRg0YNGnCDAFZAApJq8lFgAAAAAElFTkSuQmCC','base64')});
 await expect(page.getByRole('button',{name:'Inspect photo 1'})).toBeVisible();
 await page.getByRole('button',{name:'Inspect photo 1'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 expect((await new AxeBuilder({page}).include('.pokedex-frame').analyze()).violations).toEqual([]);
 await page.screenshot({path:'test-results/analyzer-en.png',fullPage:true});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'עברית'}).click();await page.getByRole('button',{name:'סגירה',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'מצב הקלף'})).toBeVisible();
 await page.setViewportSize({width:320,height:640});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});
 // Simulate only the visual state to verify CSS; no request is triggered.
 await page.locator('.pokedex-frame').evaluate(el=>el.setAttribute('data-status','busy'));
 expect(await page.locator('.pokedex-top .pokedex-lens').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.screenshot({path:'test-results/analyzer-he-320.png',fullPage:true});expect(failures).toEqual([]);
});
