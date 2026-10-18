import {latest} from '@/modules/agreements/domain';
import type {Aggregate,Status} from '@/modules/agreements/types';
import {debtRemaining,type PersonalDebt} from '@/modules/debts/model';

/** Agreements that record money actually owed: proposals, drafts and cancelled records are left out. */
const recorded:Status[]=['ACTIVE','SETTLEMENT_PENDING','SETTLED'];

export type SharedAgreement={id:string;publicId:string;ownerRole:'LENDER'|'BORROWER';otherName:string;currency:string;principalMinor:string;remainingMinor:string;agreementDate:string;dueDate:string;status:Status};
export type SharedDebt={id:string;person:string;currency:string;amountMinor:string;remainingMinor:string;date:string;dueDate:string|null;witnesses:string[]};
export type SharedRecords={ownerName:string;agreements:SharedAgreement[];debts:SharedDebt[]};

/**
 * The read-only view a trusted contact gets of the owner's records. It carries names, amounts and dates
 * only: no contact details, notes, evidence or repayment proofs of anyone involved.
 */
export function sharedRecords(ownerId:string,ownerName:string,agreements:Aggregate[],debts:PersonalDebt[]):SharedRecords{
  return {
    ownerName,
    agreements:agreements.flatMap(a=>{
      const owner=a.participants.find(p=>p.userId===ownerId);
      if(!owner||(owner.role!=='LENDER'&&owner.role!=='BORROWER')||!recorded.includes(a.status))return [];
      const terms=latest(a).terms,other=a.participants.find(p=>p.role===(owner.role==='LENDER'?'BORROWER':'LENDER'));
      return [{id:a.id,publicId:a.publicId,ownerRole:owner.role,otherName:other?.name??'',currency:terms.currency,principalMinor:terms.principalMinor,remainingMinor:a.status==='SETTLED'?'0':a.balanceMinor,agreementDate:terms.agreementDate,dueDate:terms.dueDate,status:a.status}];
    }).sort((x,y)=>x.dueDate.localeCompare(y.dueDate)),
    debts:debts.filter(d=>d.ownerId===ownerId).map(d=>({id:d.id,person:d.person,currency:d.currency,amountMinor:d.amountMinor,remainingMinor:debtRemaining(d),date:d.date,dueDate:d.dueDate??d.installments?.payments.at(-1)?.dueDate??null,witnesses:d.witnesses??[]})),
  };
}
