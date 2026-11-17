import {test,expect} from '@playwright/test';
import {writeAgreement,signAndSend} from './create';
const origin='http://127.0.0.1:3000',yusuf='44444444-4444-4444-8444-444444444444';

test('changing a sent agreement uses the sentence, then signs and sends the new version',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true,userId:yusuf}});
  await page.goto('/demo/agreements/new');
  await writeAgreement(page,{amount:'20000',name:'Karima Bello',contact:'karima@example.test'});
  await signAndSend(page);
  const link=page.locator('a[href*="/demo/agreements/"]').filter({hasText:/^Done$/});await link.click();
  await expect(page).toHaveURL(/\/demo\/agreements\/[a-f0-9-]{36}$/);const url=page.url();

  await page.goto(`${url}/edit`);
  await expect(page.getByRole('heading',{name:'Change the terms'})).toBeVisible();
  const sentence=page.locator('.create-sentence');await expect(sentence).toContainText('₦20,000');await expect(sentence).toContainText('Karima Bello');
  // The borrower is fixed in a new version, and a sent agreement can't be quietly saved without sending.
  await expect(page.getByRole('button',{name:'Save changes'})).toHaveCount(0);
  await page.getByRole('button',{name:/^Amount: .+\. Change$/}).click();
  const p=page.getByRole('dialog');await p.getByLabel('Principal amount').fill('25000');await p.getByRole('button',{name:/^(Done|Next: who)$/}).click();
  await expect(p).toHaveCount(0);await expect(sentence).toContainText('₦25,000');

  await page.getByRole('button',{name:'Review and sign',exact:true}).click();
  await page.getByRole('checkbox',{name:/I confirm this loan is interest-free/}).check();
  await page.getByLabel(/What changed\?/).fill('Raised the amount to ₦25,000');
  await page.getByRole('button',{name:'Continue to sign',exact:true}).click();
  await page.getByRole('button',{name:'Hold to sign'}).hover();await page.mouse.down();await page.waitForTimeout(2000);await page.mouse.up();
  await expect(page.getByRole('heading',{name:'Send it to everyone',exact:true})).toBeVisible({timeout:30000});

  const saved=(await (await page.request.get(url.replace('/demo/','/api/demo/'))).json()).agreement;
  expect(saved.versions).toHaveLength(2);expect(saved.versions[1].terms.principalMinor).toBe('2500000');expect(saved.status).toBe('AWAITING_BORROWER');
});
