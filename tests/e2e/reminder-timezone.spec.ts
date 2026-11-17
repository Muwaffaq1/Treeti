import {test,expect} from '@playwright/test';
import {addDebt} from './records';
const origin='http://127.0.0.1:3000',yusuf='44444444-4444-4444-8444-444444444444';

// A person in New York at 10:30pm: it is already the next morning in Lagos. A reminder for later
// tonight is on *their* today, so the day sheet must accept it (it used to say "Choose today or a later date").
test.use({timezoneId:'America/New_York'});
test('a reminder for later tonight works when Lagos has already reached tomorrow',async({page})=>{
  const ahead=new Date(Date.now()+3*86400000),y=ahead.getUTCFullYear(),m=ahead.getUTCMonth(),d=ahead.getUTCDate();
  // 22:30 in New York (UTC-5 in winter) is 03:30 UTC on the next calendar day, and 04:30 in Lagos.
  const evening=new Date(Date.UTC(y,m,d+1,3,30)),newYorkDay=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  await page.clock.install({time:evening});
  await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true,userId:yusuf}});
  await page.goto('/demo/debts');
  await addDebt(page,{person:'Maryam Bello',amount:'5000',date:'2026-10-01'});
  await page.getByRole('article').filter({hasText:'Maryam Bello'}).getByRole('button').click();
  await page.getByRole('dialog').getByRole('button',{name:'Add reminder for Maryam Bello'}).click();
  const form=page.getByRole('dialog');
  await page.getByRole('button',{name:/^On .+\. Change$/}).click();
  let sheet=page.getByRole('dialog',{name:'Which day?'});
  await sheet.getByLabel('Reminder date').fill(newYorkDay);await sheet.getByRole('button',{name:'Done',exact:true}).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button',{name:/^At .+\. Change$/}).click();
  sheet=page.getByRole('dialog',{name:'What time?'});
  await sheet.getByLabel('Reminder time').fill('23:15');await sheet.getByRole('button',{name:'Done',exact:true}).click();
  await expect(sheet).toHaveCount(0);
  await form.getByRole('button',{name:'Save reminder',exact:true}).click();await expect(form).toBeHidden();
  await expect(page.getByRole('article').filter({hasText:'Maryam Bello'}).locator('.ledger-reminder')).toBeVisible();
});
