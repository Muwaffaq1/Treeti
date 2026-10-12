import {z} from 'zod';
import {calendarDate} from '@/lib/calendar';
import {calendarDateSchema} from '@/lib/installment-schema';
import {currencies} from '@/lib/currencies';
import {DomainError} from '@/lib/domain-error';

const amount=z.string().regex(/^[1-9]\d{0,13}$/, 'Enter an amount greater than zero.').refine(v=>/^[1-9]\d{0,13}$/.test(v)&&BigInt(v)<=99999999999999n,'Amount is too large.');
const metadata=z.object({name:z.string().trim().min(2,'Add an investment name or place.').max(120),currency:z.enum(currencies),note:z.string().trim().max(2000).default('')}).strict();
const contribution=z.object({amountMinor:amount,date:calendarDateSchema,note:z.string().trim().max(2000).default('')}).strict();
const revision=z.number().int().nonnegative();
export const investmentInput=metadata.extend({amountMinor:amount,date:calendarDateSchema});
export const investmentChange=z.discriminatedUnion('action',[
  metadata.extend({action:z.literal('edit'),expectedRevision:revision}),
  contribution.extend({action:z.literal('contribute'),expectedRevision:revision}),
  contribution.extend({action:z.literal('edit-contribution'),contributionId:z.string().uuid(),expectedRevision:revision}),
  z.object({action:z.literal('archive'),archived:z.boolean(),expectedRevision:revision}).strict(),
]);
export type InvestmentContribution=z.infer<typeof contribution>&{id:string;createdAt:string;updatedAt?:string};
export type Investment=z.infer<typeof metadata>&{id:string;ownerId:string;createdAt:string;updatedAt:string;revision:number;archived:boolean;contributions:InvestmentContribution[]};
export function investmentTotal(record:Investment){return record.contributions.reduce((total,c)=>total+BigInt(c.amountMinor),0n).toString();}
export function investmentTotals(records:Investment[]){
  const totals=new Map<string,bigint>();
  for(const record of records)if(!record.archived)totals.set(record.currency,(totals.get(record.currency)??0n)+BigInt(investmentTotal(record)));
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,total])=>({currency,amountMinor:total.toString()}));
}
function validDate(date:string,now:string){if(date>calendarDate(now))throw new DomainError('DATE_FUTURE','Choose an investment date of today or earlier.',422);}
export function createInvestment(input:unknown,ownerId:string,id:string,contributionId:string,now:string):Investment{
  const {amountMinor,date,...data}=investmentInput.parse(input);validDate(date,now);
  return {...data,id,ownerId,createdAt:now,updatedAt:now,revision:0,archived:false,contributions:[{id:contributionId,amountMinor,date,note:'',createdAt:now}]};
}
export function changeInvestment(record:Investment,input:unknown,ownerId:string,contributionId:string,now:string):Investment{
  if(record.ownerId!==ownerId)throw new DomainError('NOT_FOUND','This investment record is unavailable.',404);
  const change=investmentChange.parse(input);
  if(change.expectedRevision!==record.revision)throw new DomainError('INVESTMENT_CHANGED','This investment changed since you opened it. Load the latest records and try again.',409);
  const next={...record,revision:record.revision+1,updatedAt:now};
  if(change.action==='archive')return {...next,archived:change.archived};
  if(change.action==='edit'){
    if(change.currency!==record.currency&&record.contributions.length>1)throw new DomainError('CURRENCY_HAS_CONTRIBUTIONS','The currency cannot change after additional contributions are recorded. Use a separate record for another currency.',422);
    return {...next,name:change.name,currency:change.currency,note:change.note};
  }
  if(record.archived)throw new DomainError('INVESTMENT_ARCHIVED','Restore this investment before changing contributions.',422);
  validDate(change.date,now);
  if(change.action==='contribute'){
    if(record.contributions.length>=1000)throw new DomainError('CONTRIBUTION_LIMIT','This record has reached its contribution limit. Start another investment record.',422);
    return {...next,contributions:[...record.contributions,{id:contributionId,amountMinor:change.amountMinor,date:change.date,note:change.note,createdAt:now}]};
  }
  if(!record.contributions.some(c=>c.id===change.contributionId))throw new DomainError('NOT_FOUND','This contribution is unavailable.',404);
  return {...next,contributions:record.contributions.map(c=>c.id===change.contributionId?{...c,amountMinor:change.amountMinor,date:change.date,note:change.note,updatedAt:now}:c)};
}
