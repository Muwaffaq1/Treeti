import {expect,type Locator,type Page} from '@playwright/test';
// Private debts and investments are added as a sentence with blanks; each blank opens its own panel.
type Debt={person:string;amount:string;currency?:string;date?:string;note?:string;witnesses?:string[];plan?:(panel:Locator)=>Promise<void>};
type Investment={name:string;amount:string;currency?:string;date?:string;note?:string;partners?:[string,string][]};
const panel=(page:Page,title:string)=>page.getByRole('dialog',{name:title,exact:true});
const done=async(p:Locator)=>{await p.getByRole('button',{name:'Done',exact:true}).click();await expect(p).toHaveCount(0);};

/** "I owe [how much] to [who] since [when]. I’ll repay [how]." then save. */
export async function addDebt(page:Page,d:Debt){
  await page.getByRole('button',{name:'Add a debt',exact:true}).first().click();
  await page.getByRole('button',{name:'Choose how much you owe',exact:true}).click();
  let p=panel(page,'How much do you owe?');if(d.currency)await p.getByLabel('Currency',{exact:true}).selectOption(d.currency);
  await p.getByLabel('Original amount',{exact:true}).fill(d.amount);await p.getByRole('button',{name:'Next: who',exact:true}).click();
  p=panel(page,'Who do you owe?');await p.getByRole('textbox',{name:'Who do you owe?'}).fill(d.person);await done(p);
  if(d.date){await page.getByRole('button',{name:/^Since .+\. Change$/}).click();p=panel(page,'Since when?');await p.getByLabel('Debt date').fill(d.date);await done(p);}
  if(d.plan){await page.getByRole('button',{name:/^Repayment: .+\. Change$/}).click();p=panel(page,'How will you repay?');await d.plan(p);await done(p);}
  for(const w of d.witnesses??[]){await page.getByRole('button',{name:/^\+ Add (witnesses \(optional\)|another witness)$/}).click();p=panel(page,'Who witnessed it?');await p.getByRole('textbox',{name:'Witness’s full name'}).fill(w);await p.getByRole('button',{name:'Add witness',exact:true}).click();await expect(p).toHaveCount(0);}
  if(d.note){await page.getByRole('button',{name:'+ Add a note (optional)',exact:true}).click();p=panel(page,'Add a note');await p.getByLabel('Note (optional)').fill(d.note);await done(p);}
  await expect(page.getByRole('heading',{name:'Read it back',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save private debt',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** "I put [how much] into [what] on [when]." then save. */
export async function addInvestment(page:Page,d:Investment){
  await page.getByRole('button',{name:'Add an investment',exact:true}).first().click();
  await page.getByRole('button',{name:'Choose how much you put in',exact:true}).click();
  let p=panel(page,'How much did you put in?');if(d.currency)await p.getByLabel('Currency',{exact:true}).selectOption(d.currency);
  await p.getByLabel(`Amount invested (${d.currency??'NGN'})`).fill(d.amount);await p.getByRole('button',{name:'Next: what',exact:true}).click();
  p=panel(page,'What did you invest in?');await p.getByLabel('Investment name or place').fill(d.name);await done(p);
  if(d.date){await page.getByRole('button',{name:/^On .+\. Change$/}).click();p=panel(page,'When did you put it in?');await p.getByLabel('Investment date').fill(d.date);await done(p);}
  if(d.partners?.length){await page.getByRole('button',{name:'+ Shared with someone? Add them',exact:true}).click();p=panel(page,'Who’s in it with you?');await fillPartners(p,d.partners);await done(p);}
  if(d.note){await page.getByRole('button',{name:'+ Add a note (optional)',exact:true}).click();p=panel(page,'Add a note');await p.getByLabel('Note (optional)').fill(d.note);await done(p);}
  await expect(page.getByRole('heading',{name:'Read it back',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save investment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Fills the "Who’s in it with you?" panel, adding rows as needed. */
export async function fillPartners(p:Locator,partners:[string,string][]){
  for(const [i,[name,share]] of partners.entries()){
    if(i>0)await p.getByRole('button',{name:'+ Add another person',exact:true}).click();
    await p.getByRole('textbox',{name:`Person ${i+1}’s full name`}).fill(name);await p.getByRole('textbox',{name:`Person ${i+1}’s share, in percent`}).fill(share);
  }
}

/** From a debt's card: "I paid [how much] to [person] on [when]." Returns the amount panel, left open, so a test can check its messages. */
export async function startPayment(page:Page,person:string,amount:string,currency='NGN'){
  await page.getByRole('article').filter({hasText:person}).first().getByRole('button').click();
  await page.getByRole('dialog').getByRole('button',{name:`Record a payment to ${person}`}).click();
  await page.getByRole('button',{name:'Choose how much you paid',exact:true}).click();
  const p=panel(page,'How much did you pay?');await p.getByLabel(`Amount paid (${currency})`).fill(amount);await p.getByRole('button',{name:'Done',exact:true}).click();return p;
}
export async function savePayment(page:Page){await page.getByRole('button',{name:'Save payment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
export async function payDebt(page:Page,person:string,amount:string,currency='NGN'){const p=await startPayment(page,person,amount,currency);await expect(p).toHaveCount(0);await savePayment(page);}

/** Opens the "Change your record" sentence for a debt. */
export async function editDebt(page:Page,person:string){
  await page.getByRole('article').filter({hasText:person}).first().getByRole('button').click();
  await page.getByRole('dialog').getByRole('button',{name:`Edit debt for ${person}`}).click();
  await expect(page.getByRole('heading',{name:'Change your record',exact:true})).toBeVisible();
}
/** Opens one blank's panel by the start of its accessible name, e.g. "Amount:", "Person:", "Repayment:". */
export async function openBlank(page:Page,label:string,title:string){await page.getByRole('button',{name:new RegExp(`^${label}`)}).click();return panel(page,title);}

/** "I added [how much] to [investment] on [when]." from the investment's detail; pass `edit` to correct a contribution instead. */
export async function addContribution(page:Page,investment:string,amount:string,{currency='NGN',date,edit}:{currency?:string;date?:string;edit?:RegExp}={}){
  await page.getByRole('article',{name:investment,exact:true}).getByRole('button').click();
  await page.getByRole('dialog').getByRole('button',edit?{name:edit}:{name:'Record contribution',exact:true}).click();
  await page.getByRole('button',{name:edit?/^Amount: /:/^Choose how much you added$/}).click();
  let p=panel(page,'How much did you add?');await expect(p.getByLabel('Currency',{exact:true})).toHaveCount(0);await p.getByLabel(`Amount invested (${currency})`).fill(amount);await done(p);
  if(date){await page.getByRole('button',{name:/^On .+\. Change$/}).click();p=panel(page,'When did you add it?');await p.getByLabel('Investment date').fill(date);await done(p);}
  await page.getByRole('button',{name:edit?'Save changes':'Save contribution',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
