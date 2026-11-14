import {expect,type Page} from '@playwright/test';
/** Opens the sign flow from an agreement page and signs it: read, promise, hold to sign. */
export async function openSignFlow(page:Page){await page.getByRole('button',{name:'Review and approve',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Continue',exact:true}).click();return dialog;}
export async function holdToSign(page:Page){
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Continue to sign',exact:true}).click();
  await dialog.getByRole('button',{name:'Hold to sign'}).hover();await page.mouse.down();await page.waitForTimeout(2000);await page.mouse.up();
  await expect(dialog.getByRole('heading',{name:'You’ve signed'})).toBeVisible({timeout:30000});
  await dialog.getByRole('button',{name:'View the agreement',exact:true}).click();await expect(dialog).toHaveCount(0);
}
export async function signAgreement(page:Page){const dialog=await openSignFlow(page);await dialog.getByRole('checkbox').check();await holdToSign(page);}
