import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {Database} from '@/lib/database';
import type {Actor} from '@/modules/agreements/types';
import {PostgresTrustedRepository} from '@/modules/trusted/repository';
import {access,requestAccess,shareNow,removeContact,inviteContact} from '@/modules/trusted/model';

const owner:Actor={userId:'11111111-1111-4111-8111-111111111111',name:'Abdullah Musa',contacts:['abdullah@example.test'],demo:false};
const maryam:Actor={userId:'33333333-3333-4333-8333-333333333333',name:'Maryam Bello',contacts:['maryam@example.test'],demo:false};
let pg:PGlite,db:Database,repo:PostgresTrustedRepository;
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create function public.prevent_evidence_change() returns trigger language plpgsql as $$ begin raise exception 'Evidence is append-only'; end $$;`);
 await pg.exec(await readFile('supabase/migrations/202610180010_trusted_contacts.sql','utf8'));
 const wrap=(connection:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await connection.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);repo=new PostgresTrustedRepository(db);
},30000);
afterAll(async()=>{await pg?.close();});

describe('trusted contacts in PostgreSQL',()=>{
 it('stores an invitation, accepts it, opens access and records every step',async()=>{
  const invited=await repo.invite({name:'Maryam Bello',email:'maryam@example.test'},owner);
  expect((await repo.byToken(invited.token!))?.name).toBe('Maryam Bello');
  const [stored]=await db.query<{data:string}>('select data::text from trusted_contacts');expect(stored.data).not.toContain(invited.token!);
  await expect(repo.accept(invited.token!,{...maryam,contacts:['other@example.test']})).rejects.toMatchObject({code:'INVITATION_IDENTITY_MISMATCH'});
  const accepted=await repo.accept(invited.token!,maryam);
  expect((await repo.list(maryam)).trustedBy.map(c=>c.id)).toEqual([accepted.contact.id]);
  const asked=await repo.change(accepted.contact.id,maryam,requestAccess);
  expect(access(asked.contact,await repo.now())).toBe('WAITING');
  await expect(repo.change(accepted.contact.id,maryam,shareNow)).rejects.toMatchObject({status:404});
  const shared=await repo.change(accepted.contact.id,owner,shareNow);expect(access(shared.contact,await repo.now())).toBe('OPEN');
  const events=await db.query<{type:string}>('select type from trusted_contact_events order by created_at,type');
  expect(events.map(e=>e.type).sort()).toEqual(['ACCEPTED','INVITED','REQUESTED','SHARED']);
 });
 it('enforces the limit, immutability and append-only history in the database',async()=>{
  await repo.invite({name:'Yusuf Ali',email:'yusuf@example.test'},owner);
  await expect(repo.invite({name:'Aisha Suleiman',email:'aisha@example.test'},owner)).rejects.toMatchObject({code:'LIMIT_REACHED'});
  // A direct insert past the limit is refused even without the application check.
  const extra=inviteContact({name:'Aisha Suleiman',email:'aisha@example.test'},owner,[],'44444444-4444-4444-8444-444444444444',new Date().toISOString()).contact;
  await expect(db.query('insert into trusted_contacts(id,owner_id,contact_user_id,email,token_hash,status,revision,created_at,data) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[extra.id,extra.ownerId,null,extra.email,extra.tokenHash,extra.status,0,extra.createdAt,JSON.stringify(extra)])).rejects.toThrow('limit');
  await expect(db.query("update trusted_contacts set email='x@example.test'")).rejects.toThrow();
  await expect(db.query('delete from trusted_contacts')).rejects.toThrow('append-only');
  await expect(db.query('delete from trusted_contact_events')).rejects.toThrow('append-only');
  const [first]=(await repo.list(owner)).owned;
  const removed=await repo.change(first.id,owner,removeContact);expect(removed.contact.status).toBe('REMOVED');
  await expect(repo.change(first.id,owner,shareNow)).rejects.toThrow();
  expect((await repo.list(maryam)).trustedBy).toEqual([]);
  expect((await repo.invite({name:'Aisha Suleiman',email:'aisha@example.test'},owner)).contact.status).toBe('INVITED');
 });
});
