import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
for(const [width,timeZone] of [[375,'America/New_York'],[768,'Asia/Tokyo'],[1366,'Europe/London']] as const){
 test(`main navigation, local activity and current guide at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:timeZone,baseURL:'http://127.0.0.1:3000'});const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await context.request.post('/api/demo/session',{headers:{Origin:'http://127.0.0.1:3000'},data:{fresh:true}});await page.goto('/demo');
  await expect(page.getByRole('region',{name:'Money owed to you',exact:true})).toContainText('₦250,000');
  await expect(page.getByRole('region',{name:'Money you owe',exact:true})).toContainText('0 active agreements');
  await page.getByRole('button',{name:'Active',exact:true}).click();await expect(page.locator('.agreement-card')).toHaveCount(1);await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.locator('.agreement-card')).toHaveCount(3);
  await mkdir('output/qa',{recursive:true});await page.screenshot({path:`output/qa/overview-balances-${width}.png`,fullPage:true});
  const nav=page.locator(width<800?'.mobile-nav':'.sidebar nav');await nav.getByRole('link',{name:'My investments',exact:true}).click();await expect(page).toHaveURL(/investments$/);await expect(nav.getByRole('link',{name:'Activity',exact:true})).toHaveCount(0);
  if(width<800){await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('menuitem',{name:'Activity',exact:true}).click();}else await page.locator('.sidebar-bottom').getByRole('link',{name:'Activity',exact:true}).click();
  const {agreements}=await (await context.request.get('/api/demo/agreements')).json();
  const latest=agreements.flatMap((a:{events:{createdAt:string}[]})=>a.events).sort((a:{createdAt:string},b:{createdAt:string})=>b.createdAt.localeCompare(a.createdAt))[0];
  await expect(page.locator('.activity-zone')).toContainText(timeZone.replaceAll('_',' '));
  await expect(page.locator('.activity-event time').first()).toHaveText(new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(latest.createdAt)));
  await expect(page.locator('.activity-day-heading h2').first()).toHaveText(new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(latest.createdAt)));
  await page.goto('/demo/guide');await expect(page.getByRole('heading',{name:'How treeti works',exact:true})).toBeVisible();
  await expect(page.locator('main')).toContainText('They don’t need to create an account');await expect(page.locator('main')).toContainText('My investments');
  await expect(page.locator('.testing-guide')).toHaveCount(0);await expect(page.locator('main')).not.toContainText('before public launch');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('#main').analyze()).violations).toEqual([]);
  await page.screenshot({path:`output/qa/current-guide-${width}.png`,fullPage:true});expect(errors).toEqual([]);await context.close();
 });
}
