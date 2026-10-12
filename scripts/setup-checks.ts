type Check = { name: string; ok: boolean; detail: string };
type Environment = Record<string, string | undefined>;
const required = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL', 'AHD_SESSION_SECRET',
  'AHD_APP_URL', 'RESEND_API_KEY', 'AHD_EMAIL_FROM',
  'INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
] as const;
function https(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }
  catch { return false; }
}
export function checkSetup(env: Environment): Check[] {
  const checks: Check[] = required.map(name => ({ name, ok: !!env[name]?.trim(), detail: 'Required for the hosted email beta.' }));
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'AHD_APP_URL', 'UPSTASH_REDIS_REST_URL']) {
    checks.push({ name: `${name} HTTPS`, ok: https(env[name]), detail: 'Use a hosted HTTPS URL without credentials.' });
  }
  let databaseURL = false;
  try { const url = new URL(env.SUPABASE_DB_URL ?? ''); databaseURL = ['postgres:', 'postgresql:'].includes(url.protocol) && !!url.username && !!url.password && !!url.hostname; } catch {}
  checks.push({ name: 'Database connection URL', ok: databaseURL, detail: 'Use the Supabase server connection URL, including its password.' });
  checks.push({ name: 'Session secret length', ok: (env.AHD_SESSION_SECRET?.length ?? 0) >= 32, detail: 'Use a stable, randomly generated secret of at least 32 characters.' });
  checks.push({ name: 'Hosted demo disabled', ok: env.AHD_ENABLE_DEMO === 'false', detail: 'Set AHD_ENABLE_DEMO=false. File-backed demo storage is local only.' });
  checks.push({ name: 'Email sender', ok: /(?:^|<)[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(env.AHD_EMAIL_FROM ?? '') && !/(?:example\.(?:com|test)|localhost)>?$/.test(env.AHD_EMAIL_FROM ?? ''), detail: 'Use an address on your verified Resend domain.' });
  return checks;
}
