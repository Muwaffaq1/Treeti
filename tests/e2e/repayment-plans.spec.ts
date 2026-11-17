import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:3000';

for(const [plan,width] of [['MONTHLY',375],['WEEKLY',1366],['CUSTOM',375]] as const)test(`creates and reloads ${plan.toLowerCase()} installments at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});if(plan==='CUSTOM')await page.emulateMedia({colorScheme:'dark'});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  await page.getByRole('button',{name:'Choose how much you’re lending'}).click();
  const amount=page.getByLabel('Principal amount');await expect(amount).toBeEnabled();await amount.pressSequentially('1000.01');await expect(amount).toHaveValue('1,000.01');
  for(let i=0;i<7;i++)await amount.press('ArrowLeft');await amount.press('9');await expect(amount).toHaveValue('19,000.01');
  await amount.press('Backspace');await expect(amount).toHaveValue('1,000.01');
  await page.getByRole('button',{name:'Next: who',exact:true}).click();
  await page.getByLabel('Borrower’s full name').fill('Ahmad Ibrahim');await page.getByLabel('Email or phone number').fill('ahmad@example.test');await page.getByRole('button',{name:'Next: what it’s for',exact:true}).click();await page.getByRole('button',{name:'Leave it out',exact:true}).click();
  await page.getByRole('radiogroup',{name:'Repayment structure'}).locator(`input[value=\"${plan}\"]`).check();
  if(plan==='CUSTOM'){
    await page.getByLabel('Payment 1 date').fill('2027-01-31');await page.getByLabel('Payment 1 amount (NGN)').fill('500');
    await page.getByLabel('Payment 2 date').fill('2027-03-15');await page.getByLabel('Payment 2 amount (NGN)').fill('500');
    await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'add up'})).toBeVisible();
    await page.getByLabel('Payment 2 amount (NGN)').fill('500.01');
  }else{await page.getByLabel('First part',{exact:true}).fill('2027-01-31');await page.getByLabel('Parts',{exact:true}).fill('3');}
  await expect(page.getByLabel('Repay by')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(async()=>{await document.fonts.ready;});
  await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/installments-${plan.toLowerCase()}-${width}.png`,animations:'disabled'});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
  await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByRole('heading',{name:'Read it back',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page).toHaveURL(/\/demo\/agreements\/[a-f0-9-]{36}$/);await expect(page.getByRole('heading',{name:'The agreement',exact:true})).toBeVisible();
  const endpoint=page.url().replace('/demo/','/api/demo/'),result=await page.request.get(endpoint);expect(result.ok()).toBe(true);const response=await result.json();
  const terms=response.agreement.versions.at(-1).terms;expect(terms.repaymentType).toBe('INSTALLMENTS');expect(terms.installments.frequency).toBe(plan);
  expect(terms.installments.payments.reduce((sum:bigint,p:{amountMinor:string})=>sum+BigInt(p.amountMinor),0n)).toBe(100001n);
  if(plan==='MONTHLY')expect(terms.installments.payments.map((p:{dueDate:string})=>p.dueDate)).toEqual(['2027-01-31','2027-02-28','2027-03-31']);
  const url=page.url();await page.reload();await expect(page.getByRole('region',{name:'Installment schedule'})).toBeVisible();
  // Changing a draft uses the same fill-in-the-blank sentence, prefilled with the current terms.
  await page.goto(`${url}/edit`);await expect(page.getByRole('heading',{name:'Change the terms'})).toBeVisible();
  await expect(page.locator('.create-sentence')).toContainText('₦1,000.01');await expect(page.locator('.create-sentence')).toContainText('Ahmad Ibrahim');
  await page.getByRole('button',{name:/^Repayment: .+\. Change$/}).click();await expect(page.getByRole('dialog').locator(`input[value="${plan}"]`)).toBeChecked();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page).toHaveURL(/\/demo\/agreements\/[a-f0-9-]{36}$/);
  const revised=await (await page.request.get(endpoint)).json();expect(revised.agreement.versions).toHaveLength(2);expect(revised.agreement.versions[0].terms).toEqual(terms);expect(revised.agreement.versions[1].terms).toEqual(terms);
});

test('rejects invalid pasted amounts instead of silently changing their meaning',async({page})=>{
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  await page.getByRole('button',{name:'Choose how much you’re lending'}).click();await page.getByLabel('Principal amount').fill('-1000');await page.getByRole('button',{name:'Next: who',exact:true}).click();await expect(page.getByLabel('Principal amount')).toHaveValue('-1000');await expect(page.getByRole('alert').filter({hasText:'positive amount'})).toBeVisible();
  await page.getByLabel('Principal amount').fill('999999999999.99');await expect(page.getByLabel('Principal amount')).toHaveValue('999,999,999,999.99');
});
