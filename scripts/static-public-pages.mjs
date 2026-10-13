// Public pages that are the same for everyone are copied next to the other static files,
// so Cloudflare serves them directly and the Worker (and its CPU allowance) is not used.
// Runs after `opennextjs-cloudflare build`. A page that stops being prebuilt fails the build here.
// With --require-sign-in (used before a production deploy) it also refuses a sign-in page that
// was built without the sign-in settings, because that page is no longer rendered per request.
import { copyFile, readFile, writeFile, access } from 'node:fs/promises';
import { securityHeaders } from './security-headers.mjs';

// Address → prebuilt file name (without .html) in `.next/server/app`.
export const STATIC_PUBLIC_PAGES={'/':'index','/login':'login','/guide':'guide','/privacy':'privacy','/terms':'terms','/support':'support'};
const assets='.open-next/assets';
for(const [path,file] of Object.entries(STATIC_PUBLIC_PAGES)){
  const source=`.next/server/app/${file}.html`;
  try{await access(source);}catch{console.error(`${path} is no longer prebuilt by Next, so it cannot be served as a static page. Remove it from STATIC_PUBLIC_PAGES or make it static again.`);process.exit(1);}
  await copyFile(source,`${assets}/${file}.html`);
}
// The install manifest is requested by every page and never changes between deploys.
try{await copyFile('.next/server/app/manifest.webmanifest.body',`${assets}/manifest.webmanifest`);}catch{console.error('The install manifest is no longer prebuilt by Next, so it cannot be served as a static file.');process.exit(1);}
// Static files do not pass through Next, so they carry the same headers explicitly.
const headers=[...securityHeaders().map(h=>`  ${h.key}: ${h.value}`),'  Cache-Control: private, no-store'].join('\n');
const manifestHeaders=['  Content-Type: application/manifest+json',...securityHeaders().map(h=>`  ${h.key}: ${h.value}`)].join('\n');
await writeFile(`${assets}/_headers`,[...Object.keys(STATIC_PUBLIC_PAGES).map(path=>`${path}\n${headers}`),`/manifest.webmanifest\n${manifestHeaders}`].join('\n\n')+'\n');
const signInReady=/>Email address<\/label>/.test(await readFile(`${assets}/login.html`,'utf8'));
if(!signInReady&&process.argv.includes('--require-sign-in')){console.error('The sign-in page was built without the sign-in settings (Supabase and rate-limit variables), so it would tell people sign-in is not ready. Build again with them set before deploying.');process.exit(1);}
console.log(`Packaged ${Object.keys(STATIC_PUBLIC_PAGES).length} public pages and the install manifest as static files${signInReady?'':' (sign-in form not configured in this build)'}.`);
