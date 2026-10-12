import {test,expect} from '@playwright/test';

test('shared links carry a branded preview card',async({page})=>{
  for(const path of ['/','/login','/privacy']){
    await page.goto(path);
    const meta=(key:string)=>page.locator(`meta[property="${key}"],meta[name="${key}"]`).first().getAttribute('content');
    expect(await meta('og:image')).toBe('https://usetreeti.xyz/og/treeti-link-preview.png');
    expect(await meta('og:image:width')).toBe('1200');expect(await meta('og:image:height')).toBe('630');
    expect(await meta('og:title')).toContain('treeti');expect(await meta('og:description')).toContain('interest-free');
    expect(await meta('twitter:card')).toBe('summary_large_image');expect(await meta('twitter:image')).toBe('https://usetreeti.xyz/og/treeti-link-preview.png');
  }
  const image=await page.request.get('/og/treeti-link-preview.png');expect(image.status()).toBe(200);expect(image.headers()['content-type']).toBe('image/png');
  const bytes=await image.body();expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.length).toBeLessThan(300_000);
});
