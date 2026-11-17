import {z} from 'zod';
import {DomainError} from '@/lib/domain-error';
import {json,readBody} from '@/lib/http';
import {rateLimit} from '@/lib/rate-limit';
import {maskContact} from '@/lib/contact';
import type {Actor} from '@/modules/agreements/types';
import {sha256} from '@/lib/crypto';
import {actions,isMember,latest,viewFor,yourTurn,type ActionName,type Change,type InvestmentAgreement} from './model';
import {investmentAgreementRepository,type InvestmentAgreementRepository} from './repository';

const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const jointInvitationUrl=(token:string,demo:boolean)=>`${demo?'/demo':''}/joint/${token}`;
const linksOf=(change:Change,demo:boolean)=>(change.links??[]).map(l=>({personId:l.personId,name:l.name,role:l.role,url:jointInvitationUrl(l.token,demo)}));
export const summaries=(all:InvestmentAgreement[],actor:Actor)=>all.map(a=>({...viewFor(a,actor),turn:yourTurn(a,actor)}));
export type Summary=ReturnType<typeof summaries>[number];

/** Who sent an invitation and which contact to sign in with, safe to show before joining. */
export async function invitationSummary(repo:InvestmentAgreementRepository,token:string){
  if(!tokenSchema.safeParse(token).success)return null;
  const a=await repo.byToken(token);if(!a||['DECLINED','CANCELLED'].includes(a.status))return null;
  const hash=sha256(token),partner=a.partners.find(p=>p.tokenHash===hash),invited=partner??a.witnesses.find(w=>w.tokenHash===hash);
  if(!invited||invited.userId)return null;
  return {writer:a.partners.find(p=>p.creator)!.name,venture:latest(a).terms.venture,role:partner?'PARTNER' as const:'WITNESS' as const,maskedContact:maskContact(invited.contact)};
}

export async function jointGet(path:string[],actor:Actor,demo:boolean,workspace?:string){
  const repo=investmentAgreementRepository(demo,workspace);
  if(path.length===1)return json({agreements:summaries(await repo.list(actor),actor)});
  const id=z.uuid().parse(path[1]),a=await repo.get(id);
  if(!a||!isMember(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
  if(path.length===2)return json({agreement:{...viewFor(a,actor),turn:yourTurn(a,actor)}});
  if(path[2]==='pdf'&&path.length===3){await rateLimit(`pdf:${actor.userId}`,40,demo);return (await import('./document')).investmentAgreementResponse(a,actor,demo);}
  throw new DomainError('NOT_FOUND','This page is unavailable.',404);
}

export async function jointPost(req:Request,path:string[],actor:Actor,demo:boolean,workspace?:string){
  const repo=investmentAgreementRepository(demo,workspace);
  await rateLimit(`command:${actor.userId}`,120,demo);
  if(path.length===1){
    if(actor.needsName)throw new DomainError('NAME_REQUIRED','Add your name before writing an agreement.',422);
    await rateLimit(`joint-create:${actor.userId}`,10,demo);
    const key=req.headers.get('Idempotency-Key')??crypto.randomUUID();
    const change=await repo.create(await readBody(req),actor,key);
    return json({agreement:{...viewFor(change.agreement,actor),turn:yourTurn(change.agreement,actor)},links:linksOf(change,demo)},201);
  }
  if(path[1]==='join'&&path.length===3){
    const change=await repo.join(tokenSchema.parse(path[2]),actor);
    return json({id:change.agreement.id});
  }
  const id=z.uuid().parse(path[1]),name=path[2] as ActionName;
  if(path.length!==3||!(name in actions))throw new DomainError('NOT_FOUND','This action is unavailable.',404);
  const change=await repo.change(id,actor,await readBody(req),actions[name]);
  return json({agreement:{...viewFor(change.agreement,actor),turn:yourTurn(change.agreement,actor)},links:linksOf(change,demo)});
}
