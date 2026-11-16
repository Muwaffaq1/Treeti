import {test,expect,type Page,type Locator} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Investment agreements: written as one sentence, signed by every partner, witnessed, then each partner gets the record.
// Acts as Yusuf, Aisha and Maryam so Abdullah's shared command limit stays free for other specs.
const origin='http://127.0.0.1:3000';
const yusuf='44444444-4444-4444-8444-444444444444',aisha='55555555-5555-4555-8555-555555555555',maryam='33333333-3333-4333-8333-333333333333';
const as=(page:Page,userId:string)=>page.request.post('/api/demo/session',{headers:{Origin:origin},data:{userId}});
const panel=(page:Page,title:string)=>page.getByRole('dialog',{name:title,exact:true});
async function hold(page:Page){await page.getByRole('button',{name:'Hold to sign'}).hover();await page.mouse.down();await page.waitForTimeout(2000);await page.mouse.up();}
async function promiseAndSign(page:Page){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continue to sign',exact:true}).click();await hold(page);}
const noOverflow=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const axe=async(page:Page,include='#main')=>expect((await new AxeBuilder({page}).include(include).analyze()).violations).toEqual([]);
async function submit(p:Locator,name:RegExp|string){await p.getByRole('button',{name}).click();}

for(const width of [320,1366])test(`partners write, sign and witness an investment agreement at ${width}px`,async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width,height:900});
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await as(page,yusuf);
 await page.goto('/demo/investments');
 await page.getByRole('link',{name:'Investing with someone? Write an agreement you all sign'}).click();
 await expect(page.getByRole('heading',{name:'Write it down'})).toBeVisible();

 await page.getByRole('button',{name:'Say what you’re investing in'}).click();
 let p=panel(page,'What are you investing in?');await p.getByLabel('Investment').fill('Sister’s shop in Kano');await submit(p,'Next: who');
 p=panel(page,'Who are you investing with?');await p.getByLabel('Partner’s full name').fill('Aisha Suleiman');await p.getByLabel('Partner’s email or phone number').fill('aisha@example.test');await submit(p,'Add and continue');
 p=panel(page,'How much does each person put in?');await p.getByLabel('Amount you put in (NGN)').fill('200000');await p.getByLabel('Amount Aisha Suleiman puts in (NGN)').fill('100000');await submit(p,'Next: profit');
 p=panel(page,'How is profit split?');await p.getByLabel('Your profit share, in percent').fill('50');await p.getByLabel('Aisha Suleiman’s profit share, in percent').fill('40');
 await expect(p).toContainText('10% left to share.');await submit(p,'Next: start date');await expect(p.getByRole('alert')).toContainText('They add up to 90% now');
 await p.getByRole('button',{name:'Split profit by money put in'}).click();await expect(p).toContainText('Adds up to 100%.');await expect(p).toContainText('Loss 66.7%');
 await p.getByLabel('Your profit share, in percent').fill('60');await p.getByLabel('Aisha Suleiman’s profit share, in percent').fill('40');await submit(p,'Next: start date');
 p=panel(page,'When does it start?');await submit(p,'Done');
 await expect(page.getByRole('heading',{name:'Read it back'})).toBeVisible();
 await page.getByRole('button',{name:'+ Add witnesses (optional)'}).click();
 p=panel(page,'Who will witness it?');await p.getByLabel('Witness’s full name').fill('Maryam Bello');await p.getByLabel('Witness’s email or phone number').fill('maryam@example.test');await submit(p,'Add witness');
 await expect(page.locator('.create-sentence')).toContainText('Profit is split 60% me · 40% Aisha.');await expect(page.locator('.create-sentence')).toContainText('Witnessed by Maryam Bello.');
 await noOverflow(page);
 await page.getByRole('button',{name:'Review and sign'}).click();await promiseAndSign(page);
 await expect(page.getByRole('heading',{name:'Send it to everyone'})).toBeVisible();
 const aishaLink=await page.getByRole('button',{name:'Share link with Aisha Suleiman'}).getAttribute('data-invite-url');
 const maryamLink=await page.getByRole('button',{name:'Share link with Maryam Bello'}).getAttribute('data-invite-url');
 await page.getByRole('link',{name:'Done',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Waiting for Aisha to sign.'})).toBeVisible();await noOverflow(page);await axe(page);

 // Aisha opens her own link, reads it and signs.
 await as(page,aisha);await page.goto(aishaLink!);
 await expect(page.getByRole('heading',{name:'Yusuf Ali asked you to sign an investment agreement'})).toBeVisible();await axe(page);
 await page.getByRole('button',{name:'Open the agreement'}).click();
 await expect(page.getByText('Puts in ₦100,000 · profit 40% · loss 33.3%')).toBeVisible();
 await page.getByRole('button',{name:'Read and sign'}).click();await promiseAndSign(page);
 await expect(page.getByRole('status').filter({hasText:'Every partner has signed. Waiting for Maryam to witness it.'})).toBeVisible();

 // Someone else can't use Maryam's link; Maryam can, and witnessing makes it final.
 await page.goto(maryamLink!);await page.getByRole('button',{name:'Open the agreement'}).click();
 await expect(page.locator('.error-message')).toContainText('Sign in with the email or phone number this invitation was sent to.');
 await as(page,maryam);await page.goto(maryamLink!);
 await expect(page.getByRole('heading',{name:'Yusuf Ali asked you to witness an investment agreement'})).toBeVisible();
 await page.getByRole('button',{name:'Open the agreement'}).click();
 await page.getByRole('button',{name:'Read and witness'}).click();await promiseAndSign(page);
 await expect(page.getByRole('status').filter({hasText:/Signed by everyone on/})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download the signed PDF'}).click();
 expect((await download).suggestedFilename()).toMatch(/^INV-[0-9A-F]{8}-investment-agreement\.pdf$/);
 await expect(page.getByRole('link',{name:'See it in your investments'})).toHaveCount(1);

 // Each partner now has the shared investment in their own records, linked to the agreement.
 await as(page,aisha);await page.goto('/demo/investments');
 const card=page.getByRole('article',{name:'Sister’s shop in Kano'});await expect(card).toContainText('With Yusuf · your share 40%');await expect(card).toContainText('₦100,000');
 await card.getByRole('button').click();await expect(page.getByRole('dialog')).toContainText(/From the signed agreement INV-/);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:/Investment agreements · 1/})).toBeVisible();await noOverflow(page);await axe(page);
 await as(page,maryam);await page.goto('/demo/investments');await expect(page.getByRole('article',{name:'Sister’s shop in Kano'})).toHaveCount(0);
});

