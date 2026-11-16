import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {currencies} from '../../src/lib/currencies';
// Worst-case data probe (break-ui). Run on demand: STRESS=1 npx playwright test tests/e2e/stress.spec.ts
// Every value is realistic or the schema's own limit: names 120, amounts 99,999,999,999,999 minor, notes 2,000,
// 4 debt witnesses, 5 investment partners, 60 repayment parts, contacts 254.
test.skip(!process.env.STRESS,'Set STRESS=1 to run the worst-case probe.');
test.setTimeout(15*60000);
const origin='http://127.0.0.1:3000',out='output/stress';
const lender='11111111-1111-4111-8111-111111111111',borrower='22222222-2222-4222-8222-222222222222';
const H=()=>({Origin:origin,'Idempotency-Key':randomUUID()});
const MAX='99999999999999';
const longName='Aleksandra Wiśniewska-Kowalczyk';
const longerName='Oluwaseun Abdulrahman Adebayo-Ogunleye';
const name120='Ngozi Chiamaka Oluwadamilare Abdulrahman Wiśniewska-Kowalczyk Fitzgerald-Oyelaran Montgomery-Adeyemi Bartholomew III';
const note2000=('We agreed this at the family meeting in Kaduna after the harvest. Repayment can move if the shop has a slow month; we will talk first. ').repeat(16).slice(0,2000);
const invest120='Northwind Agro-Processing Cooperative Society Limited, Kaduna State Smallholder Maize Aggregation Scheme Phase II';
const today=new Date().toISOString().slice(0,10);
const addMonths=(n:number)=>{const d=new Date(Date.UTC(2026,11,1));d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);};
function plan(total:string,parts:number){const t=BigInt(total),base=t/BigInt(parts),payments=Array.from({length:parts},(_,i)=>({dueDate:addMonths(i),amountMinor:(i===parts-1?t-base*BigInt(parts-1):base).toString()}));return {frequency:'MONTHLY',payments};}
async function post(page:Page,url:string,data:unknown){const r=await page.request.post(url,{headers:H(),data});if(!r.ok())throw new Error(`${url} ${r.status()} ${await r.text()}`);return r.json();}
async function as(page:Page,userId:string){await post(page,'/api/demo/session',{userId});}

