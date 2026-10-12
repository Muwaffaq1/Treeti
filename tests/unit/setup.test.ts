import { describe, expect, it } from 'vitest';
import { checkSetup } from '../../scripts/setup-checks';
const ready = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private', SUPABASE_DB_URL: 'postgres://postgres:synthetic@project.pooler.supabase.com:6543/postgres',
  AHD_SESSION_SECRET: 'synthetic-secret-for-tests-only-32-characters', AHD_APP_URL: 'https://ahd-staging.example.org', AHD_ENABLE_DEMO: 'false',
  RESEND_API_KEY: 'synthetic-resend', AHD_EMAIL_FROM: 'treeti <records@example.org>', INNGEST_EVENT_KEY: 'synthetic-event',
  INNGEST_SIGNING_KEY: 'synthetic-signing', UPSTASH_REDIS_REST_URL: 'https://project.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
};
describe('hosted configuration checks', () => {
  it('reports missing services without ever including secret values', () => {
    expect(checkSetup({}).filter(check => !check.ok).length).toBeGreaterThan(10);
    const checks = checkSetup(ready); expect(checks.every(check => check.ok)).toBe(true);
    for (const value of Object.values(ready).filter(value => value !== 'false')) expect(JSON.stringify(checks)).not.toContain(value);
  });
  it('rejects insecure URLs, demo enablement, weak secrets and placeholder senders', () => {
    const checks = checkSetup({ ...ready, AHD_APP_URL: 'http://localhost:3000', AHD_ENABLE_DEMO: 'true', AHD_SESSION_SECRET: 'short', AHD_EMAIL_FROM: 'treeti <records@example.com>', SUPABASE_DB_URL: 'https://project.supabase.co' });
    for (const name of ['AHD_APP_URL HTTPS', 'Hosted demo disabled', 'Session secret length', 'Email sender', 'Database connection URL']) expect(checks.find(check => check.name === name)?.ok).toBe(false);
  });
});
