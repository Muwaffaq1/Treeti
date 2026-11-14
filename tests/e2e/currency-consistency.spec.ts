import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {currencies,type Currency} from '../../src/lib/currencies';
import {money} from '../../src/lib/money';
import type {Aggregate} from '../../src/modules/agreements/types';

const origin='http://127.0.0.1:3000';
const lender='11111111-1111-4111-8111-111111111111',borrower='22222222-2222-4222-8222-222222222222';
const headers=()=>({Origin:origin,'Idempotency-Key':randomUUID()});
async function profile(page:Page,userId:string){expect((await page.request.post('/api/demo/session',{headers:headers(),data:{userId}})).ok()).toBe(true);}
async function create(page:Page,currency:Currency){
 const response=await page.request.post('/api/demo/agreements',{headers:headers(),data:{borrowerName:'Ahmad Ibrahim',borrowerContact:'ahmad@example.test',terms:{principalMinor:'130000',currency,interestMinor:'0',agreementDate:'2026-10-01',dueDate:'2027-02-01',repaymentType:'INSTALLMENTS',installments:{frequency:'MONTHLY',payments:[{dueDate:'2027-01-01',amountMinor:'65000'},{dueDate:'2027-02-01',amountMinor:'65000'}]},purpose:'Currency regression',additionalTerms:'',requiredWitnesses:0}}});
 expect(response.ok()).toBe(true);return (await response.json()).agreement as Aggregate;
}
async function command(page:Page,a:Aggregate,action:string,data:Record<string,unknown>={}){
 const response=await page.request.post(`/api/demo/agreements/${a.id}/${action}`,{headers:headers(),data:{action,expectedVersionId:a.currentVersionId,...data}});
 expect(response.ok()).toBe(true);return (await response.json()).agreement as Aggregate;
}

test('all ten agreement currencies label principal, zero interest and installments consistently',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.request.post('/api/demo/session',{headers:headers(),data:{fresh:true}});
 for(const currency of currencies){
  const a=await create(page,currency);await page.goto(`/demo/agreements/${a.id}`);
  await expect(page.locator('.big-amount')).toHaveText(money('130000',currency));
  await expect(page.locator('.balance-facts')).toContainText(`Interest ${money('0',currency)} · 0%`);
  await expect(page.getByRole('region',{name:'Installment schedule'})).toContainText(money('65000',currency));
  await expect(page.locator('.wording')).toContainText(`Contractual interest is ${money('0',currency)} (0%)`);
  if(currency!=='NGN')await expect(page.locator('.detail')).not.toContainText('₦');
 }
});

test('a GBP repayment and cleared balance stay in pounds alongside a separate naira agreement',async({page})=>{
 await page.request.post('/api/demo/session',{headers:headers(),data:{fresh:true}});let a=await create(page,'GBP');a=await command(page,a,'send');
 await profile(page,borrower);const {invitations}=await (await page.request.get('/api/demo/pending-invitations')).json();const invitation=invitations.find((i:{publicId:string})=>i.publicId===a.publicId);
 expect(invitation).toBeTruthy();expect((await page.request.post(`/api/demo/pending-invitations/${invitation.id}/claim`,{headers:headers(),data:{}})).ok()).toBe(true);
 a=await command(page,a,'approve',{affirmed:true,signature:'Ahmad Ibrahim'});await profile(page,lender);a=await command(page,a,'approve',{affirmed:true,signature:'Abdullah Musa'});expect(a.status).toBe('ACTIVE');
 await page.goto(`/demo/agreements/${a.id}`);await expect(page.locator('.progress-caption')).toContainText('0 of 2 paid');
 await page.getByRole('button',{name:'Record a payment',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('Amount paid (GBP)')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Go back'}).click();
 a=await command(page,a,'repayment',{amountMinor:'20000',date:'2026-10-11',method:'Cash'});await profile(page,borrower);a=await command(page,a,'confirm-repayment',{targetId:a.repayments[0].id});await page.goto(`/demo/agreements/${a.id}`);
 await expect(page.locator('.big-amount')).toHaveText('GBP 1,100');await expect(page.locator('.balance-facts')).toContainText('GBP 0 · 0%');await expect(page.locator('.progress-caption')).toContainText('Next GBP 450');await expect(page.locator('.payment-top')).toContainText('GBP 200');await expect(page.locator('.detail')).not.toContainText('₦');
 await profile(page,lender);await page.goto('/demo/agreements');await expect(page.locator('.kit-totals')).toContainText('GBP 1,100');await expect(page.locator('.kit-totals')).toContainText('₦250,000');
 await page.locator('.agreement-card').filter({hasText:'₦250,000'}).click();await expect(page.locator('.balance-facts')).toContainText('₦0 · 0%');await expect(page.locator('.detail')).not.toContainText('GBP');
});

test('private naira and pound debts keep independent totals, payment forms, history and plans',async({page})=>{
 await page.request.post('/api/demo/session',{headers:headers(),data:{fresh:true}});
 for(const currency of ['NGN','GBP']){
  const response=await page.request.post('/api/demo/debts',{headers:headers(),data:{person:`Private ${currency} lender`,currency,amountMinor:'130000',date:'2026-10-01',note:'',installments:{frequency:'MONTHLY',payments:[{dueDate:'2027-01-01',amountMinor:'65000'},{dueDate:'2027-02-01',amountMinor:'65000'}]}}});expect(response.ok()).toBe(true);
 }
 await page.goto('/demo/debts');
 for(const currency of ['GBP','NGN']){
  const card=page.getByRole('article').filter({hasText:`Private ${currency} lender`});await card.getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:`Record a payment to Private ${currency} lender`}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText(currency==='NGN'?'₦1,300':`${currency} 1,300`);await dialog.getByLabel(`Amount paid (${currency})`).fill('200');await dialog.getByRole('button',{name:'Save payment',exact:true}).click();await expect(dialog).toBeHidden();
  const sign=currency==='NGN'?'₦':`${currency} `;await card.getByRole('button').click();const detail=page.getByRole('dialog');await detail.locator('summary').filter({hasText:'payment recorded'}).click();await detail.locator('summary').filter({hasText:'Repayment plan'}).click();await expect(detail.locator('.debt-history')).toContainText(`${sign}200`);await expect(detail.locator('.debt-amounts')).toContainText(`${sign}1,100`);await expect(detail.getByRole('region',{name:'Installment schedule'})).toContainText(`${sign}450`);await expect(detail).not.toContainText(currency==='GBP'?'₦':'GBP');await page.keyboard.press('Escape');await expect(detail).toBeHidden();
 }
 const totals=page.getByRole('region',{name:'Outstanding totals by currency'});await expect(totals).toContainText('GBP 1,100');await expect(totals).toContainText('₦1,100');
});

test('an overview with no active balance does not invent a naira currency',async({page})=>{
 await page.request.post('/api/demo/session',{headers:headers(),data:{fresh:true}});await profile(page,'33333333-3333-4333-8333-333333333333');const a=await create(page,'GBP');await page.goto('/demo/agreements');
 await expect(page.locator('.kit-totals')).toHaveCount(0);await expect(page.locator('.agreement-card').filter({hasText:a.publicId})).toContainText('GBP 1,300');
});
