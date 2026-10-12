import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
const origin='http://127.0.0.1:3000';
async function cancelProposal(page:Page){
 const created=await page.request.post('/api/demo/agreements',{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data:{borrowerName:'Cancelled Test Borrower',borrowerContact:'cancelled@example.test',terms:{principalMinor:'10000000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-11',dueDate:'2027-10-11',repaymentType:'SINGLE',purpose:'Cancelled proposal test',additionalTerms:'',requiredWitnesses:0}}});expect(created.ok()).toBe(true);const {agreement}=await created.json();
 await page.goto(`/demo/agreements/${agreement.id}`);await page.getByRole('button',{name:'Cancel this proposal',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel proposal',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 return agreement;
}
test('cancelled proposals stay out of default views but remain searchable in their own tab',async({page})=>{
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});
 const before=await (await page.request.get('/api/demo/agreements')).json();const currentCount=before.agreements.filter((a:{status:string})=>a.status!=='CANCELLED').length;
 const a=await cancelProposal(page);
 for(const path of ['/demo','/demo/agreements']){
  await page.goto(path);const cards=page.locator('.agreement-grid .agreement-card'),cancelled=cards.filter({hasText:a.publicId});await expect(cancelled).toHaveCount(0);
  if(path==='/demo')await expect(page.locator('.overview-stat').filter({hasText:'Agreements'}).locator('strong')).toHaveText(String(currentCount));
  await page.getByRole('button',{name:'Cancelled',exact:true}).click();await expect(cancelled).toBeVisible();await expect(cancelled).toContainText('Cancelled proposal');await expect(cards).toHaveCount(1);
  await page.getByRole('textbox',{name:'Search agreements'}).fill('missing-name');await expect(cards).toHaveCount(0);await page.getByRole('button',{name:'Clear search',exact:true}).click();await expect(cancelled).toBeVisible();await expect(page.getByRole('button',{name:'Cancelled',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'All',exact:true}).click();await page.getByRole('textbox',{name:'Search agreements'}).fill(a.publicId);await expect(cards).toHaveCount(0);
 }
 await page.getByRole('button',{name:'Cancelled',exact:true}).click();await page.locator('.agreement-card').filter({hasText:a.publicId}).click();await expect(page).toHaveURL(new RegExp(`/demo/agreements/${a.id}$`));
 const saved=await (await page.request.get(`/api/demo/agreements/${a.id}`)).json();expect(saved.agreement.status).toBe('CANCELLED');expect(saved.agreement.events.some((e:{type:string})=>e.type==='AGREEMENT_CANCELLED')).toBe(true);
});
test('a workspace with only cancelled agreements has a useful empty state and responsive filters',async({page})=>{
 const workspace=randomUUID(),file=`.ahd-demo/${workspace}.json`;await mkdir('.ahd-demo',{recursive:true});await writeFile(file,JSON.stringify({agreements:[],responses:{},used:[],counter:0}));
 try{
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{workspace}});await page.goto('/demo/agreements');await page.getByRole('button',{name:'Cancelled',exact:true}).click();await expect(page.getByRole('heading',{name:'No cancelled agreements.'})).toBeVisible();
  const a=await cancelProposal(page);await page.goto('/demo');await expect(page.locator('.agreement-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'View cancelled agreements',exact:true})).toBeVisible();await page.getByRole('button',{name:'View cancelled agreements',exact:true}).click();await expect(page.locator('.agreement-card')).toContainText(a.publicId);
  for(const width of [320,375,430,768,1366,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);const tabs=page.locator('.agreements-section .filter-tabs button');expect(await tabs.evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth;}))).toBe(true);}
  await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>document.documentElement.dir='rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.evaluate(()=>document.documentElement.dir='ltr');await page.locator('.agreements-section').scrollIntoViewIfNeeded();await mkdir('output/qa',{recursive:true});await page.screenshot({path:'output/qa/cancelled-agreements-mobile.png'});
  await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.getByRole('link',{name:'Create an agreement',exact:true})).toBeVisible();
 }finally{await rm(file,{force:true});}
});
