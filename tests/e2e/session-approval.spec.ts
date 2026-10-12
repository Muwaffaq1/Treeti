import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:3000';
test('borrower and lender approve once from their signed-in session',async({page})=>{
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});
 const created=await page.request.post('/api/demo/agreements',{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data:{borrowerName:'Ahmad Ibrahim',borrowerContact:'ahmad@example.test',terms:{principalMinor:'100000',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-10',dueDate:'2027-10-10',repaymentType:'SINGLE',purpose:'Session approval test',additionalTerms:'',requiredWitnesses:0}}});expect(created.ok()).toBe(true);const {agreement:a}=await created.json();
 const sent=await page.request.post(`/api/demo/agreements/${a.id}/send`,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data:{action:'send',expectedVersionId:a.currentVersionId}});expect(sent.ok()).toBe(true);
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{userId:'22222222-2222-4222-8222-222222222222'}});const inbox=await (await page.request.get('/api/demo/pending-invitations')).json();const invitation=inbox.invitations.find((i:{publicId:string})=>i.publicId===a.publicId);expect(invitation).toBeTruthy();expect((await page.request.post(`/api/demo/pending-invitations/${invitation.id}/claim`,{headers:{Origin:origin},data:{}})).ok()).toBe(true);
 for(const userId of ['22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111']){
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{userId}});await page.goto(`/demo/agreements/${a.id}`);await page.getByRole('button',{name:'Review and approve'}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Send verification code'})).toHaveCount(0);await expect(dialog.locator('.demo-hint')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Change name'})).toBeVisible();await expect(dialog.getByLabel('Full name for this confirmation')).toHaveCount(0);await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Approve these terms'}).click();await expect(dialog).toHaveCount(0);
 }
 const saved=await (await page.request.get(`/api/demo/agreements/${a.id}`)).json();expect(saved.agreement.approvals).toHaveLength(2);expect(saved.agreement.approvals.every((p:{authenticationLevel:string})=>p.authenticationLevel==='DEMO_SESSION')).toBe(true);
});
