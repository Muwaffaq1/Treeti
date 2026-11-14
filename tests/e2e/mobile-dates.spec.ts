import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {writeAgreement} from './create';
const origin='http://127.0.0.1:3000';
const browserName='webkit';
test.use({browserName,isMobile:true,hasTouch:true});
 for(const width of [375,768])test(`date fields fit nested installment cards at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:'dark'});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo/agreements/new');
  await writeAgreement(page,{amount:'888888858',purpose:'Remember this purpose',dueDate:'2027-12-31'});
  await page.getByRole('button',{name:/^Repayment:/}).click();
  for(const plan of ['SINGLE','MONTHLY','CUSTOM']){
   await page.getByRole('radiogroup',{name:'Repayment structure'}).locator(`input[value="${plan}"]`).check();
   if(plan==='CUSTOM')await page.getByLabel('Payment 1 date').fill('2027-01-31');
   const bounds=await page.locator('.kit-panel .create-field input').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect(),p=e.closest('.create-field')!.getBoundingClientRect();return r.width<=p.width+1&&r.right<=p.right+1;}));expect(bounds.every(Boolean)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  await page.evaluate(async()=>{await document.fonts.ready;});await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/date-fields-${browserName}-${width}.png`,fullPage:true});
 });
