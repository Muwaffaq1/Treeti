import {randomUUID} from 'node:crypto';
import {database,type Database} from '@/lib/database';
import {sha256} from '@/lib/crypto';
import {DomainError} from '@/lib/domain-error';
import type {Actor} from '@/modules/agreements/types';
import {DemoRepository} from '@/modules/agreements/demo';
import {PostgresRepository} from '@/modules/agreements/repository';
import {PostgresDebtRepository} from '@/modules/debts/repository';
import {acceptInvitation,inviteContact,type TrustedChange,type TrustedContact} from './model';
import {sharedRecords,type SharedRecords} from './summary';

export type TrustedAction=(contact:TrustedContact,actor:Actor,now:string)=>TrustedChange;
export interface TrustedRepository{
  now():Promise<string>;
  /** The people this person added, and the people who added them. Removed links are left out. */
  list(actor:Actor):Promise<{owned:TrustedContact[];trustedBy:TrustedContact[]}>;
  byToken(token:string):Promise<TrustedContact|null>;
  byId(id:string):Promise<TrustedContact|null>;
  invite(input:unknown,actor:Actor):Promise<TrustedChange>;
  accept(token:string,actor:Actor):Promise<TrustedChange>;
  change(id:string,actor:Actor,action:TrustedAction):Promise<TrustedChange>;
  /** The owner's records, read only after the caller has checked that access is open. */
  records(contact:TrustedContact):Promise<SharedRecords>;
}
export function trustedRepository(demo:boolean,workspace?:string):TrustedRepository{
  if(demo){if(!workspace)throw new DomainError('AUTH_REQUIRED','Open the demonstration to continue.',401);return new DemoTrustedRepository(new DemoRepository(workspace));}
  return new PostgresTrustedRepository(database());
}
const unavailable=()=>new DomainError('NOT_FOUND','This trusted contact is unavailable.',404);
const ownerActor=(contact:TrustedContact,demo:boolean):Actor=>({userId:contact.ownerId,name:contact.ownerName,contacts:[contact.ownerEmail],demo});

export class PostgresTrustedRepository implements TrustedRepository{
  constructor(private db:Database){}
  now(){return new PostgresRepository(this.db).now(this.db);}
  private rows(db:Database,where:string,values:unknown[]){return db.query<{data:TrustedContact}>(`select data from trusted_contacts where ${where} order by created_at,id`,values).then(rows=>rows.map(r=>r.data));}
  private async write(db:Database,change:TrustedChange,actor:Actor,insert:boolean){
    const c=change.contact;
    if(insert)await db.query('insert into trusted_contacts(id,owner_id,contact_user_id,email,token_hash,status,revision,created_at,data) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.id,c.ownerId,c.contactUserId,c.email,c.tokenHash,c.status,c.revision,c.createdAt,JSON.stringify(c)]);
    else await db.query('update trusted_contacts set contact_user_id=$2,token_hash=$3,status=$4,revision=$5,data=$6 where id=$1',[c.id,c.contactUserId,c.tokenHash,c.status,c.revision,JSON.stringify(c)]);
    await db.query('insert into trusted_contact_events(id,trusted_contact_id,actor_id,type) values($1,$2,$3,$4)',[randomUUID(),c.id,actor.userId,change.event]);
    return change;
  }
  async list(actor:Actor){return {owned:await this.rows(this.db,"owner_id=$1 and status<>'REMOVED'",[actor.userId]),trustedBy:await this.rows(this.db,"contact_user_id=$1 and status='ACCEPTED'",[actor.userId])};}
  async byToken(token:string){return (await this.rows(this.db,'token_hash=$1',[sha256(token)]))[0]??null;}
  async byId(id:string){return (await this.rows(this.db,'id=$1',[id]))[0]??null;}
  invite(input:unknown,actor:Actor){return this.db.transaction(async db=>{
    // Serializes additions per owner so the two-person limit holds under concurrent requests.
    await db.query('select pg_advisory_xact_lock(hashtext($1))',[`trusted:${actor.userId}`]);
    const existing=await this.rows(db,"owner_id=$1 and status<>'REMOVED'",[actor.userId]);
    return this.write(db,inviteContact(input,actor,existing,randomUUID(),await new PostgresRepository(db).now(db)),actor,true);
  });}
  accept(token:string,actor:Actor){return this.db.transaction(async db=>{
    const [row]=await db.query<{data:TrustedContact}>('select data from trusted_contacts where token_hash=$1 for update',[sha256(token)]);
    return this.write(db,acceptInvitation(row?.data??null,token,actor,await new PostgresRepository(db).now(db)),actor,false);
  });}
  change(id:string,actor:Actor,action:TrustedAction){return this.db.transaction(async db=>{
    const [row]=await db.query<{data:TrustedContact}>('select data from trusted_contacts where id=$1 for update',[id]);
    if(!row)throw unavailable();
    return this.write(db,action(row.data,actor,await new PostgresRepository(db).now(db)),actor,false);
  });}
  async records(contact:TrustedContact){
    const owner=ownerActor(contact,false);
    return sharedRecords(owner.userId,owner.name,await new PostgresRepository(this.db).list(owner),await new PostgresDebtRepository(this.db).listDebts(owner));
  }
}

export class DemoTrustedRepository implements TrustedRepository{
  constructor(private demo:DemoRepository){}
  async now(){return new Date().toISOString();}
  async list(actor:Actor){return this.demo.trustedTransaction(contacts=>({owned:contacts.filter(c=>c.ownerId===actor.userId&&c.status!=='REMOVED'),trustedBy:contacts.filter(c=>c.contactUserId===actor.userId&&c.status==='ACCEPTED')}));}
  async byToken(token:string){return this.demo.trustedTransaction(contacts=>contacts.find(c=>c.tokenHash===sha256(token))??null);}
  async byId(id:string){return this.demo.trustedTransaction(contacts=>contacts.find(c=>c.id===id)??null);}
  private save(apply:(contacts:TrustedContact[],now:string)=>TrustedChange,actor:Actor){return this.demo.trustedTransaction((contacts,events)=>{
    const now=new Date().toISOString(),change=apply(contacts,now),index=contacts.findIndex(c=>c.id===change.contact.id);
    if(index<0)contacts.push(change.contact);else contacts[index]=change.contact;
    events.push({id:randomUUID(),trustedContactId:change.contact.id,actorId:actor.userId,type:change.event,createdAt:now});
    return change;
  });}
  invite(input:unknown,actor:Actor){return this.save((contacts,now)=>inviteContact(input,actor,contacts,randomUUID(),now),actor);}
  accept(token:string,actor:Actor){return this.save((contacts,now)=>acceptInvitation(contacts.find(c=>c.tokenHash===sha256(token))??null,token,actor,now),actor);}
  change(id:string,actor:Actor,action:TrustedAction){return this.save((contacts,now)=>{const contact=contacts.find(c=>c.id===id);if(!contact)throw unavailable();return action(contact,actor,now);},actor);}
  async records(contact:TrustedContact){
    const owner=ownerActor(contact,true);
    return sharedRecords(owner.userId,owner.name,await this.demo.list(owner),await this.demo.listDebts(owner));
  }
}
