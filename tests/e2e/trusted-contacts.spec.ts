import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
// Ahmad adds Yusuf as a trusted contact; neither is the demonstration's busiest profile.
const origin='http://127.0.0.1:3000',owner='22222222-2222-4222-8222-222222222222',contact='44444444-4444-4444-8444-444444444444',outsider='55555555-5555-4555-8555-555555555555';

for(const width of [390,1366])test(`a trusted contact is invited, asks, is shared with and sees records at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const post=(path:string,data:unknown={})=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 const as=async(userId:string)=>{await post('/api/demo/session',{userId});};
 const axe=async()=>{const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);};
 await post('/api/demo/session',{fresh:true});await as(owner);
 await post('/api/demo/debts',{person:'Bilal Musa',currency:'NGN',amountMinor:'2500000',date:'2026-09-01',note:'Kept private',witnesses:['Aisha Suleiman']});
 await page.goto('/demo');
 if(width<800){await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('menuitem',{name:'Trusted contacts'}).click();}
 else await page.locator('.sidebar').getByRole('link',{name:'Trusted contacts'}).click();
 await expect(page.getByRole('heading',{level:1,name:'Trusted contacts'})).toBeVisible();await axe();
 await page.getByRole('button',{name:'Add a trusted contact'}).first().click();
 let dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Add trusted contact'}).click();await expect(dialog.getByLabel('Full name')).toBeFocused();
 await dialog.getByLabel('Full name').fill('Yusuf Ali');await dialog.getByLabel('Email address').fill('ahmad@example.test');await dialog.getByRole('button',{name:'Add trusted contact'}).click();
 await expect(dialog.locator('.error-message')).toHaveText('Enter someone else’s email address. You can’t be your own trusted contact.');
 await dialog.getByLabel('Email address').fill('Yusuf@Example.test');await dialog.getByRole('button',{name:'Add trusted contact'}).click();
 await expect(dialog.getByRole('heading',{name:'Send the link to Yusuf Ali'})).toBeVisible();
 const link=await dialog.getByRole('link',{name:'Open invitation'}).getAttribute('href');expect(link).toMatch(/^\/demo\/trusted\/[A-Za-z0-9_-]{43}$/);
 await dialog.getByRole('button',{name:'Done'}).click();
 await expect(page.getByRole('article').filter({hasText:'Yusuf Ali'})).toContainText('Invited');

 await as(outsider);await page.goto(link!);await page.getByRole('button',{name:'Accept'}).click();
 await expect(page.locator('.error-message')).toHaveText('Sign in with the email address this invitation was sent to.');
 await as(contact);await page.goto(link!);
 await expect(page.getByRole('heading',{name:'Become Ahmad Ibrahim’s trusted contact?'})).toBeVisible();await axe();
 await page.getByRole('button',{name:'Accept'}).click();await expect(page).toHaveURL(/\/demo\/trusted-contacts$/);
 const card=page.getByRole('article').filter({hasText:'Ahmad Ibrahim'});
 await card.getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Ask to see records'}).click();dialog=page.getByRole('dialog',{name:'Ask to see Ahmad Ibrahim’s records?'});
 await expect(dialog).toContainText('If they don’t refuse within 14 days');await dialog.getByRole('button',{name:'Send request'}).click();
 await expect(page.getByRole('status').first()).toContainText('Request sent to Ahmad Ibrahim.');await expect(card).toContainText('You can see them from');
 await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/trusted-contact-waiting-${width}.png`,fullPage:true,animations:'disabled'});

 await as(owner);await page.goto('/demo');
 await expect(page.locator('.brief')).toContainText('Yusuf asked to see your debts.');
 await page.locator('.brief').getByRole('link',{name:/Yusuf asked to see your debts/}).click();
 const mine=page.getByRole('article').filter({hasText:'Yusuf Ali'});await expect(mine).toContainText('Asked to see your records');await axe();
 await page.screenshot({path:`output/qa/trusted-contact-request-${width}.png`,fullPage:true,animations:'disabled'});
 await mine.getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Share now'}).click();await page.getByRole('dialog',{name:'Share your records with Yusuf Ali now?'}).getByRole('button',{name:'Share now'}).click();
 await expect(mine).toContainText('Can see your records');

 await as(contact);await page.goto('/demo/trusted-contacts');
 await page.getByRole('article').filter({hasText:'Ahmad Ibrahim'}).getByRole('button').click();await page.getByRole('dialog').getByRole('link',{name:'View Ahmad Ibrahim’s records'}).click();
 await expect(page.getByRole('heading',{level:1,name:'Ahmad’s records'})).toBeVisible();
 const debt=page.getByRole('article').filter({hasText:'Bilal Musa'});await expect(debt).toContainText('Witnessed by Aisha Suleiman');await expect(debt).toContainText('25,000');
 await expect(page.getByText('Kept private')).toHaveCount(0);await axe();
 await page.screenshot({path:`output/qa/trusted-contact-records-${width}.png`,fullPage:true,animations:'disabled'});
 const recordsUrl=page.url();

 await as(owner);await page.goto('/demo/trusted-contacts');
 await mine.getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Stop sharing'}).click();await page.getByRole('dialog',{name:'Stop sharing with Yusuf Ali?'}).getByRole('button',{name:'Stop sharing'}).click();
 await expect(mine).toContainText('Accepted');
 await as(contact);await page.goto(recordsUrl);await expect(page.getByText('Bilal Musa')).toHaveCount(0);
 const id=recordsUrl.split('/').pop();expect((await page.request.get(`/api/demo/trusted/${id}/records`)).status()).toBe(403);
 await as(outsider);expect((await page.request.get(`/api/demo/trusted/${id}/records`)).status()).toBe(404);
});
