import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:3000';
const browserName='webkit';
test.use({browserName,isMobile:true,hasTouch:true});
 for(const width of [375,768])test(`date fields fit nested installment cards at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:'dark'});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  await page.getByLabel('Principal amount').fill('888888858');
  await page.getByLabel('Borrower’s full name').fill('Ahmad Ibrahim');await page.getByLabel('Email or phone number').fill('ahmad@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();
  const summary=page.locator('.more-options summary');await expect(summary.locator('svg')).toHaveCount(1);expect(await summary.evaluate(e=>getComputedStyle(e).listStyleType)).toBe('none');expect(await summary.evaluate(e=>getComputedStyle(e,'::marker').content)).toBe('""');
  await summary.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Purpose (optional)')).toBeVisible();await page.getByLabel('Purpose (optional)').fill('Remember this purpose');await summary.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Purpose (optional)')).toBeHidden();await summary.click();await expect(page.getByLabel('Purpose (optional)')).toHaveValue('Remember this purpose');await summary.click();
  for(const plan of ['SINGLE','MONTHLY','CUSTOM']){
   await page.getByLabel('Repayment structure').selectOption(plan);
   if(plan==='CUSTOM')await page.getByLabel('Payment 1 date').fill('2027-01-31');
   const bounds=await page.locator('.creation-form input,.creation-form select,.creation-form textarea').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect(),p=e.closest('.field-control')!.getBoundingClientRect();return r.width<=p.width+1&&r.right<=p.right+1;}));expect(bounds.every(Boolean)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  await page.evaluate(async()=>{await document.fonts.ready;});await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/date-fields-${browserName}-${width}.png`,fullPage:true});
 });
