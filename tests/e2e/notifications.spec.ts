import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
// Maryam lends to Yusuf here so these checks do not spend the main demonstration person's command allowance.
const origin='http://127.0.0.1:3000',lender='33333333-3333-4333-8333-333333333333',borrower='44444444-4444-4444-8444-444444444444';

for(const width of [390,1366])test(`in-app notifications replace event emails at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});await post('/api/demo/session',{userId:lender});
 const bell=page.locator(width<800?'.mobile-header':'.sidebar').getByRole('link',{name:/^Notifications/});
 await page.goto('/demo');await expect(bell).toHaveAccessibleName('Notifications');
 // The first load on a device records a starting point; wait for it so later events count as new.
 await page.waitForFunction(id=>localStorage.getItem(`treeti:notices-seen:${id}`)!==null,lender);
 const created=await post('/api/demo/agreements',{borrowerName:'Yusuf Ali',borrowerContact:'yusuf@example.test',terms:{principalMinor:'30000000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-10',dueDate:'2027-10-10',repaymentType:'SINGLE',purpose:'Notification test',additionalTerms:'',requiredWitnesses:0}});expect(created.ok()).toBe(true);const {agreement:a}=await created.json();
 const sent=await post(`/api/demo/agreements/${a.id}/agree-and-send`,{action:'agree-and-send',expectedVersionId:a.currentVersionId,signature:'Maryam Bello',affirmed:true});expect(sent.ok()).toBe(true);const {invitation}=await sent.json();
 await post('/api/demo/session',{userId:borrower});await page.goto(invitation.url);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await page.getByRole('button',{name:'Review and approve',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Approve these terms',exact:true}).click();await expect(dialog).toBeHidden();
 // The bell reuses its last answer for a minute; a later visit asks again.
 await page.evaluate(()=>sessionStorage.clear());
 await post('/api/demo/session',{userId:lender});await page.goto('/demo');
 await expect(bell).toHaveAccessibleName(/Notifications, \d+ new/);
 await bell.click();await expect(page).toHaveURL(/\/demo\/notifications$/);await expect(page.getByRole('heading',{level:1,name:'Notifications'})).toBeVisible();
 const first=page.locator('.activity-events > li').first();await expect(first).toContainText('Yusuf Ali');await expect(first.locator('.notice-new')).toHaveText('New');
 await expect(bell).toHaveAccessibleName('Notifications');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 await mkdir('output/qa',{recursive:true});await page.evaluate(()=>document.fonts.ready.then(()=>undefined));await page.screenshot({path:`output/qa/notifications-${width}.png`,animations:'disabled'});
 await first.getByRole('link').click();await expect(page).toHaveURL(new RegExp(`/demo/agreements/${a.id}$`));
 await page.goto('/demo/notifications');await expect(page.locator('.notice-new')).toHaveCount(0);
 const mine=await (await page.request.get('/api/demo/notifications')).json();expect(mine.notices.every((n:{by:string})=>n.by!=='Maryam Bello')).toBe(true);
});

test('the invitation is shared by the sender, with WhatsApp first',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{(window as unknown as {opened:string[]}).opened=[];window.open=(url?:string|URL)=>{(window as unknown as {opened:string[]}).opened.push(String(url));return null;};});
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{userId:lender}});
 await page.goto('/demo/agreements/new');
 const amount=page.getByLabel('Principal amount');await expect(amount).toBeEnabled();await amount.fill('300,000');
 await page.getByLabel('Borrower’s full name').fill('Yusuf Ali');await page.getByLabel('Email or phone number').fill('yusuf@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Repayment due date').fill('2027-12-31');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('checkbox',{name:/I confirm this loan is interest-free/}).check();await page.getByRole('button',{name:'Agree and send',exact:true}).click();
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
 // Device notifications need the live service; the demonstration offers none.
 expect((await (await page.request.get('/api/demo/push')).json()).publicKey).toBeNull();await page.goto('/demo/notifications');await expect(page.getByRole('heading',{level:1,name:'Notifications'})).toBeVisible();await expect(page.getByRole('region',{name:'Notifications on this device'})).toHaveCount(0);
});

test('a waiting party can remind the other person on WhatsApp',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{(window as unknown as {opened:string[]}).opened=[];window.open=(url?:string|URL)=>{(window as unknown as {opened:string[]}).opened.push(String(url));return null;};});
 const post=(path:string,data:unknown)=>page.request.post(path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 await post('/api/demo/session',{fresh:true});await post('/api/demo/session',{userId:lender});
 const created=await post('/api/demo/agreements',{borrowerName:'Yusuf Ali',borrowerContact:'yusuf@example.test',terms:{principalMinor:'5000000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-10',dueDate:'2027-10-10',repaymentType:'SINGLE',purpose:'Reminder test',additionalTerms:'',requiredWitnesses:0}});const {agreement:a}=await created.json();
 const {invitation}=await (await post(`/api/demo/agreements/${a.id}/agree-and-send`,{action:'agree-and-send',expectedVersionId:a.currentVersionId,signature:'Maryam Bello',affirmed:true})).json();
 await page.goto(`/demo/agreements/${a.id}`);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Remind Yusuf Ali on WhatsApp'})).toHaveCount(0);
 await post('/api/demo/session',{userId:borrower});await page.goto(invitation.url);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Remind .* on WhatsApp/})).toHaveCount(0);
 await post('/api/demo/session',{userId:lender});await page.goto(`/demo/agreements/${a.id}`);
 const remind=page.getByRole('button',{name:'Remind Yusuf Ali on WhatsApp'});await remind.click();
 const opened=await page.evaluate(()=>(window as unknown as {opened:string[]}).opened);expect(opened).toHaveLength(1);
 expect(new URL(opened[0]).searchParams.get('text')).toBe(`Hi Yusuf, please review and approve the terms on treeti: http://127.0.0.1:3000/demo/agreements/${a.id}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await remind.scrollIntoViewIfNeeded();await page.screenshot({path:'output/qa/remind-whatsapp-mobile.png',animations:'disabled'});
});

test('the device notification control explains each state without asking for permission on its own',async({browser})=>{
 const key='BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
 for(const [permission,heading,action] of [['granted','Get notified on this device','Turn on notifications'],['denied','Notifications are blocked for treeti',null]] as const){
  const context=await browser.newContext({viewport:{width:390,height:844},baseURL:origin,permissions:permission==='granted'?['notifications']:[]});const page=await context.newPage();
  await page.addInitScript(state=>{Object.defineProperty(Notification,'permission',{get:()=>state});},permission);
  await page.route('**/api/demo/push',route=>route.fulfill({json:{publicKey:key}}));
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});
  await page.goto('/demo/notifications');
  const card=page.getByRole('region',{name:'Notifications on this device'});await expect(card).toContainText(heading);
  if(action)await expect(card.getByRole('button',{name:action})).toBeVisible();else await expect(card.getByRole('button')).toHaveCount(0);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:`output/qa/push-card-${permission}-mobile.png`,animations:'disabled'});
  await page.goto('/demo/account');await expect(page.getByRole('region',{name:'Notifications on this device'})).toContainText(heading);
  await context.close();
 }
});
