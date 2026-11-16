import {randomUUID} from 'node:crypto';
import {database,type Database} from '@/lib/database';
import {sha256} from '@/lib/crypto';
import {DomainError} from '@/lib/domain-error';
import type {Actor} from '@/modules/agreements/types';
import {DemoRepository} from '@/modules/agreements/demo';
import {PostgresRepository} from '@/modules/agreements/repository';
import type {Investment} from '@/modules/investments/model';
import {createAgreement,investmentFor,joinAgreement,newPublicId,type Change,type InvestmentAgreement} from './model';

export type Action=(a:InvestmentAgreement,actor:Actor,input:unknown,now:string)=>Change;
export interface InvestmentAgreementRepository{
  list(actor:Actor):Promise<InvestmentAgreement[]>;
  get(id:string):Promise<InvestmentAgreement|null>;
  byToken(token:string):Promise<InvestmentAgreement|null>;
  create(input:unknown,actor:Actor,key:string):Promise<Change>;
  join(token:string,actor:Actor):Promise<Change>;
  change(id:string,actor:Actor,input:unknown,action:Action):Promise<Change>;
}
export function investmentAgreementRepository(demo:boolean,workspace?:string):InvestmentAgreementRepository{
  if(demo){if(!workspace)throw new DomainError('AUTH_REQUIRED','Open the demonstration to continue.',401);return new DemoInvestmentAgreementRepository(new DemoRepository(workspace));}
  return new PostgresInvestmentAgreementRepository(database());
}
const unavailable=()=>new DomainError('NOT_FOUND','This agreement is unavailable.',404);
const keyFor=(actor:Actor,key:string)=>sha256(`${actor.userId}:${key}`);
const isPerson=(a:InvestmentAgreement,userId:string)=>[...a.partners,...a.witnesses].some(p=>p.userId===userId);
/** Once final, each partner gets the shared investment in their own records (made once per partner). */
function recordsFor(a:InvestmentAgreement,existing:Investment[],now:string){
  return a.partners.filter(p=>p.userId&&!existing.some(r=>r.agreementId===a.id&&r.ownerId===p.userId)).map(p=>investmentFor(a,p,randomUUID(),randomUUID(),now) as Investment);
}

