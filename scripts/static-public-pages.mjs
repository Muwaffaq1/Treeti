// Public pages that are the same for everyone are copied next to the other static files,
// so Cloudflare serves them directly and the Worker (and its CPU allowance) is not used.
// Runs after `opennextjs-cloudflare build`. A page that stops being prebuilt fails the build here.
import { copyFile, writeFile, access } from 'node:fs/promises';
import { securityHeaders } from './security-headers.mjs';

export const STATIC_PUBLIC_PAGES=['guide','privacy','terms','support'];
const assets='.open-next/assets';
for(const page of STATIC_PUBLIC_PAGES){
  const source=`.next/server/app/${page}.html`;
  try{await access(source);}catch{console.error(`/${page} is no longer prebuilt by Next, so it cannot be served as a static page. Remove it from STATIC_PUBLIC_PAGES or make it static again.`);process.exit(1);}
  await copyFile(source,`${assets}/${page}.html`);
}
// Static files do not pass through Next, so they carry the same headers explicitly.
const headers=[...securityHeaders().map(h=>`  ${h.key}: ${h.value}`),'  Cache-Control: private, no-store'].join('\n');
await writeFile(`${assets}/_headers`,STATIC_PUBLIC_PAGES.map(page=>`/${page}\n${headers}`).join('\n\n')+'\n');
console.log(`Packaged ${STATIC_PUBLIC_PAGES.length} public pages as static files.`);
