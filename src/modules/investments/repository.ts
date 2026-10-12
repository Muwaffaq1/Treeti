import {randomUUID} from 'node:crypto';
import {database,type Database} from '@/lib/database';
import {DomainError} from '@/lib/domain-error';
import type {Actor} from '@/modules/agreements/types';
import {DemoRepository} from '@/modules/agreements/demo';
import {PostgresRepository} from '@/modules/agreements/repository';
import {createInvestment,changeInvestment,type Investment} from './model';

export interface InvestmentRepository{
  listInvestments(actor:Actor):Promise<Investment[]>;
  createInvestment(input:unknown,actor:Actor,key:string):Promise<Investment>;
  changeInvestment(id:string,input:unknown,actor:Actor,key:string):Promise<Investment>;
}
export function investmentRepository(demo:boolean,workspace?:string):InvestmentRepository{
  if(demo){if(!workspace)throw new DomainError('AUTH_REQUIRED','Open the demonstration to continue.',401);return new DemoRepository(workspace);}
  return new PostgresInvestmentRepository(database());
}
export class PostgresInvestmentRepository implements InvestmentRepository{
  constructor(private db:Database){}
  async listInvestments(actor:Actor){const rows=await this.db.query<{data:Investment}>('select data from personal_investments where owner_id=$1 order by created_at desc,id',[actor.userId]);return rows.map(r=>r.data);}
  async createInvestment(input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-investment-create',input,async()=>{
    const record=createInvestment(input,actor.userId,randomUUID(),randomUUID(),await new PostgresRepository(db).now(db));
    await db.query('insert into personal_investments(id,owner_id,currency,revision,created_at,data) values($1,$2,$3,$4,$5,$6)',[record.id,record.ownerId,record.currency,record.revision,record.createdAt,JSON.stringify(record)]);
    return record;
  }));}
  async changeInvestment(id:string,input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-investment-change',{id,input},async()=>{
    const [row]=await db.query<{data:Investment}>('select data from personal_investments where id=$1 and owner_id=$2 for update',[id,actor.userId]);
    if(!row)throw new DomainError('NOT_FOUND','This investment record is unavailable.',404);
    const record=changeInvestment(row.data,input,actor.userId,randomUUID(),await new PostgresRepository(db).now(db));
    await db.query('update personal_investments set currency=$1,revision=$2,data=$3 where id=$4 and owner_id=$5',[record.currency,record.revision,JSON.stringify(record),id,actor.userId]);
    return record;
  }));}
}
