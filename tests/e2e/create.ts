import {expect,type Page} from '@playwright/test';
type Plan={plan?:'SINGLE'|'WEEKLY'|'MONTHLY'|'CUSTOM';dueDate?:string;firstDate?:string;parts?:string;custom?:[string,string][]};
export type Draft={amount:string;currency?:string;name?:string;contact?:string;purpose?:string;witnesses?:[string,string][];note?:string}&Plan;
const panel=(page:Page)=>page.getByRole('dialog');

/** The amount panel: opens it from the "how much" blank and fills it. */
export async function fillAmount(page:Page,amount:string,currency?:string){
  await page.getByRole('button',{name:/^Choose how much you’re lending$|^Amount:/}).click();
  if(currency)await panel(page).getByLabel('Currency',{exact:true}).selectOption(currency);
  await panel(page).getByLabel('Principal amount').fill(amount);
}
/** The repayment panel. */
export async function fillPlan(page:Page,{plan='SINGLE',dueDate='2027-12-31',firstDate='2027-01-31',parts='3',custom}:Plan){
  const p=panel(page);await p.getByRole('radiogroup',{name:'Repayment structure'}).locator(`input[value="${plan}"]`).check();
  if(plan==='SINGLE')await p.getByLabel('Repay by').fill(dueDate);
  else if(plan==='CUSTOM'){for(const [i,[date,amount]] of (custom??[]).entries()){await p.getByLabel(`Payment ${i+1} date`).fill(date);await p.getByLabel(new RegExp(`^Payment ${i+1} amount`)).fill(amount);}}
  else{await p.getByLabel('Parts',{exact:true}).fill(parts);await p.getByLabel('First part',{exact:true}).fill(firstDate);}
}
/** Fills every blank of a new agreement, ending on "Read it back". */
export async function writeAgreement(page:Page,d:Draft){
  await fillAmount(page,d.amount,d.currency);await panel(page).getByRole('button',{name:'Next: who',exact:true}).click();
  await panel(page).getByRole('textbox',{name:'Borrower’s full name'}).fill(d.name??'Ahmad Ibrahim');await panel(page).getByRole('textbox',{name:/^Email or phone number$|^Email address$/}).fill(d.contact??'ahmad@example.test');
  await panel(page).getByRole('button',{name:'Next: what it’s for',exact:true}).click();
  if(d.purpose){await panel(page).getByLabel('Purpose (optional)').fill(d.purpose);await panel(page).getByRole('button',{name:'Next: how they repay',exact:true}).click();}
  else await panel(page).getByRole('button',{name:'Leave it out',exact:true}).click();
  await fillPlan(page,d);await panel(page).getByRole('button',{name:'Done',exact:true}).click();await expect(panel(page)).toHaveCount(0);
  for(const [name,contact] of d.witnesses??[]){await page.getByRole('button',{name:/^\+ Add (witnesses \(optional\)|another witness)$/}).click();await panel(page).getByRole('textbox',{name:'Witness’s full name'}).fill(name);await panel(page).getByRole('textbox',{name:/^Witness’s email/}).fill(contact);await panel(page).getByRole('button',{name:'Add witness',exact:true}).click();}
  if(d.note){await page.getByRole('button',{name:'+ Anything else? Add a note',exact:true}).click();await panel(page).getByLabel('Additional agreed terms (optional)').fill(d.note);await panel(page).getByRole('button',{name:'Done',exact:true}).click();}
  await expect(page.getByRole('heading',{name:'Read it back',exact:true})).toBeVisible();
}
/** Promise, hold to sign, then the share screen. */
export async function signAndSend(page:Page){
  await page.getByRole('button',{name:'Review and sign',exact:true}).click();
  await page.getByRole('checkbox',{name:/I confirm this loan is interest-free/}).check();await page.getByRole('button',{name:'Continue to sign',exact:true}).click();
  await page.getByRole('button',{name:'Hold to sign'}).hover();await page.mouse.down();await page.waitForTimeout(2000);await page.mouse.up();
  await expect(page.getByRole('heading',{name:'Send it to everyone',exact:true})).toBeVisible({timeout:30000});
}
/** The borrower's private invitation link from the share screen. */
export async function borrowerLink(page:Page){return (await page.locator('[data-invite-url]').getAttribute('data-invite-url'))!;}