test('a change request comes back to the writer, and everyone signs the new version',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:900});
 await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await as(page,yusuf);
 const created=await page.request.post('/api/demo/joint',{headers:{Origin:origin,'Idempotency-Key':crypto.randomUUID()},data:{terms:{venture:'Rice farm',currency:'NGN',startDate:'2026-11-15'},me:{capitalMinor:'10000000',profitShare:50},partners:[{name:'Aisha Suleiman',contact:'aisha@example.test',capitalMinor:'10000000',profitShare:50}],signature:'Yusuf Ali',affirmed:true}});
 expect(created.status()).toBe(201);const {agreement,links}=await created.json();
 await as(page,aisha);await page.goto(links[0].url);await page.getByRole('button',{name:'Open the agreement'}).click();
 await page.getByRole('button',{name:'Ask for a change'}).click();
 const p=panel(page,'What would you like changed?');await p.getByLabel('What you’d like changed').fill('Can we review it in June?');await p.getByRole('button',{name:'Send request'}).click();
 await expect(page.getByRole('status').filter({hasText:'Aisha Suleiman asked for a change: “Can we review it in June?”'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Read and sign'})).toHaveCount(0);

 await as(page,yusuf);await page.goto('/demo');
 await expect(page.locator('.brief')).toContainText('Aisha asked for a change to your investment in Rice farm.');
 await page.goto(`/demo/investments/agreements/${agreement.id}`);await page.getByRole('link',{name:'Change the terms'}).click();
 await page.getByRole('button',{name:'+ Add a review date'}).click();
 const review=panel(page,'When will you review it?');await review.getByLabel('Review date (optional)').fill('2027-06-01');await review.getByRole('button',{name:'Done'}).click();
 await page.getByRole('button',{name:'Review and sign'}).click();await promiseAndSign(page);
 await expect(page.getByText('INV-').first()).toBeVisible();await expect(page.locator('.joint-wording')).toContainText('The partners will review the investment on 1 June 2027.');
 await expect(page.getByRole('status').filter({hasText:'Waiting for Aisha to sign.'})).toBeVisible();

 await as(page,aisha);await page.goto('/demo');
 await expect(page.locator('.brief')).toContainText('Yusuf asked you to sign an investment in Rice farm.');
 await page.goto(`/demo/investments/agreements/${agreement.id}`);await page.getByRole('button',{name:'Read and sign'}).click();await promiseAndSign(page);
 await expect(page.getByRole('status').filter({hasText:/Signed by everyone on/})).toBeVisible();
});
