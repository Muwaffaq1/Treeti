import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import './build-runtime-probe.mjs';

const children = [];
function start(config, port) {
  const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--config', config, '--port', String(port), '--ip', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  children.push(child);
  // Suppress Wrangler binding logs, which could include environment values.
  child.stdout.resume(); child.stderr.resume();
  return child;
}
const app = 'http://127.0.0.1:8791', probe = 'http://127.0.0.1:8792';
async function get(url, options = {}) { return fetch(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'manual' }); }
async function ready(child, url) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error('Local Workers runtime did not start. Run the preview directly for diagnostics.');
    try { const response = await get(url); await response.arrayBuffer(); if (response.status < 500) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the local Workers runtime.');
}
let browser;
try {
  await Promise.all([ready(start('tests/cloudflare/wrangler.app-test.jsonc', 8791), `${app}/login`), ready(start('tests/cloudflare/wrangler.probe.jsonc', 8792), probe)]);
  for (const path of ['/', '/login', '/guide', '/manifest.webmanifest']) {
    const response = await get(app + path); assert.equal(response.status, 200, path);
    if (path !== '/manifest.webmanifest') assert.ok(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    if (path === '/' || path === '/login') assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/, path);
    await response.arrayBuffer();
  }
  // Ready-made public pages are served as static files; they must keep the same headers as rendered pages.
  for (const [path, text] of [['/guide', 'Keep an investment record'], ['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/support', 'Help and support']]) {
    const response = await get(app + path); assert.equal(response.status, 200, path);
    for (const [name, value] of [['content-security-policy', "frame-ancestors 'none'"], ['x-frame-options', 'DENY'], ['x-content-type-options', 'nosniff'], ['referrer-policy', 'no-referrer']]) assert.ok(response.headers.get(name)?.includes(value), `${path} ${name}`);
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/, path); assert.match(response.headers.get('content-type') ?? '', /text\/html/, path);
    assert.ok((await response.text()).includes(text), path);
  }
  const manifest = await get(`${app}/manifest.webmanifest`); assert.match(manifest.headers.get('content-type') ?? '', /application\/manifest\+json/); assert.equal(manifest.headers.get('x-content-type-options'), 'nosniff');
  const installed = await manifest.json(); assert.equal(installed.short_name, 'treeti'); assert.equal(installed.start_url, '/launch'); assert.ok(installed.icons.length > 0);
  // Only pages that are the same for everyone may be listed by search engines.
  const robotsTag = async path => (await (await get(app + path)).text()).match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
  for (const path of ['/', '/guide', '/privacy', '/terms', '/support']) { assert.equal(await robotsTag(path), 'index, follow', path); assert.ok((await (await get(app + path)).text()).includes(`<link rel="canonical" href="https://usetreeti.xyz${path === '/' ? '' : path}"`), `${path} canonical`); }
  for (const path of ['/login', '/verify/TREETI-2026-00000', '/invite/' + 'w'.repeat(43)]) assert.match(await robotsTag(path), /noindex/, path);
  const sitemap = await get(`${app}/sitemap.xml`); assert.equal(sitemap.status, 200); const listedPages = await sitemap.text(); for (const path of ['/guide', '/support', '/privacy', '/terms']) assert.ok(listedPages.includes(`<loc>https://usetreeti.xyz${path}</loc>`), path); assert.ok(!/login|app|agreements|invite|verify/.test(listedPages));
  const robots = await get(`${app}/robots.txt`); assert.equal(robots.status, 200); assert.match(await robots.text(), /Allow: \//);
  const loginHTML=await (await get(`${app}/login`)).text();
  const configuredSignIn=!loginHTML.includes('Sign-in setup is still in progress. Please check back later.');
  const welcome=await get(`${app}/welcome`);assert.ok([200,307].includes(welcome.status));assert.match(welcome.headers.get('cache-control')??'',/private.*no-store/);
  if(welcome.status===307){assert.match(welcome.headers.get('location')??'',/\/login\?next=/);await welcome.arrayBuffer();}else{const html=await welcome.text();if(configuredSignIn){assert.match(html,/NEXT_REDIRECT|http-equiv="refresh"/);assert.match(html,/\/login\?next=/);}else{
    // A streamed server error reaches Next's client boundary after hydration;
    // its rendered message is intentionally absent from the initial HTML.
    browser=await chromium.launch();const page=await browser.newPage();
    await page.goto(`${app}/welcome`);
    await page.getByRole('heading',{name:'The page could not be loaded.'}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Full name',exact:true}).count(),0);
    await page.close();
  }assert.ok(!html.includes('What’s your full name?'));}
  for (const path of ['/api/debts', '/api/investments', '/api/demo/me']) {
    const response = await get(app + path); assert.ok(response.status >= 400, path);
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/); await response.arrayBuffer();
  }
  const blocked = await get(`${app}/api/auth/send`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 403); await blocked.arrayBuffer();
  // Next may send HTTP 200 for a streamed not-found response; check its UI too.
  const demo = await get(`${app}/demo`); assert.ok([200, 404].includes(demo.status));
  const demoHTML = await demo.text(); assert.ok(demoHTML.includes('This page is unavailable.')); assert.ok(!demoHTML.includes('Open demonstration'));
  const unsigned = await get(`${app}/api/inngest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(unsigned.status, 401); await unsigned.arrayBuffer();
  console.log('PASS Workers routes, security headers, private caching, disabled demo and unsigned job rejection.');
  const investments=await get(`${probe}/investments`);assert.equal(investments.status,200);
  assert.deepEqual(await investments.json(),{currency:'GBP',total:'155026',totals:[{currency:'GBP',amountMinor:'155026'}]});
  console.log('PASS workerd private investment amounts and currency totals.');

  const cryptoResponse = await get(probe), value = { synthetic: true, version: 1 };
  assert.equal(cryptoResponse.status, 200);
  const result = await cryptoResponse.json(); assert.deepEqual(result.session, value); assert.deepEqual(result.delivery, value);
  assert.equal(result.hash, createHash('sha256').update(JSON.stringify(value)).digest('hex'));
  const pdf = await get(`${probe}/pdf`), bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pdf.headers.get('x-ahd-document-hash'), createHash('sha256').update(bytes).digest('hex'));
  await mkdir('output/pdf', { recursive: true }); await writeFile('output/pdf/cloudflare-runtime-probe.pdf', bytes);
  const installmentPDF=await get(`${probe}/installments-pdf`),installmentBytes=Buffer.from(await installmentPDF.arrayBuffer());
  assert.equal(installmentPDF.status,200);assert.equal(installmentBytes.subarray(0,5).toString(),'%PDF-');
  assert.equal(installmentPDF.headers.get('x-ahd-document-hash'),createHash('sha256').update(installmentBytes).digest('hex'));
  await writeFile('output/pdf/cloudflare-installment-probe.pdf',installmentBytes);
  console.log('PASS workerd single/installment PDF rendering, hashing, signed sessions and encrypted delivery payloads.');

  await mkdir('output/qa', { recursive: true });
  browser ??= await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext();
    await context.addInitScript(theme => localStorage.setItem('ahd:appearance', theme), theme);
    const page = await context.newPage();
    for (const width of [375, 390, 430, 1366, 1920]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      const response = await page.goto(`${app}/login`); assert.equal(response.status(), 200);
      await page.getByRole('heading', { name: /Welcome to treeti/ }).waitFor();
      // Public Supabase settings are frozen into the Next build. A local build
      // may contain them; CI's unconfigured build must still show its fallback.
      const unavailable = page.getByText('Sign-in setup is still in progress. Please check back later.');
      if (await unavailable.isVisible()) {
        assert.equal(await page.getByRole('button', { name: /Send verification code/ }).count(), 0);
      } else {
        assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).count(), 0, 'Returning sign-in must not ask for a name');
        const email=page.getByRole('textbox', { name: 'Email address', exact: true });
        await email.waitFor();assert.equal(await email.getAttribute('type'),'email');
        assert.ok(await page.getByRole('button', { name: /Send verification code/ }).isEnabled());
      }
      assert.equal(await page.getByRole('link', { name: /Explore the demonstration/ }).count(), 0);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Overflow at ${width}`);
      await page.screenshot({ path: `output/qa/cloudflare-login-${theme}-${width}.png`, fullPage: true });
    }
    await context.close();
  }
  console.log('PASS Workers sign-in rendering at five viewport widths in both themes.');
} finally {
  await browser?.close();
  for (const child of children) child.kill('SIGTERM');
}
