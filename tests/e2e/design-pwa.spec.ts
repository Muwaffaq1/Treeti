import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:3000';
for(const width of [375,390,430,1366,1920])test(`reminders and padded form icons at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/debts');
 await page.getByRole('button',{name:'Add a debt',exact:true}).click();let dialog=page.getByRole('dialog');
 const inset=await dialog.locator('.has-leading-icon').first().evaluate(el=>{const rect=el.getBoundingClientRect(),icon=el.querySelector('svg')!.getBoundingClientRect(),input=el.querySelector('input')!;return {icon:icon.left-rect.left,text:parseFloat(getComputedStyle(input).paddingLeft)};});expect(inset.icon).toBeGreaterThanOrEqual(15);expect(inset.text).toBeGreaterThanOrEqual(48);
 await dialog.getByLabel('Who do you owe?',{exact:true}).fill('Maryam Bello');await dialog.getByLabel('Original amount',{exact:true}).fill('5000');await dialog.getByLabel('Debt date',{exact:true}).fill('2026-10-01');await dialog.getByRole('button',{name:'Save private debt'}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Add reminder for Maryam Bello'}).click();dialog=page.getByRole('dialog');
 await page.clock.install();const when=new Date(Date.now()+5*60000),value=await page.evaluate(iso=>{const date=new Date(iso);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;},when.toISOString());await dialog.getByLabel('Remind me on',{exact:true}).fill(value);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/reminder-form-${width}.png`,animations:'disabled'});
 await dialog.getByRole('button',{name:'Save reminder',exact:true}).click();await expect(dialog).toBeHidden();await page.reload();const card=page.getByRole('article').filter({hasText:'Maryam Bello'});await expect(card).toContainText('Your next reminder');
 const url=await card.getByRole('link',{name:'Add to calendar'}).getAttribute('href'),calendar=await page.request.get(url!);expect(calendar.status()).toBe(200);expect(await calendar.text()).toContain('BEGIN:VALARM');expect(await calendar.text()).not.toContain('Maryam');
 await page.clock.fastForward(10*60000);await expect(page.getByRole('region',{name:'Reminders ready to review'})).toContainText('Your reminder for Maryam Bello');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.screenshot({path:`output/qa/reminder-due-${width}.png`,fullPage:true,animations:'disabled'});
 await card.getByRole('button',{name:'Change reminder',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Remove reminder',exact:true}).click();await expect(dialog).toBeHidden();await expect(card.getByRole('link',{name:'Add to calendar'})).toHaveCount(0);
 const debt=(await (await page.request.get('/api/demo/debts')).json()).debts[0];await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{userId:'22222222-2222-4222-8222-222222222222'}});expect((await page.request.get(url!)).status()).toBe(404);expect((await page.request.post(`/api/demo/debts/${debt.id}/reminder`,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data:{remindAt:when.toISOString(),timeZone:'UTC',email:false}})).status()).toBe(404);
});
test('PWA metadata, install guidance and a privacy-preserving offline screen',async({page,context})=>{
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/account');
 const manifest=await (await page.request.get('/manifest.webmanifest')).json();expect(manifest.short_name).toBe('treeti');expect(manifest.name).toContain('treeti');expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/launch');expect(manifest.icons.some((icon:{purpose:string})=>icon.purpose==='maskable')).toBe(true);expect(manifest.icons.every((icon:{src:string})=>icon.src.startsWith('/icons/treeti-'))).toBe(true);
 expect((await page.request.get('/favicon.ico')).status()).toBe(200);expect((await page.request.get('/icons/treeti.svg')).status()).toBe(200);
 for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('image/png');}
 await page.getByRole('button',{name:'Install treeti',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Add to Home Screen');await page.screenshot({path:'output/qa/pwa-install.png',animations:'disabled'});await dialog.getByRole('button',{name:'Got it'}).click();
 await page.goto('/launch?view=debts');await expect(page).toHaveURL('/demo/debts');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>(await(await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)))).flat();});expect(cached).toContain('/offline.html');expect(cached.every(path=>path==='/offline.html'||path.startsWith('/icons/'))).toBe(true);
 await context.setOffline(true);await page.goto('/demo/debts');await expect(page.getByRole('heading',{name:'A moment to reconnect.'})).toBeVisible();await page.screenshot({path:'output/qa/pwa-offline.png',animations:'disabled'});await context.setOffline(false);await page.getByRole('link',{name:'Try again'}).click();await expect(page).toHaveURL('/demo');
});
test('keyboard focus returns after a sheet and layouts reflow at 320px and enlarged text',async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/debts');
 // Follow the actual Tab order until the action, rather than clicking to establish focus.
 const add=page.getByRole('button',{name:'Add a debt',exact:true});for(let i=0;i<20&&!await add.evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');await expect(add).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();await expect(add).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.goto('/demo/agreements/new');await page.getByLabel('Principal amount').fill('1000');await page.getByRole('button',{name:'Continue',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.screenshot({path:'output/qa/borrower-form-320.png',fullPage:true,animations:'disabled'});
 await page.addStyleTag({content:'html{font-size:200%}body{font-size:32px}input,select,textarea,button{font-size:inherit!important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
});
