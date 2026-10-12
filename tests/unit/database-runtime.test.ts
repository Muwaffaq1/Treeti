import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: undefined as object | undefined, hyperdrive: 'postgres://synthetic:synthetic@hyperdrive.internal/postgres' as string | undefined, cleanup: [] as (() => Promise<void>)[] }));
vi.mock('next/server', () => ({ after: vi.fn((fn: () => Promise<void>) => state.cleanup.push(fn)) }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => { if (!state.context) throw new Error('No context'); return { ctx: state.context, env: { HYPERDRIVE: state.hyperdrive ? { connectionString: state.hyperdrive } : undefined } }; } }));
vi.mock('postgres', () => ({ default: vi.fn(() => ({ unsafe: vi.fn(async () => []), end: vi.fn(async () => {}), begin: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ unsafe: async () => [] })) })) }));
afterEach(() => { vi.unstubAllEnvs(); state.context = undefined; state.hyperdrive = 'postgres://synthetic:synthetic@hyperdrive.internal/postgres'; state.cleanup.length = 0; vi.clearAllMocks(); vi.resetModules(); });
describe('Cloudflare database connection lifecycle', () => {
  it('reuses a connection within a request, isolates requests and closes after completion', async () => {
    vi.stubEnv('SUPABASE_DB_URL', 'postgres://synthetic:synthetic@localhost/postgres');
    vi.stubEnv('AHD_RUNTIME', 'cloudflare');
    const { database } = await import('@/lib/database');
    const { databaseJSONTypes } = await import('@/lib/database-json');
    const { default: postgres } = await import('postgres');
    state.context = {};
    await database().query('select 1'); await database().transaction(tx => tx.query('select 1'));
    expect(postgres).toHaveBeenCalledTimes(1); expect(state.cleanup).toHaveLength(1);
    expect(postgres).toHaveBeenCalledWith(state.hyperdrive, expect.objectContaining({ types: databaseJSONTypes, prepare: true, max: 1 }));
    expect(vi.mocked(postgres).mock.results[0].value.unsafe).toHaveBeenCalledWith('select 1', [], { prepare: true });
    state.context = {}; await database().query('select 2');
    expect(postgres).toHaveBeenCalledTimes(2); expect(state.cleanup).toHaveLength(2);
    const pools = vi.mocked(postgres).mock.results.map(result => result.value);
    expect(pools.every(pool => pool.end.mock.calls.length === 0)).toBe(true);
    await Promise.all(state.cleanup.map(cleanup => cleanup()));
    for (const pool of pools) expect(pool.end).toHaveBeenCalledWith({ timeout: 5 });
  });
  it('uses the same JSON encoding in the Node connection as in Workers', async () => {
    vi.stubEnv('SUPABASE_DB_URL', 'postgres://synthetic:synthetic@localhost/postgres');
    const { database } = await import('@/lib/database');
    const { databaseJSONTypes } = await import('@/lib/database-json');
    const { default: postgres } = await import('postgres');
    await database().query('select 1');
    expect(postgres).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ types: databaseJSONTypes, prepare: false }));
  });
  it('fails closed when a Worker has no Hyperdrive binding', async () => {
    vi.stubEnv('SUPABASE_DB_URL', 'postgres://synthetic:synthetic@localhost/postgres');
    state.context = {}; state.hyperdrive = undefined;
    const { database } = await import('@/lib/database');
    const { default: postgres } = await import('postgres');
    expect(() => database()).toThrow('Hyperdrive is not configured'); expect(postgres).not.toHaveBeenCalled();
  });
  it('fails closed instead of opening a shared socket when Workers context is absent', async () => {
    vi.stubEnv('SUPABASE_DB_URL', 'postgres://synthetic:synthetic@localhost/postgres'); vi.stubEnv('AHD_RUNTIME', 'cloudflare');
    const { database } = await import('@/lib/database');
    const { default: postgres } = await import('postgres');
    expect(() => database()).toThrow('Cloudflare request context'); expect(postgres).not.toHaveBeenCalled();
  });
});