type Finding={screen:string;width:number|string;pageOverflow?:boolean;clipped?:string[];offscreen?:string[];squished?:string[];error?:string};
const findings:Finding[]=[];
/** Looks for the break-ui signatures that show up in the DOM: page overflow, clipped text, things past the edge, squished avatars. */
async function probe(page:Page,screen:string,width:number|string){
  await page.waitForTimeout(700);
  const r=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth,root=[...document.querySelectorAll('[role=dialog]')].pop()??document.querySelector('main')??document.body;
    const label=(el:Element)=>`${el.tagName.toLowerCase()}${el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''} "${(el.textContent??'').trim().slice(0,40)}"`;
    const clipped:string[]=[],offscreen:string[]=[],squished:string[]=[];
    for(const el of root.querySelectorAll('*')){
      const cs=getComputedStyle(el),rect=el.getBoundingClientRect();if(!rect.width||cs.visibility==='hidden')continue;
      const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent!.trim());
      if(text&&el.scrollWidth>el.clientWidth+1&&cs.overflow!=='visible'&&cs.textOverflow!=='ellipsis'&&!el.closest('.sr-only'))clipped.push(label(el));
      if(rect.right>vw+1&&!el.closest('.sr-only')&&cs.position!=='fixed')offscreen.push(label(el));
      if(el.classList.contains('kit-avatar')||el.classList.contains('ledger-tile')){if(Math.abs(rect.width-rect.height)>2)squished.push(`${label(el)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);}
    }
    return {pageOverflow:document.documentElement.scrollWidth>vw+1,clipped:[...new Set(clipped)].slice(0,12),offscreen:[...new Set(offscreen)].slice(0,12),squished:[...new Set(squished)].slice(0,8)};
  });
  findings.push({screen,width,...r});
  await page.screenshot({path:`${out}/${screen}-${width}.png`,fullPage:true,animations:'disabled'});
}
const sizes:[number,number,string][]=[[320,720,'320'],[390,844,'390'],[1366,900,'1366']];
async function atSizes(page:Page,screen:string,go:()=>Promise<void>){
  const attempt=async(tag:string,run:()=>Promise<void>)=>{try{await run();}catch(e){findings.push({screen,width:tag,error:String(e).split('\n')[0].slice(0,200)});await page.screenshot({path:`${out}/${screen}-${tag}-error.png`}).catch(()=>{});}};
  for(const [w,h,tag] of sizes)await attempt(tag,async()=>{await page.setViewportSize({width:w,height:h});await go();await probe(page,screen,tag);});
  // 200% zoom at a 390px phone: text and boxes double, the viewport stays.
  await attempt('390-zoom200',async()=>{await page.setViewportSize({width:390,height:844});await go();await page.evaluate(()=>{document.documentElement.style.zoom='2';});await probe(page,screen,'390-zoom200');await page.evaluate(()=>{document.documentElement.style.zoom='';});});
}
const clickText=(page:Page,text:string|RegExp)=>page.getByRole('button',{name:text}).filter({visible:true}).first().click();

test('worst-case data across debts, investments, agreements, reminders and trusted contacts',async({page})=>{
  await mkdir(out,{recursive:true});page.setDefaultTimeout(15000);
  await page.goto('/demo');await post(page,'/api/demo/session',{fresh:true});await as(page,lender);

  // Debts: one of every kind of hard row, then ordinary rows for a long list. The demo allows 15 writes per record type every 10 minutes.
  const big=await post(page,'/api/demo/debts',{person:longName,currency:'USD',amountMinor:MAX,date:'2025-01-15',note:note2000,witnesses:[name120.slice(0,120),longerName,'Bartholomew Fitzgerald-Oyelaran','Jo'],installments:plan(MAX,60)});
  await post(page,`/api/demo/debts/${big.debt.id}/payments`,{amountMinor:'1',date:today,note:''});
  await post(page,'/api/demo/debts',{person:'Jo',currency:'NGN',amountMinor:'1',date:today,note:''});
  await post(page,'/api/demo/debts',{person:longerName,currency:'GBP',amountMinor:'1234567',date:'2025-06-01',note:'',dueDate:'2025-12-01'});
  const mama=await post(page,'/api/demo/debts',{person:'🌻 Mama Ngozi',currency:'NGN',amountMinor:'5000000',date:'2026-02-01',note:''});
  await post(page,`/api/demo/debts/${mama.debt.id}/payments`,{amountMinor:'2500000',date:today,note:'Half, by transfer'});
  await post(page,'/api/demo/debts',{person:'عبد الرحمن بن عبد العزيز',currency:'SAR',amountMinor:'250000',date:'2026-03-01',note:''});
  await post(page,'/api/demo/debts',{person:name120,currency:'NGN',amountMinor:MAX,date:'2026-01-01',note:''});
  for(const [i,c] of currencies.slice(0,6).entries())await post(page,'/api/demo/debts',{person:`Filler ${['Chukwuemeka','Fatimah','Ifeoluwa','Zainab','Babajide','Halima','Tochukwu','Hauwa','Olamide','Khadijah'][i]} Okafor`,currency:c,amountMinor:String(987654321+i),date:'2026-04-01',note:''});

  // Investments: the longest name with five long partners, a tiny one, and one with a long history.
  await post(page,'/api/demo/investments',{name:invest120,currency:'NGN',amountMinor:MAX,date:'2025-03-01',note:note2000,partners:[name120.slice(0,120),longName,longerName,'Bartholomew Fitzgerald-Oyelaran','عبد الرحمن بن عبد العزيز'].map(n=>({name:n,share:1})),myShare:95});
  await post(page,'/api/demo/investments',{name:'Gold',currency:'GBP',amountMinor:'1',date:today,note:''});
  const farm=await post(page,'/api/demo/investments',{name:'Sister’s shop',currency:'KES',amountMinor:'1000000',date:'2025-01-01',note:'',partners:[{name:'Jo',share:49},{name:'🌻 Mama Ngozi',share:1}],myShare:50});
  let rev=farm.investment.revision;
  for(let i=0;i<8;i++){const r=await post(page,`/api/demo/investments/${farm.investment.id}`,{action:'contribute',amountMinor:String(10000+i),date:'2026-01-01',note:i%5?'':'Restock after the market day',expectedRevision:rev});rev=r.investment.revision;}
  for(const c of currencies.slice(6))await post(page,'/api/demo/investments',{name:`${c} savings circle`,currency:c,amountMinor:'99999999',date:'2026-01-01',note:''});

  // Trusted contact with the longest realistic email.
  await post(page,'/api/demo/trusted',{name:name120.slice(0,120),email:'bartholomew.fitzgerald@northwind-industries-holdings.example.com'});

  // Agreements: the longest borrower name, the largest amount, sixty parts, made live, with a repayment to confirm and forgiveness offered.
  let a=(await post(page,'/api/demo/agreements',{borrowerName:name120.slice(0,120),borrowerContact:'ahmad@example.test',terms:{principalMinor:MAX,currency:'USD',interestMinor:'0',agreementDate:'2026-10-01',dueDate:addMonths(59),repaymentType:'INSTALLMENTS',installments:plan(MAX,60),purpose:'Expanding the cold room for the maize cooperative before the dry season',additionalTerms:note2000,requiredWitnesses:0}})).agreement;
  a=(await post(page,`/api/demo/agreements/${a.id}/send`,{action:'send',expectedVersionId:a.currentVersionId})).agreement;
  await as(page,borrower);const {invitations}=await (await page.request.get('/api/demo/pending-invitations')).json();const inv=invitations.find((i:{publicId:string})=>i.publicId===a.publicId);
  await post(page,`/api/demo/pending-invitations/${inv.id}/claim`,{});
  a=(await post(page,`/api/demo/agreements/${a.id}/approve`,{action:'approve',expectedVersionId:a.currentVersionId,affirmed:true,signature:name120.slice(0,120)})).agreement;
  await as(page,lender);
  a=(await post(page,`/api/demo/agreements/${a.id}/approve`,{action:'approve',expectedVersionId:a.currentVersionId,affirmed:true,signature:'Abdullah Musa'})).agreement;
  expect(a.status).toBe('ACTIVE');
  await as(page,borrower);
  a=(await post(page,`/api/demo/agreements/${a.id}/repayment`,{action:'repayment',expectedVersionId:a.currentVersionId,amountMinor:'166666666666',date:today,method:'Bank transfer',reference:'FT24100312345678901234567890',note:note2000.slice(0,300)})).agreement;
  await as(page,lender);
  const url=`/demo/agreements/${a.id}`;

  // Screens.
  await atSizes(page,'home',async()=>{await page.goto('/demo');});
  await atSizes(page,'debts',async()=>{await page.goto('/demo/debts');});
  await atSizes(page,'debt-detail',async()=>{await page.goto('/demo/debts');await page.getByRole('article',{name:longName}).filter({visible:true}).first().getByRole('button').click();await expect(page.getByRole('dialog')).toBeVisible();});
  await atSizes(page,'debt-edit',async()=>{await page.goto('/demo/debts');await page.getByRole('article',{name:longName}).filter({visible:true}).first().getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:`Edit debt for ${longName}`}).click();await expect(page.getByRole('heading',{name:'Change your record'})).toBeVisible();});
  await atSizes(page,'debt-payment-picker',async()=>{await page.goto('/demo/debts');await clickText(page,'Record a payment');await page.getByRole('button',{name:/^Paid to .+\. Change$/}).click();await expect(page.getByRole('dialog',{name:'Who did you pay?'})).toBeVisible();});
  await atSizes(page,'debt-reminder',async()=>{await page.goto('/demo/debts');await page.getByRole('article',{name:longName}).filter({visible:true}).first().getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:`Add reminder for ${longName}`}).click();await expect(page.getByRole('heading',{name:'A little reminder, for you'})).toBeVisible();});
  await atSizes(page,'investments',async()=>{await page.goto('/demo/investments');});
  await atSizes(page,'investment-detail',async()=>{await page.goto('/demo/investments');await page.getByRole('article',{name:invest120}).filter({visible:true}).first().getByRole('button').click();await expect(page.getByRole('dialog')).toBeVisible();});
  await atSizes(page,'investment-edit',async()=>{await page.goto('/demo/investments');await page.getByRole('article',{name:invest120}).filter({visible:true}).first().getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:`Edit investment ${invest120}`}).click();await expect(page.getByRole('heading',{name:'Change your record'})).toBeVisible();});
  await atSizes(page,'investment-partners',async()=>{await page.goto('/demo/investments');await page.getByRole('article',{name:invest120}).filter({visible:true}).first().getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Change who’s in it'}).click();await expect(page.getByRole('dialog',{name:'Who’s in it with you?'})).toBeVisible();});
  await atSizes(page,'investment-history',async()=>{await page.goto('/demo/investments');await page.getByRole('article',{name:'Sister’s shop'}).filter({visible:true}).first().getByRole('button').click();await expect(page.getByRole('dialog')).toBeVisible();});
  await atSizes(page,'add-money-picker',async()=>{await page.goto('/demo/investments');await clickText(page,'Add money');await page.getByRole('button',{name:/^Added to .+\. Change$/}).click();await expect(page.getByRole('dialog',{name:'Which investment?'})).toBeVisible();});
  await atSizes(page,'agreements',async()=>{await page.goto('/demo/agreements');});
  await atSizes(page,'agreement-detail',async()=>{await page.goto(url);});
  await atSizes(page,'agreement-confirm-repayment',async()=>{await page.goto(url);await clickText(page,'Confirm payment');await expect(page.getByRole('heading',{name:'Confirm this repayment'})).toBeVisible();});
  await atSizes(page,'agreement-forgiveness',async()=>{await page.goto(url);await page.getByRole('button',{name:'More options'}).filter({visible:true}).first().click();const item=page.getByRole('menuitem',{name:/forgive/i});if(await item.count()){await item.first().click();}else{await page.keyboard.press('Escape');}await page.waitForTimeout(400);});
  await atSizes(page,'trusted',async()=>{await page.goto('/demo/trusted-contacts');});
  await atSizes(page,'trusted-add-filled',async()=>{await page.goto('/demo/trusted-contacts');await clickText(page,/Add a trusted contact/);const s=page.getByRole('dialog',{name:'Who do you trust?'});await s.getByLabel('Full name').fill(name120.slice(0,120));await s.getByRole('button',{name:'Next: their email'}).click();const e=page.getByRole('dialog',{name:'Their email address'});await e.getByLabel('Email address').fill('bartholomew.fitzgerald@northwind-industries-holdings.example.com');await e.getByRole('button',{name:'Done'}).click();await expect(e).toHaveCount(0);});
  await writeFile(`${out}/report.json`,JSON.stringify(findings,null,1));
});
