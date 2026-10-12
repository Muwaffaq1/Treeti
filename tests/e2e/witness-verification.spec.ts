import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

// Synthetic UI transport: no real invitations, email sends or attestations.
for(const theme of ['light','dark'])for(const width of [375,390,430,1366,1920])test(`short witness verification at ${width}px in ${theme}`,async({page})=>{
  const token='w'.repeat(43);
  await page.setViewportSize({width,height:width<500?844:900});
  await page.addInitScript(theme=>localStorage.setItem('ahd:appearance',theme),theme);
  await page.route(`**/api/invitations/${token}`,route=>route.fulfill({json:{role:'WITNESS',contact:'wi•••@example.test',verificationAvailable:true}}));
  await page.route('**/api/auth/send',async route=>{expect(route.request().postDataJSON()).toEqual({invitationToken:token});await route.fulfill({json:{ok:true,contact:'wi•••@example.test'}});});
  await page.route('**/api/auth/verify',route=>route.fulfill({status:400,json:{code:'OTP_INVALID',message:'This code could not be verified. Check it or request a new code.'}}));
  await page.goto(`/invite/${token}`);
  await expect(page.getByRole('heading',{name:'You’re invited to be a witness.'})).toBeVisible();
  await expect(page.getByLabel('Email or phone number')).toHaveCount(0);
  await expect(page.getByLabel('Your full name')).toHaveCount(0);
  await mkdir('output/qa',{recursive:true});
  await page.screenshot({path:`output/qa/witness-verification-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);
  await page.getByRole('button',{name:'Send verification code',exact:true}).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button',{name:'Verify and read the terms',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'This code could not be verified'})).toContainText('This code could not be verified');
  await page.screenshot({path:`output/qa/witness-verification-error-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Resend code',exact:true}).click();await expect(page.getByRole('status')).toContainText('A new code has been sent');await expect(page.getByLabel('Verification code')).toHaveValue('');
});

test('an older phone invitation explains the unavailable channel without offering verification',async({page})=>{
  const token='p'.repeat(43);let sends=0;
  await page.route(`**/api/invitations/${token}`,route=>route.fulfill({json:{role:'WITNESS',contact:'+234••••678',verificationAvailable:false}}));
  await page.route('**/api/auth/send',route=>{sends++;return route.fulfill({json:{ok:true}});});
  await page.goto(`/invite/${token}`);
  await expect(page.getByText('Phone verification is not available yet. Ask the inviter for an email invitation.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Send verification code'})).toHaveCount(0);
  await expect(page.getByLabel('Your full name')).toHaveCount(0);expect(sends).toBe(0);
});
