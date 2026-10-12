import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
const origin='http://127.0.0.1:3000';
async function changeTheme(page:import('@playwright/test').Page,name:string){
  const menu=page.getByRole('button',{name:'Open menu',exact:true});
  if(await menu.isVisible()){await menu.click();await page.getByRole('menuitem',{name,exact:true}).click();}
  else await page.getByRole('button',{name,exact:true}).click();
}
async function accessible(page:import('@playwright/test').Page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);}
for(const width of [375,390,430,1366,1920])test(`dark appearance and profile menu at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:'light'});await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo');await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await changeTheme(page,'Switch to dark mode');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await mkdir('output/qa',{recursive:true});
  for(const path of ['', '/activity','/debts','/agreements/new','/guide']){
    await page.goto(`/demo${path}`);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await accessible(page);await page.screenshot({path:`output/qa/dark-${path.replaceAll('/','-')||'overview'}-${width}.png`,animations:'disabled'});
  }
  await page.goto('/demo');await page.getByRole('combobox',{name:'View demonstration as'}).click();await expect(page.getByRole('option',{name:'Abdullah Musa',exact:true})).toBeVisible();await accessible(page);await page.screenshot({path:`output/qa/profile-menu-dark-${width}.png`,animations:'disabled'});await page.keyboard.press('Escape');await expect(page.getByRole('combobox',{name:'View demonstration as'})).toBeFocused();
  await changeTheme(page,'Switch to light mode');await page.getByRole('combobox',{name:'View demonstration as'}).click();await page.screenshot({path:`output/qa/profile-menu-light-${width}.png`,animations:'disabled'});const loaded=page.waitForEvent('load');await page.getByRole('option',{name:'Ahmad Ibrahim',exact:true}).click();await loaded;await expect(page.getByRole('heading',{name:/As-salamu.*Ahmad/})).toBeVisible();
});
test('device appearance responds to OS changes and explicit preference wins',async({page,context})=>{
  await page.emulateMedia({colorScheme:'dark'});await page.request.post('/api/demo/session',{headers:{Origin:origin},data:{fresh:true}});await page.goto('/demo');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await changeTheme(page,'Switch to dark mode');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const other=await context.newPage();await other.goto('/demo');await expect(other.locator('html')).toHaveAttribute('data-theme','dark');await changeTheme(other,'Switch to light mode');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await other.close();
  await page.goto('/demo/account');await page.getByRole('button',{name:'Device',exact:true}).click();await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
