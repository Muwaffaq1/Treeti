import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

const pages=[['/privacy','Privacy policy','Who can see your information'],['/terms','Terms of use','What treeti does not promise'],['/support','Help and support','Contact us']] as const;
for(const width of [375,1366])test(`privacy, terms and support are public and readable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await mkdir('output/qa',{recursive:true});
  for(const [path,title,section] of pages)for(const theme of ['light','dark'] as const){
    await page.emulateMedia({colorScheme:theme});const response=await page.goto(path);expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading',{level:1,name:title,exact:true})).toBeVisible();await expect(page.getByRole('heading',{level:2,name:section,exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'yusufmuwaffaq17@gmail.com'}).first()).toHaveAttribute('href',/^mailto:yusufmuwaffaq17@gmail\.com\?subject=/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.evaluate(()=>document.fonts.ready.then(()=>undefined));await page.screenshot({path:`output/qa/legal${path.replace('/','-')}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await page.goto('/');await expect(page.getByRole('contentinfo').getByRole('link',{name:'Privacy',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.goto('/login');await expect(page.getByText(/By continuing you agree to the/)).toBeVisible();await page.goto('/support');
  const links=page.getByRole('navigation',{name:'Policies and support'});
  await links.getByRole('link',{name:'Terms',exact:true}).click();await expect(page).toHaveURL(/\/terms$/);
  await page.getByRole('link',{name:'privacy policy',exact:true}).click();await expect(page).toHaveURL(/\/privacy$/);
});

test('the home page and the account page link to the policies',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.request.post('/api/demo/session',{headers:{Origin:'http://127.0.0.1:3000'},data:{fresh:true}});
  await page.goto('/demo/account');
  const account=page.getByRole('navigation',{name:'Policies and support'});
  for(const name of ['Privacy','Terms','Support'])await expect(account.getByRole('link',{name,exact:true})).toBeVisible();
  await account.getByRole('link',{name:'Support',exact:true}).click();await expect(page.getByRole('heading',{level:1,name:'Help and support'})).toBeVisible();
  await expect(page.getByText('Resend invitation',{exact:true})).toBeVisible();
});
