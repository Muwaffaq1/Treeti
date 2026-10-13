// Creates the web push (VAPID) signing pair and stores it as Worker secrets, once.
// The private key never touches disk or the terminal. Replacing the pair would silently
// disconnect every device that already turned notifications on, so an existing pair is kept.
// Usage: node scripts/set-push-keys.mjs
import { spawnSync } from 'node:child_process';

const wrangler = ['node_modules/wrangler/bin/wrangler.js'], target = ['--config', 'wrangler.promotion.jsonc', '--env', ''];
const run = (args, input) => spawnSync(process.execPath, [...wrangler, ...args, ...target], { input, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
const base64Url = bytes => Buffer.from(bytes).toString('base64url');

const listed = run(['secret', 'list']);
if (listed.status !== 0) { console.error('Could not read the Worker’s secret names. Sign in with wrangler and try again.'); process.exit(1); }
const names = JSON.parse(listed.stdout).map(secret => secret.name);
if (names.includes('VAPID_PUBLIC_KEY') && names.includes('VAPID_PRIVATE_KEY')) { console.log('Push keys are already set. Nothing changed.'); process.exit(0); }

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const { d: privateKey } = await crypto.subtle.exportKey('jwk', pair.privateKey);
const saved = run(['secret', 'bulk'], JSON.stringify({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }));
if (saved.status !== 0) { console.error('The push keys were not saved. No secret was changed.'); process.exit(1); }
console.log(`Push keys saved as Worker secrets. Public key: ${publicKey}`);
