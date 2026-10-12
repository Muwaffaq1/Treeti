import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

for(const width of [390,1024])test(`responsive utility menu at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.request.post('/api/demo/session',{headers:{Origin:'http://127.0.0.1:3000'},data:{fresh:true}});
  await page.goto('/demo');await mkdir('output/qa',{recursive:true});
  for(const theme of ['light','dark']){
    const trigger=page.getByRole('button',{name:'Open menu',exact:true});
    await expect(page.locator('.mobile-header button')).toHaveCount(1);
    await trigger.focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem',{name:'Account',exact:true})).toBeVisible();
    await expect(page.getByRole('menuitem',{name:'Install treeti',exact:true})).toBeVisible();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
    await page.screenshot({path:`output/qa/utility-menu-${theme}-${width}.png`,animations:'disabled'});
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    await trigger.click();await page.getByRole('menuitem',{name:'Install treeti',exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Add to Home Screen');
    await dialog.getByRole('button',{name:'Got it',exact:true}).click();await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
    await trigger.click();await page.getByRole('menuitem',{name:`Switch to ${theme==='light'?'dark':'light'} mode`,exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');
  }
  const search=page.getByRole('textbox',{name:'Search agreements',exact:true});await search.focus();await expect(search).toBeFocused();await page.screenshot({path:`output/qa/search-focus-light-${width}.png`,animations:'disabled'});
  await search.fill('Ahmad Ibrahim');await expect(page.locator('.agreement-card h3')).toHaveText(['Ahmad Ibrahim','Ahmad Ibrahim']);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Account',exact:true}).click();await expect(page).toHaveURL('/demo/account');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
