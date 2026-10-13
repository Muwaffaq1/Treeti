import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:3000',abdullah='11111111-1111-4111-8111-111111111111',ahmad='22222222-2222-4222-8222-222222222222';

for(const width of [390,1366])test(`in-app notifications replace event emails at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});
 const bell=page.locator(width<800?'.mobile-header':'.sidebar').getByRole('link',{name:/^Notifications/});
 await page.goto('/demo');await expect(bell).toHaveAccessibleName('Notifications');
 const created=await post('/api/demo/agreements',{borrowerName:'Ahmad Ibrahim',borrowerContact:'ahmad@example.test',terms:{principalMinor:'30000000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-10',dueDate:'2027-10-10',repaymentType:'SINGLE',purpose:'Notification test',additionalTerms:'',requiredWitnesses:0}});expect(created.ok()).toBe(true);const {agreement:a}=await created.json();
 const sent=await post(`/api/demo/agreements/${a.id}/agree-and-send`,{action:'agree-and-send',expectedVersionId:a.currentVersionId,signature:'Abdullah Musa',affirmed:true});expect(sent.ok()).toBe(true);const {invitation}=await sent.json();
 await post('/api/demo/session',{userId:ahmad});await page.goto(invitation.url);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await page.getByRole('button',{name:'Review and approve',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Approve these terms',exact:true}).click();await expect(dialog).toBeHidden();
 await post('/api/demo/session',{userId:abdullah});await page.goto('/demo');
 await expect(bell).toHaveAccessibleName(/Notifications, \d+ new/);
 await bell.click();await expect(page).toHaveURL(/\/demo\/notifications$/);await expect(page.getByRole('heading',{level:1,name:'Notifications'})).toBeVisible();
 const first=page.locator('.activity-events > li').first();await expect(first).toContainText('Ahmad Ibrahim');await expect(first.locator('.notice-new')).toHaveText('New');
 await expect(bell).toHaveAccessibleName('Notifications');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await mkdir('output/qa',{recursive:true});await page.evaluate(()=>document.fonts.ready.then(()=>undefined));await page.screenshot({path:`output/qa/notifications-${width}.png`,animations:'disabled'});
 await first.getByRole('link').click();await expect(page).toHaveURL(new RegExp(`/demo/agreements/${a.id}$`));
 await page.goto('/demo/notifications');await expect(page.locator('.notice-new')).toHaveCount(0);
 const mine=await (await page.request.get('/api/demo/notifications')).json();expect(mine.notices.every((n:{by:string})=>n.by!=='Abdullah Musa')).toBe(true);
});

test('the invitation is shared by the sender, with WhatsApp first',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{(window as unknown as {opened:string[]}).opened=[];window.open=(url?:string|URL)=>{(window as unknown as {opened:string[]}).opened.push(String(url));return null;};});
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});
 await page.goto('/demo/agreements/new');
 const amount=page.getByLabel('Principal amount');await expect(amount).toBeEnabled();await amount.fill('300,000');
 await page.getByLabel('Borrower’s full name').fill('Ahmad Ibrahim');await page.getByLabel('Email or phone number').fill('ahmad@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Repayment due date').fill('2027-12-31');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('checkbox',{name:/I have read and agree/}).check();await page.getByRole('button',{name:'Agree and send',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ready to review together.'})).toBeVisible();await expect(page.getByText('treeti does not email invitations.')).toBeVisible();
 await page.getByRole('button',{name:'Share on WhatsApp'}).click();
 const opened=await page.evaluate(()=>(window as unknown as {opened:string[]}).opened);expect(opened).toHaveLength(1);
 const shared=new URL(opened[0]);expect(shared.origin+shared.pathname).toBe('https://wa.me/');expect(shared.searchParams.get('text')).toMatch(/Please review it here: http:\/\/127\.0\.0\.1:3000\/demo\/invite\/[A-Za-z0-9_-]{43}/);
 await expect(page.getByRole('button',{name:'Copy link'})).toBeVisible();
 await page.screenshot({path:'output/qa/share-invitation-mobile.png',animations:'disabled'});
});

test('a signed-in person is invited to add treeti after a few seconds, and can decline',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{if(!sessionStorage.getItem('nudge-test')){sessionStorage.setItem('nudge-test','1');localStorage.setItem('treeti:install-nudge','show');}});
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});
 await page.goto('/demo');
 const nudge=page.getByRole('region',{name:'Add treeti to your device'});await expect(nudge).toHaveCount(0);
 await expect(nudge).toBeVisible({timeout:12000});await expect(nudge).toContainText('Keep treeti a tap away');
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.screenshot({path:'output/qa/install-nudge-mobile.png',animations:'disabled'});
 await nudge.getByRole('button',{name:'Not now'}).click();await expect(nudge).toHaveCount(0);
 await page.reload();await page.waitForTimeout(8000);await expect(nudge).toHaveCount(0);
});

test('a waiting party can remind the other person on WhatsApp',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{(window as unknown as {opened:string[]}).opened=[];window.open=(url?:string|URL)=>{(window as unknown as {opened:string[]}).opened.push(String(url));return null;};});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});
 const created=await post('/api/demo/agreements',{borrowerName:'Ahmad Ibrahim',borrowerContact:'ahmad@example.test',terms:{principalMinor:'5000000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-10',dueDate:'2027-10-10',repaymentType:'SINGLE',purpose:'Reminder test',additionalTerms:'',requiredWitnesses:0}});const {agreement:a}=await created.json();
 const {invitation}=await (await post(`/api/demo/agreements/${a.id}/agree-and-send`,{action:'agree-and-send',expectedVersionId:a.currentVersionId,signature:'Abdullah Musa',affirmed:true})).json();
 await page.goto(`/demo/agreements/${a.id}`);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Remind Ahmad Ibrahim on WhatsApp'})).toHaveCount(0);
 await post('/api/demo/session',{userId:ahmad});await page.goto(invitation.url);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Remind .* on WhatsApp/})).toHaveCount(0);
 await post('/api/demo/session',{userId:abdullah});await page.goto(`/demo/agreements/${a.id}`);
 const remind=page.getByRole('button',{name:'Remind Ahmad Ibrahim on WhatsApp'});await remind.click();
 const opened=await page.evaluate(()=>(window as unknown as {opened:string[]}).opened);expect(opened).toHaveLength(1);
 expect(new URL(opened[0]).searchParams.get('text')).toBe(`Hi Ahmad, please review and approve the terms on treeti: http://127.0.0.1:3000/demo/agreements/${a.id}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await remind.scrollIntoViewIfNeeded();await page.screenshot({path:'output/qa/remind-whatsapp-mobile.png',animations:'disabled'});
});
