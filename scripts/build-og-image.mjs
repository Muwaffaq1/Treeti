// Renders the link preview card shown when usetreeti.xyz is shared (Open Graph / X card).
// Run after changing the brand or tagline: node scripts/build-og-image.mjs
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const font = file => pathToFileURL(fileURLToPath(new URL(`node_modules/@fontsource/${file}`, root))).href;
const symbol = (await readFile(new URL('public/icons/treeti.svg', root), 'utf8')).replace(/<title[^>]*>.*?<\/title>/, '').replace(' role="img" aria-labelledby="title"', '');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Geist;font-weight:500;src:url(${font('geist/files/geist-latin-500-normal.woff2')})}
@font-face{font-family:Geist;font-weight:700;src:url(${font('geist/files/geist-latin-700-normal.woff2')})}
@font-face{font-family:Lora;font-weight:500;src:url(${font('lora/files/lora-latin-500-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f3ede2;color:#202020;font-family:Geist,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.lock{display:flex;align-items:center;gap:18px}.lock svg{width:76px;height:76px}
.word{font-family:Lora,serif;font-weight:500;font-size:92px;letter-spacing:-.07em;line-height:1}.word b{font-weight:500;color:#7135c5}
h1{font-size:78px;font-weight:700;letter-spacing:-.045em;line-height:1.08;margin-top:44px}
p{font-size:29px;font-weight:500;color:#616161;margin-top:30px;letter-spacing:-.01em}
</style></head><body>
<div class="lock">${symbol}<div class="word">treeti<b>.</b></div></div>
<h1>Put it in writing.<br>Keep the trust.</h1>
<p>A private record for interest-free agreements between people.</p>
</body></html>`;

await mkdir(new URL('public/og/', root), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL('public/og/treeti-link-preview.png', root)) });
await browser.close();
console.log('Wrote public/og/treeti-link-preview.png');
