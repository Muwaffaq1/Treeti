import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// Temporary loopback-only setup page. Never part of the deployed application.
const project = 'uuryyzuuzfgqtznszrls';
const file = new URL('../.env.local', import.meta.url);
const origin = 'http://127.0.0.1:8977';
const token = randomBytes(32).toString('hex');
let contents = await readFile(file, 'utf8');
if (!contents.includes(`NEXT_PUBLIC_SUPABASE_URL=https://${project}.supabase.co`)) throw new Error('Local configuration does not match treeti staging.');
const configured = name => !!contents.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
async function save(name, value) {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  contents = pattern.test(contents) ? contents.replace(pattern, () => `${name}=${value}`) : `${contents}\n${name}=${value}\n`;
  await writeFile(file, contents, { mode: 0o600 });
  await chmod(file, 0o600);
}
let saving = false;
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (request.headers.host !== '127.0.0.1:8977' || request.url !== '/') { response.writeHead(404).end(); return; }
  // Preserve changes made through the owner's editor between setup requests.
  try { contents = await readFile(file, 'utf8'); }
  catch { response.writeHead(500).end('Local configuration is unavailable.'); return; }
  if (request.method === 'GET') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const ready = configured('SUPABASE_DB_URL') && configured('SUPABASE_SERVICE_ROLE_KEY');
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect treeti staging</title><style>body{font:16px/1.6 system-ui;background:#111;color:#eee;margin:0;padding:40px 24px}main{max-width:520px;margin:40px auto}h1{font-size:30px}p{color:#bbb}label{display:block;margin:24px 0}input{display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:16px;border:1px solid #666;border-radius:14px;background:#242424;color:#fff;font:inherit}input:focus-visible{outline:3px solid #9c62f8;outline-offset:3px}button{padding:14px 24px;border:0;border-radius:999px;background:#9c62f8;color:#111;font:600 16px system-ui;cursor:pointer}small{display:block;color:#aaa;margin-top:24px}</style><main><h1>${ready ? 'Staging credentials saved.' : 'Connect treeti staging'}</h1><p>${ready ? 'Return to Codex to verify the connection and apply migrations.' : 'Enter credentials privately here. This page saves them only to treeti’s local .env.local file.'}</p>${ready ? '' : `<form method="post" action="/"><input type="hidden" name="token" value="${token}">${configured('SUPABASE_SERVICE_ROLE_KEY') ? '<p>Server key saved.</p>' : '<label>Supabase server key<input name="key" type="password" autocomplete="off" spellcheck="false" aria-label="Supabase server key"></label>'}<label>Database password<input name="password" type="password" autocomplete="off" spellcheck="false" aria-label="Database password"></label><button type="submit">Save staging credentials</button><small>You can save the server key first. The database password is the one saved when you created this project. No database changes happen on this page.</small></form>`}</main></html>`);
    return;
  }
  // An embedded browser can submit with an opaque Origin ("null"). The
  // unguessable form token remains mandatory; arbitrary web origins are denied.
  const allowedOrigin = request.headers.origin === origin || request.headers.origin === 'null';
  if (request.method !== 'POST' || !allowedOrigin || saving) { response.writeHead(403).end('Request unavailable.'); return; }
  saving = true;
  try {
    let body = '';
    for await (const chunk of request) { body += chunk.toString('utf8'); if (Buffer.byteLength(body) > 8192) throw new Error('Request too large.'); }
    const fields = new URLSearchParams(body);
    if (fields.get('token') !== token) throw new Error('Invalid setup request.');
    const key = fields.get('key')?.trim();
    if (key) {
      if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key) && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid server key.');
      await save('SUPABASE_SERVICE_ROLE_KEY', key);
    }
    const password = fields.get('password');
    if (password && password !== '[YOUR-PASSWORD]') {
      if (!configured('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Server key required.');
      await save('SUPABASE_DB_URL', `postgresql://postgres.${project}:${encodeURIComponent(password)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`);
    }
    response.writeHead(303, { Location: '/' }).end();
    console.log(configured('SUPABASE_DB_URL') ? 'Credentials saved privately; connection has not been tested.' : 'Server key saved privately; database password is still required.');
  } catch { response.writeHead(400).end('Unable to save. Check the setup fields and try again.'); }
  finally { saving = false; }
});
server.listen(8977, '127.0.0.1', () => console.log(`Private setup page: ${origin}`));
const expiry = setTimeout(() => server.close(), 20 * 60 * 1000);
expiry.unref();
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
