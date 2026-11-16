import {z} from 'zod';
import {calendarDate} from '@/lib/calendar';
import {calendarDateSchema} from '@/lib/installment-schema';
import {currencies} from '@/lib/currencies';
import {DomainError} from '@/lib/domain-error';

const amount=z.string().regex(/^[1-9]\d{0,13}$/, 'Enter an amount greater than zero.').refine(v=>!/^[1-9]\d{0,13}$/.test(v)||BigInt(v)<=99999999999999n,'Amount is too large.');
/** Other people in a shared investment, each with a whole-number share; the owner keeps the rest (owner, Nov 2026). Private: nobody is contacted. */
export const investmentPartnerLimit=5;
const partner=z.object({name:z.string().trim().min(2,'Add each person’s full name.').max(120),share:z.number().int('Use whole percentages.').min(1,'Each share must be at least 1%.').max(99,'Each share must be 99% or less.')}).strict();
const sharing={partners:z.array(partner).max(investmentPartnerLimit,`Add up to ${investmentPartnerLimit} people.`).optional(),myShare:z.number().int('Use whole percentages.').min(1,'Your share must be at least 1%.').max(100).optional()};
const metadata=z.object({name:z.string().trim().min(2,'Add an investment name or place.').max(120),currency:z.enum(currencies),note:z.string().trim().max(2000).default(''),...sharing}).strict();
export type InvestmentPartner=z.infer<typeof partner>;
/** Applies a sharing change: none clears it, otherwise the shares must add up to 100%. */
function withShares<T extends {partners?:InvestmentPartner[];myShare?:number}>(record:T,partners:InvestmentPartner[],myShare?:number):T{
  const {partners:_p,myShare:_m,...rest}=record;void _p;void _m;
  if(!partners.length)return rest as T;
  const total=partners.reduce((sum,p)=>sum+p.share,myShare??0);
  if(myShare===undefined||total!==100)throw new DomainError('SHARES_TOTAL','Shares must add up to 100%. Check each person’s share and yours.',422);
  return {...rest,partners,myShare} as T;
}
export const isShared=(record:Pick<Investment,'partners'>)=>(record.partners?.length??0)>0;
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
/** agreementId links a record made by a signed investment agreement; its shares and currency follow that agreement. */
export type Investment=z.infer<typeof metadata>&{id:string;ownerId:string;createdAt:string;updatedAt:string;revision:number;archived:boolean;contributions:InvestmentContribution[];agreementId?:string;agreementPublicId?:string};
export function investmentTotal(record:Investment){return record.contributions.reduce((total,c)=>total+BigInt(c.amountMinor),0n).toString();}
export function investmentTotals(records:Investment[]){
  const totals=new Map<string,bigint>();
  for(const record of records)if(!record.archived)totals.set(record.currency,(totals.get(record.currency)??0n)+BigInt(investmentTotal(record)));
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,total])=>({currency,amountMinor:total.toString()}));
}
function validDate(date:string,now:string){if(date>calendarDate(now))throw new DomainError('DATE_FUTURE','Choose an investment date of today or earlier.',422);}
export function createInvestment(input:unknown,ownerId:string,id:string,contributionId:string,now:string):Investment{
  const {amountMinor,date,partners=[],myShare,...data}=investmentInput.parse(input);validDate(date,now);
  return withShares({...data,id,ownerId,createdAt:now,updatedAt:now,revision:0,archived:false,contributions:[{id:contributionId,amountMinor,date,note:'',createdAt:now}]} as Investment,partners,myShare);
}
export function changeInvestment(record:Investment,input:unknown,ownerId:string,contributionId:string,now:string):Investment{
  if(record.ownerId!==ownerId)throw new DomainError('NOT_FOUND','This investment record is unavailable.',404);
  const change=investmentChange.parse(input);
  if(change.expectedRevision!==record.revision)throw new DomainError('INVESTMENT_CHANGED','This investment changed since you opened it. Load the latest records and try again.',409);
  const next={...record,revision:record.revision+1,updatedAt:now};
  if(change.action==='archive')return {...next,archived:change.archived};
  if(change.action==='edit'){
    if(record.agreementId&&(change.currency!==record.currency||(change.partners!==undefined&&(JSON.stringify(change.partners)!==JSON.stringify(record.partners??[])||change.myShare!==record.myShare))))throw new DomainError('AGREEMENT_TERMS','The currency and shares come from the signed agreement. Change them by agreeing a new one.',422);
    if(change.currency!==record.currency&&record.contributions.length>1)throw new DomainError('CURRENCY_HAS_CONTRIBUTIONS','The currency cannot change after additional contributions are recorded. Use a separate record for another currency.',422);
    const edited={...next,name:change.name,currency:change.currency,note:change.note};
    // Leaving partners out keeps the current sharing, so older edit forms can't wipe it.
    return change.partners===undefined?edited:withShares(edited,change.partners,change.myShare);
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
