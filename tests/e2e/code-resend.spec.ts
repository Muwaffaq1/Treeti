import {test,expect} from '@playwright/test';

// All email/authentication responses are intercepted; no real email is sent.
for(const next of ['/app',`/invite/${'b'.repeat(43)}`])test(`an expired sign-in code can be resent directly while retaining ${next}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});let sends=0,verifies=0;
 await page.route('**/api/auth/send',async route=>{expect(route.request().postDataJSON()).toEqual({contact:'borrower@example.test',next});sends++;await route.fulfill({json:{ok:true,contact:'bo•••@example.test'}});});
 await page.route('**/api/auth/verify',async route=>{verifies++;await route.fulfill({status:410,json:{code:'OTP_EXPIRED',message:'This code has expired. Select Resend code to get a new one.'}});});
 await page.goto(`/login?next=${encodeURIComponent(next)}`);await page.getByLabel('Email address').fill('borrower@example.test');await page.getByRole('button',{name:'Send verification code',exact:true}).click();
 await expect(page.getByRole('button',{name:'Resend code',exact:true})).toBeVisible();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await expect(page.locator('.error-message[role="alert"]')).toContainText('has expired');
 await page.getByRole('button',{name:'Resend code',exact:true}).click();await expect(page.getByRole('status')).toContainText('A new code has been sent');expect(sends).toBe(2);expect(verifies).toBe(1);await expect(page.getByLabel('Verification code')).toHaveValue('');await expect(page.getByLabel('Verification code')).toBeFocused();await expect(page.locator('.error-message[role="alert"]')).toHaveCount(0);await expect(page.getByLabel('Email address')).toHaveCount(0);
 await page.getByLabel('Verification code').fill('654321');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await expect.poll(()=>verifies).toBe(2);
 await page.getByRole('button',{name:'Change email',exact:true}).click();await expect(page.getByLabel('Email address')).toHaveValue('borrower@example.test');await expect(page.getByRole('status')).toHaveCount(0);await expect(page.locator('.error-message[role="alert"]')).toHaveCount(0);
});

test('a witness can resend an expired code without reopening their invitation',async({page})=>{
 const token='w'.repeat(43);let sends=0;
 await page.route(`**/api/invitations/${token}`,route=>route.fulfill({json:{role:'WITNESS',contact:'wi•••@example.test',verificationAvailable:true}}));
 await page.route('**/api/auth/send',async route=>{expect(route.request().postDataJSON()).toEqual({invitationToken:token});sends++;await route.fulfill({json:{ok:true,contact:'wi•••@example.test'}});});
 await page.route('**/api/auth/verify',route=>route.fulfill({status:410,json:{code:'OTP_EXPIRED',message:'This code has expired. Select Resend code to get a new one.'}}));
 await page.goto(`/invite/${token}`);await page.getByRole('button',{name:'Send verification code',exact:true}).click();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Verify and read the terms',exact:true}).click();await expect(page.locator('.error-message[role="alert"]')).toContainText('has expired');
 await page.getByRole('button',{name:'Resend code',exact:true}).click();await expect.poll(()=>sends).toBe(2);await expect(page.getByRole('status')).toContainText('A new code has been sent');await expect(page.getByLabel('Verification code')).toHaveValue('');await expect(page.getByLabel('Verification code')).toBeFocused();await expect(page.locator('.error-message[role="alert"]')).toHaveCount(0);await expect(page).toHaveURL(new RegExp(`/invite/${token}$`));
});

test('failed or rate-limited resends leave the code form available for retry',async({page})=>{
 let sends=0;
 await page.route('**/api/auth/send',async route=>{sends++;await route.fulfill(sends===2?{status:429,json:{code:'RATE_LIMITED',message:'Please wait a few minutes before trying again.'}}:{json:{ok:true,contact:'bo•••@example.test'}});});
 await page.goto('/login');await page.getByLabel('Email address').fill('borrower@example.test');await page.getByRole('button',{name:'Send verification code',exact:true}).click();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Resend code',exact:true}).click();await expect(page.locator('.error-message[role="alert"]')).toContainText('Please wait');await expect(page.getByLabel('Verification code')).toHaveValue('123456');await expect(page.getByRole('status')).toHaveCount(0);
 await page.getByRole('button',{name:'Resend code',exact:true}).click();await expect(page.getByRole('status')).toContainText('A new code has been sent');expect(sends).toBe(3);await expect(page.getByLabel('Verification code')).toHaveValue('');
});
