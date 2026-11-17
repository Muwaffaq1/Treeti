'use client';
import {track} from '@/lib/analytics';
import Link from '@/components/app-link';
import {calendarDate} from '@/lib/calendar';
import {useState,useSyncExternalStore} from 'react';
import {useForm,useWatch,useFieldArray} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Copy,FileText,LockKeyhole,MessageCircle,Send,UserRound,Mail,UsersRound,NotebookPen,TriangleAlert} from '@/components/icons';
import {currencies,currencyNames} from '@/lib/currencies';
import {money,moneyInput,parseMoney,groupMoneyInput} from '@/lib/money';
import type {Actor,Aggregate,Terms} from '@/modules/agreements/types';
import {api,apiBase,appBase} from './client-api';
import {Button,DisclosureSummary,ErrorMessage,Field} from './ui';
import {affirmation,currentVersion,formatDate,interestWording} from './agreement-utils';
import {formatMoneyChange} from './money-input';
import {RepaymentSchedule} from './repayment-schedule';
import {recurringPlan,repaymentLabel} from '@/modules/agreements/repayment-plan';
import {termsSchema} from '@/modules/agreements/schema';
import {CreateBlanks} from './create-blanks';
const subscribeToHydration=()=>()=>{};
export const formSchema=(allowPhone:boolean)=>z.object({currency:z.enum(currencies),amount:z.string().refine(v=>{try{parseMoney(v);return true;}catch{return false;}},'Enter a positive amount with up to two decimal places.'),borrowerName:z.string().trim().min(2,'Enter the borrower’s full name.').max(120),borrowerContact:z.string().trim().refine(v=>z.email().safeParse(v).success||allowPhone&&/^\+[1-9]\d{7,14}$/.test(v),allowPhone?'Enter an email or a phone number with country code.':'Enter the borrower’s email address.'),agreementDate:z.string().min(10,'Choose an agreement date.'),dueDate:z.string(),purpose:z.string().max(200),additionalTerms:z.string().max(5000),repaymentPlan:z.enum(['SINGLE','WEEKLY','MONTHLY','CUSTOM']),paymentCount:z.string(),firstPaymentDate:z.string(),customPayments:z.array(z.object({dueDate:z.string(),amount:z.string()})),requiredWitnesses:z.string().regex(/^[012]$/),reason:z.string().max(2000)}).superRefine((v,ctx)=>{
  try{parseMoney(v.amount);}catch{return;}
  try{
    const result=termsSchema.safeParse(formTerms(v));
    const reported=new Set<string>();
    if(!result.success)for(const issue of result.error.issues){
      let path:(string|number)[]=['repaymentPlan'];
      if(issue.path[0]==='agreementDate')path=['agreementDate'];
      else if(issue.path[0]==='dueDate'&&v.repaymentPlan==='SINGLE')path=['dueDate'];
      else if(issue.path[0]==='installments'&&issue.path[1]==='payments'&&typeof issue.path[2]==='number'&&v.repaymentPlan==='CUSTOM')path=['customPayments',issue.path[2],issue.path[3]==='amountMinor'?'amount':'dueDate'];
      if(reported.has(path.join('.')))continue;
      reported.add(path.join('.'));
      ctx.addIssue({code:'custom',path,message:emptyDateMessage(v,path)??issue.message});
    }
  }catch(error){
    const blank=v.repaymentPlan==='CUSTOM'?v.customPayments.findIndex(p=>!p.amount.trim()||!p.dueDate):-1;
    if(blank>=0){const missingAmount=!v.customPayments[blank].amount.trim();ctx.addIssue({code:'custom',path:['customPayments',blank,missingAmount?'amount':'dueDate'],message:missingAmount?`Enter an amount for payment ${blank+1}.`:`Choose a date for payment ${blank+1}.`});return;}
    ctx.addIssue({code:'custom',path:[v.repaymentPlan==='CUSTOM'?'repaymentPlan':!v.firstPaymentDate?'firstPaymentDate':!/^\d+$/.test(v.paymentCount)||Number(v.paymentCount)<2||Number(v.paymentCount)>60?'paymentCount':'repaymentPlan'],message:(error as Error).message});}
});
export type Values=z.infer<ReturnType<typeof formSchema>>;
/** Names the date that is missing, so an empty field never shows the schema's generic message. */
function emptyDateMessage(v:Values,path:(string|number)[]){
  if(path[0]==='agreementDate'&&!v.agreementDate)return 'Choose an agreement date.';
  if(path[0]==='dueDate'&&!v.dueDate)return 'Choose a repayment due date.';
  if(path[0]==='customPayments'&&typeof path[1]==='number'&&path[2]==='dueDate'&&!v.customPayments[path[1]]?.dueDate)return `Choose a date for payment ${path[1]+1}.`;
}
export function formTerms(data:Values):Terms {
  const principalMinor=parseMoney(data.amount);
  const installments=data.repaymentPlan==='SINGLE'?undefined:data.repaymentPlan==='CUSTOM'?{frequency:'CUSTOM' as const,payments:data.customPayments.map(p=>({dueDate:p.dueDate,amountMinor:parseMoney(p.amount)}))}:recurringPlan(principalMinor,data.firstPaymentDate,Number(data.paymentCount),data.repaymentPlan);
  return {principalMinor,currency:data.currency,interestMinor:'0',agreementDate:data.agreementDate,dueDate:installments?.payments.at(-1)?.dueDate??data.dueDate,repaymentType:installments?'INSTALLMENTS':'SINGLE',...(installments?{installments}:{}),purpose:data.purpose,additionalTerms:data.additionalTerms,requiredWitnesses:Number(data.requiredWitnesses)};
}
export type InvitationLinkData={url:string;participantId?:string;name:string;role:'LENDER'|'BORROWER'|'WITNESS'};
export function InviteLink({url,name,role,note,shareMessage}:{url:string;name?:string;role?:InvitationLinkData['role'];note?:string;shareMessage?:string}){const [copied,setCopied]=useState(false),[error,setError]=useState('');return <div className="invite-link">{name&&<p className="invite-recipient"><strong>Send to {name}</strong>{role&&<span> · {role==='WITNESS'?'Witness':role==='LENDER'?'Lender':'Borrower'}</span>}</p>}<p>{note??`treeti does not email invitations. Send this private link to ${name||'them'} yourself. They verify their email before seeing the terms.`}</p><div className="share-row"><Button onClick={()=>{const link=new URL(url,window.location.origin).href,message=shareMessage?`${shareMessage} ${link}`:role==='WITNESS'?`Please review this agreement on treeti as a witness: ${link}`:`I’ve written down our agreement on treeti. Please review it here: ${link}`;track('invitation_shared',{method:'whatsapp'});window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');}}><MessageCircle size={17}/> Share on WhatsApp</Button><Button variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(new URL(url,window.location.origin).href);setCopied(true);track('invitation_shared',{method:'copy'});}catch{setError('Copy is unavailable. Open the invitation and copy the address from your browser.');}}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Link copied':'Copy link'}</Button><Link className="button button-ghost" href={url} target="_blank" rel="noreferrer">Open invitation <ArrowRight size={16}/></Link></div><ErrorMessage message={error}/><p className="sr-only" role="status">{copied?'Invitation link copied.':''}</p></div>;}
// Shown as visible choices: people did not find "Custom" when it sat inside a dropdown.
const repaymentChoices=[['SINGLE','One payment','The full amount on one date.'],['WEEKLY','Weekly installments','Equal payments every week.'],['MONTHLY','Monthly installments','Equal payments every month.'],['CUSTOM','Custom installments','You choose each date and amount.']] as const;
/** Creating and changing an agreement both use the fill-in-the-blank sentence (create-blanks.tsx). */
export function CreateAgreement({actor,demo,existing}:{actor:Actor;demo:boolean;existing?:Aggregate}){
  return <CreateBlanks actor={actor} demo={demo} existing={existing}/>;
}
export function InterestWordingWarning({words,reader}:{words:string[];reader:'LENDER'|'BORROWER'|'WITNESS'}){
  if(!words.length)return null;
  const quoted=words.slice(0,4).map(w=>`“${w}”`).join(', ');
  return <div className="callout pending interest-warning"><TriangleAlert size={20} aria-hidden/><p><strong>{reader==='LENDER'?'Your terms mention':'These terms mention'} {quoted}.</strong> treeti agreements must be interest-free: the borrower pays back only what they borrowed, with no interest, fees, penalties or other extra charges. {reader==='LENDER'?'Remove anything like that before you send.':reader==='BORROWER'?'If these terms ask you to pay back more than you borrowed, ask for a change instead of approving.':'If these terms ask the borrower to pay back more than they borrowed, decline to witness them.'}</p></div>;
}
function ShieldIcon(){return <span className="interest-icon"><Check size={20}/></span>;}
