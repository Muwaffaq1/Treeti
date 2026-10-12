import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {PGlite} from '@electric-sql/pglite';

// A private application snapshot, not a replacement for a full provider backup.
// Reads the live database and Storage. Restoration checks run only in memory.
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ident=name=>'"'+name.replaceAll('"','""')+'"';
async function verify(folder) {
  const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
  const bytes=await readFile(join(folder,'application.json'));
  assert.equal(sha(bytes),manifest.applicationSha256);
  const snapshot=JSON.parse(bytes);
  const pg=new PGlite();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; set timezone='UTC';`);
    for(const migration of snapshot.migrations.filter(m=>!m.name.includes('_storage.sql'))){assert.equal(sha(migration.source),migration.sha256);await pg.exec(migration.source);}
    await pg.exec('create table public.ahd_schema_migrations(name text primary key,applied_at timestamptz not null default now()); set session_replication_role=replica;');
    for(const table of snapshot.tables){if(table.records.length)await pg.query(`insert into public.${ident(table.name)} select * from jsonb_populate_recordset(null::public.${ident(table.name)},$1::jsonb)`,['['+table.records.join(',')+']']);}
    await pg.exec('set session_replication_role=origin;');
    for(const sequence of snapshot.sequences){if(sequence.last_value!==null)await pg.query('select setval($1::regclass,$2::bigint,true)',['public.'+sequence.sequencename,sequence.last_value]);}
    for(const sequence of snapshot.sequences){const {rows}=await pg.query('select last_value from pg_sequences where schemaname=$1 and sequencename=$2',['public',sequence.sequencename]);assert.equal(String(rows[0].last_value),String(sequence.last_value),'Restored sequence mismatch');}
    for(const table of snapshot.tables){const {rows}=await pg.query(`select to_jsonb(t)::text as record from public.${ident(table.name)} t order by to_jsonb(t)::text`);assert.deepEqual(rows.map(r=>r.record),table.records,`Restored table mismatch: ${table.name}`);}
    // Imported immutable/cyclic data bypassed triggers; verify every foreign key.
    const {rows:foreignKeys}=await pg.query(`select c.conname, c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent,
      array_agg(ca.attname order by k.ordinality) as child_columns,array_agg(pa.attname order by k.ordinality) as parent_columns
      from pg_constraint c join lateral unnest(c.conkey,c.confkey) with ordinality k(child_id,parent_id,ordinality) on true
      join pg_attribute ca on ca.attrelid=c.conrelid and ca.attnum=k.child_id join pg_attribute pa on pa.attrelid=c.confrelid and pa.attnum=k.parent_id
      where c.contype='f' group by c.oid,c.conname,c.conrelid,c.confrelid`);
    for(const fk of foreignKeys){const present=fk.child_columns.map(c=>`c.${ident(c)} is not null`).join(' and '),matches=fk.child_columns.map((c,i)=>`p.${ident(fk.parent_columns[i])}=c.${ident(c)}`).join(' and ');const {rows}=await pg.query(`select count(*)::int as count from ${fk.child} c where ${present} and not exists(select 1 from ${fk.parent} p where ${matches})`);assert.equal(rows[0].count,0,`Restored relationship mismatch: ${fk.conname}`);}
    for(const file of manifest.files)assert.equal(sha(await readFile(join(folder,file.localPath))),file.sha256,'Saved Storage file hash mismatch');
    console.log(`PASS offline application restore: ${snapshot.tables.length} tables, ${snapshot.tables.reduce((n,t)=>n+t.records.length,0)} rows, ${foreignKeys.length} foreign keys, ${manifest.files.length} Storage files. No live writes.`);
  }finally{await pg.close();}
}
async function backup() {
  for(const name of ['SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])assert.ok(process.env[name],`${name} is required`);
  const folder=resolve('output/backups',new Date().toISOString().replaceAll(':','-'));
  await mkdir(join(folder,'files'),{recursive:true,mode:0o700});
  const ca=(await readFile('src/lib/database-tls.ts','utf8')).match(/`(-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----\n)`/)[1];
  const sql=postgres(process.env.SUPABASE_DB_URL,{ssl:{ca,rejectUnauthorized:true},prepare:false,max:1,connect_timeout:15});
  let snapshot;
  try{snapshot=await sql.begin('isolation level repeatable read read only',async tx=>{
    await tx`set timezone='UTC'`;
    const tables=[];
    for(const t of await tx`select tablename from pg_tables where schemaname='public' order by tablename`){const rows=await tx.unsafe(`select to_jsonb(t)::text as record from public.${ident(t.tablename)} t order by to_jsonb(t)::text`);tables.push({name:t.tablename,records:rows.map(r=>r.record)});}
    const migrations=[];for(const m of await tx`select name from public.ahd_schema_migrations order by name`){const source=await readFile(join('supabase/migrations',m.name),'utf8');migrations.push({name:m.name,source,sha256:sha(source)});}
    return {format:1,createdAt:new Date().toISOString(),project:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,tables,migrations,sequences:await tx`select sequencename,last_value from pg_sequences where schemaname='public'`,accounts:await tx`select id,email,email_confirmed_at,raw_user_meta_data from auth.users`,buckets:await tx`select id,public from storage.buckets`,objects:await tx`select id,bucket_id,name,metadata from storage.objects order by bucket_id,name`};
  });}finally{await sql.end();}
  const application=JSON.stringify(snapshot);await writeFile(join(folder,'application.json'),application,{mode:0o600});
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),files=[];
  for(const object of snapshot.objects){const {data,error}=await admin.storage.from(object.bucket_id).download(object.name);if(error||!data)throw new Error('Private Storage download failed');const bytes=Buffer.from(await data.arrayBuffer()),localPath=`files/${object.id}`;await writeFile(join(folder,localPath),bytes,{mode:0o600});files.push({bucket:object.bucket_id,path:object.name,localPath,sha256:sha(bytes),bytes:bytes.length});}
  // Evidence hashes must match the authoritative artifact records, not only downloads.
  for(const row of snapshot.tables.find(t=>t.name==='artifacts').records){const artifact=JSON.parse(row);const file=files.find(f=>f.path===artifact.storage_path);assert.ok(file,'Missing saved agreement artifact');assert.equal(file.sha256,artifact.sha256,'Evidence artifact hash mismatch');}
  await writeFile(join(folder,'manifest.json'),JSON.stringify({format:1,createdAt:snapshot.createdAt,applicationSha256:sha(application),files}),{mode:0o600});
  await verify(folder);
  console.log(`Private snapshot saved: ${folder}`);
  console.log('Includes application records, account reference metadata and private Storage files; it does not back up Auth credentials/sessions, provider settings or external secrets. Keep it private and outside Git.');
}
try{if(process.argv[2]==='--verify')await verify(resolve(process.argv[3]));else await backup();}catch{console.error('Backup/restore check failed. Check configuration, connectivity, permissions or migration compatibility. No credentials or records displayed.');process.exitCode=1;}
