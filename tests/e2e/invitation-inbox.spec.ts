import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:3000',borrowerId='22222222-2222-4222-8222-222222222222';
test('existing borrower sees an invitation before opening its email and can review without approving',async({page})=>{
  const headers={Origin:origin,'Idempotency-Key':randomUUID()};
  await page.request.post('/api/demo/session',{headers,data:{fresh:true}});
  const created=await page.request.post('/api/demo/agreements',{headers,data:{borrowerName:'Ahmad Ibrahim',borrowerContact:'ahmad@example.test',terms:{principalMinor:'88888885800',currency:'NGN',interestMinor:'0',agreementDate:'2026-10-09',dueDate:'2027-10-09',repaymentType:'SINGLE',purpose:'Inbox regression',additionalTerms:'',requiredWitnesses:0}}});
  expect(created.ok()).toBe(true);const {agreement:a}=await created.json();
  const sent=await page.request.post(`/api/demo/agreements/${a.id}/send`,{headers:{...headers,'Idempotency-Key':randomUUID()},data:{action:'send',expectedVersionId:a.currentVersionId}});expect(sent.ok()).toBe(true);
  await page.request.post('/api/demo/session',{headers,data:{userId:borrowerId}});
  await page.goto('/demo');const card=page.locator('article.attention-row').filter({hasText:a.publicId});await expect(card).toBeVisible();await expect(card).toContainText('Opening it does not mean you accept the terms.');
  expect((await page.request.get(`/api/demo/agreements/${a.id}`)).status()).toBe(404);
  await page.goto('/demo/agreements');await expect(card).toBeVisible();await card.getByRole('button',{name:'Review agreement'}).click();
  await expect(page).toHaveURL(new RegExp(`/demo/agreements/${a.id}$`));await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
  const opened=await (await page.request.get(`/api/demo/agreements/${a.id}`)).json();expect(opened.agreement.approvals).toHaveLength(0);expect(opened.agreement.status).toBe('AWAITING_BORROWER');
  await page.goto('/demo');await expect(page.locator('article.attention-row').filter({hasText:a.publicId})).toHaveCount(0);await expect(page.locator('a.attention-row').filter({hasText:a.publicId})).toBeVisible();
});
