import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:3000';

for(const [plan,width] of [['MONTHLY',375],['WEEKLY',1366],['CUSTOM',375]] as const)test(`creates and reloads ${plan.toLowerCase()} installments at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});if(plan==='CUSTOM')await page.emulateMedia({colorScheme:'dark'});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  const amount=page.getByLabel('Principal amount');await expect(amount).toBeEnabled();await amount.pressSequentially('1000.01');await expect(amount).toHaveValue('1,000.01');
  await amount.press('Home');await amount.press('ArrowRight');await amount.press('9');await expect(amount).toHaveValue('19,000.01');
  await amount.press('Backspace');await expect(amount).toHaveValue('1,000.01');
  await page.getByLabel('Borrower’s full name').fill('Ahmad Ibrahim');await page.getByLabel('Email or phone number').fill('ahmad@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('radiogroup',{name:'Repayment structure'}).locator(`input[value=\"${plan}\"]`).check();
  if(plan==='CUSTOM'){
    await page.getByLabel('Payment 1 date').fill('2027-01-31');await page.getByLabel('Payment 1 amount (NGN)').fill('500');
    await page.getByLabel('Payment 2 date').fill('2027-03-15');await page.getByLabel('Payment 2 amount (NGN)').fill('500');
    await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'add up'})).toBeVisible();
    await page.getByLabel('Payment 2 amount (NGN)').fill('500.01');
  }else{await page.getByLabel('First payment date').fill('2027-01-31');await page.getByLabel('Number of payments').fill('3');}
  await expect(page.getByLabel('Repayment due date')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
  await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/installments-${plan.toLowerCase()}-${width}.png`,fullPage:true,animations:'disabled'});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Review and agree.'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Installment schedule'})).toBeVisible();await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('link',{name:'View the agreement'}).click();
  await expect(page).toHaveURL(/\/demo\/agreements\/[a-f0-9-]{36}$/);await expect(page.getByRole('heading',{name:'The agreed details'})).toBeVisible();
  const endpoint=page.url().replace('/demo/','/api/demo/'),result=await page.request.get(endpoint);expect(result.ok()).toBe(true);const response=await result.json();
  const terms=response.agreement.versions.at(-1).terms;expect(terms.repaymentType).toBe('INSTALLMENTS');expect(terms.installments.frequency).toBe(plan);
  expect(terms.installments.payments.reduce((sum:bigint,p:{amountMinor:string})=>sum+BigInt(p.amountMinor),0n)).toBe(100001n);
  if(plan==='MONTHLY')expect(terms.installments.payments.map((p:{dueDate:string})=>p.dueDate)).toEqual(['2027-01-31','2027-02-28','2027-03-31']);
  const url=page.url();await page.reload();await expect(page.getByRole('region',{name:'Installment schedule'})).toBeVisible();
  await page.goto(`${url}/edit`);await expect(amount).toHaveValue('1,000.01');await expect(page.getByRole('heading',{name:'Who are you lending to?'})).toBeVisible();await expect(page.getByLabel('Email or phone number')).toHaveValue('ahmad@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('radiogroup',{name:'Repayment structure'}).locator(`input[value="${plan}"]`)).toBeChecked();await page.getByLabel('Reason for the new version').fill('Review the repayment plan');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Review and agree.'})).toBeVisible();await page.getByRole('button',{name:'Save new version',exact:true}).click();await expect(page.getByRole('heading',{name:'Your draft is safely kept.'})).toBeVisible();const revised=await (await page.request.get(endpoint)).json();expect(revised.agreement.versions).toHaveLength(2);expect(revised.agreement.versions[0].terms).toEqual(terms);
});

test('rejects invalid pasted amounts instead of silently changing their meaning',async({page})=>{
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  await page.getByLabel('Principal amount').fill('-1000');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByLabel('Principal amount')).toHaveValue('-1000');await expect(page.getByRole('alert').filter({hasText:'positive amount'})).toBeVisible();
  await page.getByLabel('Principal amount').fill('999999999999.99');await expect(page.getByLabel('Principal amount')).toHaveValue('999,999,999,999.99');
});