export class PostgresInvestmentAgreementRepository implements InvestmentAgreementRepository{
  constructor(private db:Database){}
  private rows(db:Database,where:string,values:unknown[]){return db.query<{data:InvestmentAgreement}>(`select data from investment_agreements where ${where} order by created_at desc,id`,values).then(r=>r.map(x=>x.data));}
  private async write(db:Database,change:Change,actor:Actor,insert:boolean){
    const a=change.agreement;
    if(insert)await db.query('insert into investment_agreements(id,public_id,created_by,status,revision,created_at,create_key,data) values($1,$2,$3,$4,$5,$6,$7,$8)',[a.id,a.publicId,a.createdBy,a.status,a.revision,a.createdAt,a.createKey,JSON.stringify(a)]);
    else await db.query('update investment_agreements set status=$2,revision=$3,data=$4 where id=$1',[a.id,a.status,a.revision,JSON.stringify(a)]);
    // People and invitation links are kept in their own small tables so lookups never scan the documents.
    await db.query('delete from investment_agreement_people where agreement_id=$1',[a.id]);
    for(const p of [...a.partners,...a.witnesses])await db.query('insert into investment_agreement_people(agreement_id,person_id,user_id,token_hash) values($1,$2,$3,$4)',[a.id,p.id,p.userId,p.tokenHash]);
    // One change can add several events (signing can also finish it), so append any not stored yet.
    for(const event of a.events)await db.query('insert into investment_agreement_events(id,agreement_id,sequence,actor_id,type,hash,created_at) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',[event.id,a.id,event.sequence,actor.userId,event.type,event.hash,event.createdAt]);
    if(change.event==='FINALIZED'){
      const owners=a.partners.map(p=>p.userId).filter(Boolean);
      const existing=(await db.query<{data:Investment}>("select data from personal_investments where owner_id=any($1::uuid[]) and data->>'agreementId'=$2",[owners,a.id])).map(r=>r.data);
      for(const r of recordsFor(a,existing,a.finalizedAt!))await db.query('insert into personal_investments(id,owner_id,currency,revision,created_at,data) values($1,$2,$3,$4,$5,$6)',[r.id,r.ownerId,r.currency,r.revision,r.createdAt,JSON.stringify(r)]);
    }
    return change;
  }
  private now(db:Database){return new PostgresRepository(db).now(db);}
  list(actor:Actor){return this.rows(this.db,'id in (select agreement_id from investment_agreement_people where user_id=$1)',[actor.userId]);}
  async get(id:string){return (await this.rows(this.db,'id=$1',[id]))[0]??null;}
  async byToken(token:string){return (await this.rows(this.db,'id in (select agreement_id from investment_agreement_people where token_hash=$1)',[sha256(token)]))[0]??null;}
  create(input:unknown,actor:Actor,key:string){return this.db.transaction(async db=>{
    const createKey=keyFor(actor,key),[prior]=await this.rows(db,'create_key=$1',[createKey]);
    if(prior)return {agreement:prior,event:'CREATED' as const};
    return this.write(db,createAgreement(input,actor,newPublicId(),createKey,await this.now(db)),actor,true);
  });}
  join(token:string,actor:Actor){return this.db.transaction(async db=>{
    const [row]=await db.query<{data:InvestmentAgreement}>('select data from investment_agreements where id in (select agreement_id from investment_agreement_people where token_hash=$1) for update',[sha256(token)]);
    const change=joinAgreement(row?.data??null,token,actor,await this.now(db));
    return change.agreement===row?.data?change:this.write(db,change,actor,false);
  });}
  change(id:string,actor:Actor,input:unknown,action:Action){return this.db.transaction(async db=>{
    const [row]=await db.query<{data:InvestmentAgreement}>('select data from investment_agreements where id=$1 for update',[id]);
    if(!row||!isPerson(row.data,actor.userId))throw unavailable();
    return this.write(db,action(row.data,actor,input,await this.now(db)),actor,false);
  });}
}

export class DemoInvestmentAgreementRepository implements InvestmentAgreementRepository{
  constructor(private demo:DemoRepository){}
  list(actor:Actor){return this.demo.investmentAgreementTransaction(all=>all.filter(a=>isPerson(a,actor.userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
  get(id:string){return this.demo.investmentAgreementTransaction(all=>all.find(a=>a.id===id)??null);}
  byToken(token:string){const hash=sha256(token);return this.demo.investmentAgreementTransaction(all=>all.find(a=>[...a.partners,...a.witnesses].some(p=>p.tokenHash===hash))??null);}
  private save(apply:(all:InvestmentAgreement[],now:string)=>Change){return this.demo.investmentAgreementTransaction((all,investments)=>{
    const now=new Date().toISOString(),change=apply(all,now),i=all.findIndex(a=>a.id===change.agreement.id);
    if(i<0)all.push(change.agreement);else all[i]=change.agreement;
    if(change.event==='FINALIZED')investments.push(...recordsFor(change.agreement,investments,change.agreement.finalizedAt!));
    return change;
  });}
  create(input:unknown,actor:Actor,key:string){const createKey=keyFor(actor,key);return this.save((all,now)=>{const prior=all.find(a=>a.createKey===createKey);return prior?{agreement:prior,event:'CREATED'}:createAgreement(input,actor,newPublicId(),createKey,now);});}
  join(token:string,actor:Actor){const hash=sha256(token);return this.save((all,now)=>joinAgreement(all.find(a=>[...a.partners,...a.witnesses].some(p=>p.tokenHash===hash))??null,token,actor,now));}
  change(id:string,actor:Actor,input:unknown,action:Action){return this.save((all,now)=>{const a=all.find(x=>x.id===id);if(!a||!isPerson(a,actor.userId))throw unavailable();return action(a,actor,input,now);});}
}
