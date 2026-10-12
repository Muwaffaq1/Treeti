import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { databaseTLS } from '../src/lib/database-tls';
async function migrate() {
  if (!process.env.SUPABASE_DB_URL) {
    console.error('Set SUPABASE_DB_URL in .env.local or the process environment before applying migrations.');
    process.exitCode = 1;
    return;
  }
  const sql = postgres(process.env.SUPABASE_DB_URL, { ...databaseTLS(process.env.SUPABASE_DB_URL), prepare: false, max: 1 });
  try {
    await sql`create table if not exists public.ahd_schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    await sql`revoke all on public.ahd_schema_migrations from anon, authenticated`;
    for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      const source = await readFile(`supabase/migrations/${file}`, 'utf8');
      const applied = await sql.begin(async tx => {
        // Serialize migration runners; check history again after taking the lock.
        await tx`select pg_advisory_xact_lock(1095255117)`;
        if ((await tx`select name from public.ahd_schema_migrations where name = ${file}`).length) return false;
        await tx.unsafe(source);
        await tx`insert into public.ahd_schema_migrations (name) values (${file})`;
        return true;
      });
      console.log(`${applied ? 'Applied' : 'Already applied'} ${file}`);
    }
  } finally { await sql.end(); }
}
void migrate().catch(() => {
  console.error('Migration failed. Check database connectivity, database permissions and migration compatibility. No credentials are displayed.');
  process.exitCode = 1;
});
