import postgres from 'postgres';
import { after } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { databaseTLS } from './database-tls';
import { databaseJSONTypes } from './database-json';
declare global {
  interface CloudflareEnv { HYPERDRIVE?: { connectionString: string }; }
}
export interface Database {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(work: (tx: Database) => Promise<T>): Promise<T>;
}
let connection: ReturnType<typeof postgres> | undefined;
const workerConnections = new WeakMap<object, ReturnType<typeof postgres>>();
export function database(): Database {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Supabase database is not configured.');
  let context: object | undefined;
  let workerURL: string | undefined;
  try { const cloudflare = getCloudflareContext(); context = cloudflare.ctx; workerURL = cloudflare.env.HYPERDRIVE?.connectionString; } catch {
    if (process.env.AHD_RUNTIME === 'cloudflare') throw new Error('Cloudflare request context is unavailable.');
  }
  let current: ReturnType<typeof postgres>;
  if (context) {
    if (!workerURL) throw new Error('Cloudflare Hyperdrive is not configured.');
    const existing = workerConnections.get(context);
    if (existing) current = existing;
    else {
      // Hyperdrive verifies the Supabase origin with its configured CA and
      // hostname; the binding supplies the internal pooled connection URL.
      current = postgres(workerURL, { types: databaseJSONTypes, prepare: true, max: 1, idle_timeout: 5, connect_timeout: 10 });
      const requestConnection = current;
      after(async () => { await requestConnection.end({ timeout: 5 }); });
      workerConnections.set(context, current);
    }
  } else current = connection ??= postgres(process.env.SUPABASE_DB_URL, { ...databaseTLS(process.env.SUPABASE_DB_URL), types: databaseJSONTypes, prepare: false, max: 5, idle_timeout: 20 });
  const wrap = (sql: ReturnType<typeof postgres> | postgres.TransactionSql): Database => ({
    async query<T>(text: string, params: unknown[] = []) { return await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[], { prepare: Boolean(context) }) as unknown as T[]; },
    async transaction<T>(work: (tx: Database) => Promise<T>) { return await (sql as ReturnType<typeof postgres>).begin(tx => work(wrap(tx))) as T; },
  });
  return wrap(current);
}
