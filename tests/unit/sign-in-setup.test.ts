import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

afterEach(() => vi.unstubAllEnvs());
describe('hosted sign-in setup', () => {
  it('keeps hosted sign-in unavailable and verification closed until shared limits exist', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-public');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(signInConfigured()).toBe(false);
    await expect(rateLimit('synthetic-otp')).rejects.toMatchObject({ code: 'RATE_LIMIT_SETUP_REQUIRED', status: 503 });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://synthetic.upstash.io');
    expect(signInConfigured()).toBe(false);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'synthetic-token');
    expect(signInConfigured()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(signInConfigured()).toBe(false);
  });
});
