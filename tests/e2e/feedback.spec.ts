import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
// Maryam sends; Abdullah (the demonstration's operator) reads. Neither spends the agreement command allowance.
const origin='http://127.0.0.1:3000',operator='11111111-1111-4111-8111-111111111111',sender='33333333-3333-4333-8333-333333333333';

for(const width of [390,1366])test(`a signed-in person sends feedback and only the operator can read it at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});await post('/api/demo/session',{userId:sender});
 await page.goto('/demo');
 if(width<800){await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('menuitem',{name:'Send feedback'}).click();}
 else await page.locator('.sidebar').getByRole('link',{name:'Send feedback'}).click();
 await expect(page).toHaveURL(/\/demo\/feedback$/);await expect(page.getByRole('heading',{level:1,name:'Share your feedback'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'What people have said'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Numbers'})).toHaveCount(0);
 await page.getByRole('button',{name:'Send feedback'}).click();await expect(page.locator('.error-message')).toHaveText('Choose a rating or write a message.');
 await page.getByRole('radio',{name:'4 out of 5, Very good'}).check({force:true});await expect(page.getByText('Very good',{exact:true})).toBeVisible();await expect(page.locator('.error-message')).toHaveCount(0);
 const message=`I could not find custom installments at first (${width}).`;
 await page.getByRole('textbox',{name:'Your message'}).fill(message);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const form=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(form.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await mkdir('output/qa',{recursive:true});await page.evaluate(()=>document.fonts.ready.then(()=>undefined));await page.screenshot({path:`output/qa/feedback-form-${width}.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Send feedback'}).click();
 await expect(page.getByRole('heading',{name:'Thank you.'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('treeti:feedback-prompt'))).toMatch(/^sent:\d+$/);
 // The operator sees it, with who sent it; the sender never sees a list.
 await post('/api/demo/session',{userId:operator});await page.goto('/demo/feedback');
 await expect(page.getByRole('heading',{name:'What people have said'})).toBeVisible();
 const numbers=page.getByRole('region',{name:'Numbers'});await expect(numbers.getByRole('heading',{name:'Numbers'})).toBeVisible();
 for(const label of ['Agreements','People signed up','Made an agreement','Recorded'])await expect(numbers.locator('dt',{hasText:new RegExp(`^${label}$`)})).toBeVisible();
 await expect(numbers.getByRole('table',{name:'Where agreements stand'})).toBeVisible();await expect(numbers.getByRole('table',{name:'Last 7 days'}).getByRole('row')).toHaveCount(8);
 const first=page.locator('.feedback-received li').first();await expect(first).toContainText(message);await expect(first).toContainText('Maryam Bello');await expect(first.getByRole('img',{name:'4 out of 5'})).toBeVisible();
 const inbox=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(inbox.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:`output/qa/feedback-inbox-${width}.png`,animations:'disabled',fullPage:true});
});

test('people are invited to give feedback once they have looked around, and can decline',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});await post('/api/demo/session',{userId:sender});
 await page.goto('/demo');
 const prompt=page.getByRole('region',{name:'Share your feedback'});
 // Automated browsers only see the prompt when a test asks for it.
 await page.evaluate(()=>localStorage.setItem('treeti:feedback-prompt','show'));await page.clock.install();
 await page.goto('/demo/debts');await expect(prompt).toHaveCount(0);await page.clock.fastForward(13000);
 await expect(prompt).toBeVisible();await expect(prompt).toContainText('How is treeti working for you?');
 await mkdir('output/qa',{recursive:true});await page.screenshot({path:'output/qa/feedback-prompt-390.png',animations:'disabled'});
 await prompt.getByRole('button',{name:'Not now'}).click();await expect(prompt).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('treeti:feedback-prompt'))).toMatch(/^later:\d+$/);
 await page.evaluate(()=>localStorage.setItem('treeti:feedback-prompt','show'));await page.goto('/demo/investments');await page.clock.fastForward(13000);
 await prompt.getByRole('link',{name:'Give feedback'}).click();await expect(page).toHaveURL(/\/demo\/feedback$/);await expect(prompt).toHaveCount(0);
});

test('feedback cannot be sent without a session or from another site',async({request})=>{
 const anonymous=await request.post('/api/feedback',{headers:{Origin:origin},data:{message:'Hello'}});expect([401,503]).toContain(anonymous.status());
 const foreign=await request.post('/api/demo/feedback',{headers:{Origin:'https://untrusted.example'},data:{message:'Hello'}});expect(foreign.status()).toBe(403);
});
