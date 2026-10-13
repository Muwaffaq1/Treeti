import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { database } from '@/lib/database';
import { checkOrigin, failure, idempotencyKey, json, readBody } from '@/lib/http';
import { getRuntime, currentGrant, type DemoSession } from '@/lib/runtime';
import { readSession, signSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { sha256 } from '@/lib/crypto';
import { demonstrationGrant, demoEnabled, demoPeople, DemoRepository, findDemoInvitationWorkspace } from '@/modules/agreements/demo';
import { DomainError, member, projectAgreement, sensitiveActions } from '@/modules/agreements/domain';
import { PostgresRepository } from '@/modules/agreements/repository';
import { commandSchema,createSchema } from '@/modules/agreements/schema';
import {emailDeliveryAvailable,requireEmailDelivery} from '@/lib/contact-delivery';
import type { Aggregate } from '@/modules/agreements/types';
import { documentResponse } from '@/modules/documents/service';
import { proofUpload, proofResponse, validateProof } from '@/modules/documents/proofs';
import { verificationResult } from '@/modules/documents/verification';
import {debtRepository} from '@/modules/debts/repository';
import {investmentRepository} from '@/modules/investments/repository';
import {reminderCalendar} from '@/modules/debts/reminders';
import {queueAgreementDelivery,queueDebtReminder} from '@/modules/notifications/wakeups';
import {notices} from '@/modules/notifications/feed';
import {pushKeys,removeSubscription,saveSubscription} from '@/modules/notifications/push';

async function resolve(params:Promise<{path:string[]}>){const {path}=await params;const demo=path[0]==='demo';return {demo,path:demo?path.slice(1):path};}
async function invitationRepo(demo:boolean){
  if(demo)return (await getRuntime(true)).repo;
  if(!process.env.SUPABASE_DB_URL)throw new DomainError('SETUP_REQUIRED','Invitations will be available after treeti is connected.',503);
  return new PostgresRepository(database());
}
async function alignDemoSession(workspace:string) {
  const jar=await cookies(),existing=readSession<DemoSession>(jar.get('ahd_demo')?.value),repo=new DemoRepository(workspace),people=await repo.people();
  const actor=people.find(p=>p.userId===existing?.userId)??demoPeople[0];
  const session={workspace,userId:actor.userId,expiresAt:Date.now()+7*86400000};
  // Do not rewrite a same-workspace cookie: an automatic lookup may overlap a profile switch.
  if(existing?.workspace!==workspace||existing.expiresAt<Date.now()||!people.some(p=>p.userId===existing.userId))jar.set('ahd_demo',signSession(session),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:7*86400});
  return {repo,actor,people};
}
const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export async function GET(req:Request,{params}:{params:Promise<{path:string[]}>}){
  try{
    const {demo,path}=await resolve(params);
    if(path[0]==='invitations'&&path[1]){
      const token=tokenSchema.parse(path[1]);await rateLimit(`invite:${req.headers.get('x-forwarded-for')||'local'}`,30,demo);
      const requestedWorkspace=new URL(req.url).searchParams.get('workspace');
      const workspace=demo?(requestedWorkspace||await findDemoInvitationWorkspace(token)):null;
      const repo=workspace?new DemoRepository(workspace):await invitationRepo(demo);
      if(demo&&workspace) await alignDemoSession(workspace);
      const a=await repo.findInvitation(token),i=a?.invitations.find(i=>i.tokenHash===sha256(token));
      if(!a||['CANCELLED','DECLINED'].includes(a.status)||!i||!['PENDING','CLAIMED'].includes(i.status)||i.expiresAt<new Date().toISOString()||i.versionId!==a.currentVersionId)throw new DomainError('INVITATION_EXPIRED','This invitation is no longer active. Ask the inviter for a new link.',410);
      const p=a.participants.find(p=>p.id===i.participantId)!;
      const {maskContact}=await import('@/lib/contact');
      return json({role:p.role,contact:maskContact(i.destination),expiresAt:i.expiresAt,verificationAvailable:demo||emailDeliveryAvailable(i.destination)});
    }
    const {actor,repo,people,workspace}=await getRuntime(demo);
    if(path[0]==='push'&&path.length===1)return json({publicKey:demo?null:pushKeys()?.publicKey??null});
    if(path[0]==='notifications'&&path.length===1)return json({notices:notices((await repo.list(actor)).map(a=>projectAgreement(a,actor)),await repo.pendingInvitations(actor),actor)});
    if(path[0]==='debts'&&!path[1])return json({debts:await debtRepository(demo,workspace).listDebts(actor)});
    if(path[0]==='investments'&&path.length===1)return json({investments:await investmentRepository(demo,workspace).listInvestments(actor)});
    if(path[0]==='debts'&&path[2]==='reminder'&&path[3]==='calendar'){
      const debt=(await debtRepository(demo,workspace).listDebts(actor)).find(d=>d.id===z.string().uuid().parse(path[1]));
      if(!debt?.reminder)throw new DomainError('NOT_FOUND','This reminder is unavailable.',404);
      return new Response(reminderCalendar(debt.reminder),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="ahd-reminder.ics"','Cache-Control':'private, no-store'}});
    }
    if(demo&&path[0]==='verify'&&path[1]){const a=(await repo.list(actor)).find(a=>a.publicId===path[1]);return json(await verificationResult(a??null,true));}
    if(path[0]==='me')return json({actor,demo,people:demo?(people??demoPeople):[]});
    if(path[0]==='pending-invitations')return json({invitations:await repo.pendingInvitations(actor)});
    if(path[0]==='agreements'&&!path[1])return json({agreements:(await repo.list(actor)).map(a=>projectAgreement(a,actor)),actor,demo});
    if(path[0]==='agreements'&&path[1]){
      const a=await repo.get(z.string().uuid().parse(path[1]));if(!a||!member(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
      if(path[2]==='pdf'||path[2]==='receipt'||path[2]==='settlement'){
        await rateLimit(`pdf:${actor.userId}`,40,demo);return documentResponse(a,actor,path[2],new URL(req.url).searchParams.get('payment'));
      }
      if(path[2]==='proof'&&path[3])return proofResponse(a,actor,path[3]);
      if(path[2]==='manifest'){
        if(!a.manifest)throw new DomainError('NOT_FINALIZED','The evidence record is available after finalization.');
        if(member(a,actor)?.role==='WITNESS')throw new DomainError('PARTICIPANT_NOT_AUTHORIZED','The agreement PDF is available to witnesses; the full evidence bundle is private to the parties.',403);
        return json({manifest:a.manifest,events:a.events});
      }
      return json({agreement:projectAgreement(a,actor),actor,demo});
    }
    if(path[0]==='notifications'){
      const agreements=await repo.list(actor);
      const notifications=agreements.flatMap(a=>projectAgreement(a,actor).events.slice(-5).map(e=>({id:e.id,agreementId:a.id,publicId:a.publicId,type:e.type,createdAt:e.createdAt}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
      return json({notifications});
    }
    return json({message:'This page is unavailable.'},404);
  }catch(error){return failure(error);}
}
export async function POST(req:Request,{params}:{params:Promise<{path:string[]}>}){
  try{
    checkOrigin(req);const {demo,path}=await resolve(params);
    if(demo&&path[0]==='session'){
      if(!demoEnabled())throw new DomainError('DEMO_DISABLED','The demonstration is unavailable.',404);
      const data=z.object({userId:z.string().uuid().optional(),fresh:z.boolean().optional(),workspace:z.string().uuid().optional()}).parse(await readBody(req));
      const jar=await cookies(),existing=readSession<DemoSession>(jar.get('ahd_demo')?.value);
      const workspace=data.workspace??(!data.fresh&&existing&&existing.expiresAt>Date.now()?existing.workspace:randomUUID());
      const people=await new DemoRepository(workspace).people(),actor=people.find(p=>p.userId===data.userId)??demoPeople[0];
      const session={workspace,userId:actor.userId,expiresAt:Date.now()+7*86400000};
      jar.set('ahd_demo',signSession(session),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:7*86400});return json({ok:true});
    }
    if(demo&&path[0]==='invitations'&&path[1]&&path[2]==='claim'){
      const token=tokenSchema.parse(path[1]),requestedWorkspace=new URL(req.url).searchParams.get('workspace'),workspace=requestedWorkspace||await findDemoInvitationWorkspace(token);
      const aligned=workspace?await alignDemoSession(workspace):null;
      const runtime=aligned??await getRuntime(true);
      const a=await runtime.repo.claim(token,runtime.actor);return json({agreementId:a.id});
    }
    const {actor,repo,workspace:runtimeWorkspace}=await getRuntime(demo);await rateLimit(`command:${actor.userId}`,120,demo);
    if(path[0]==='push'&&path.length===2&&['subscribe','unsubscribe'].includes(path[1])){
      if(demo||!pushKeys())throw new DomainError('PUSH_UNAVAILABLE','Notifications on this device are not available yet.',404);
      if(path[1]==='subscribe')await saveSubscription(database(),actor.userId,await readBody(req));else await removeSubscription(database(),actor.userId,await readBody(req));
      return json({ok:true});
    }
    if(path[0]==='investments'){
      const investments=investmentRepository(demo,runtimeWorkspace);
      if(path.length===1)return json({investment:await investments.createInvestment(await readBody(req),actor,idempotencyKey(req))},201);
      if(path.length===2)return json({investment:await investments.changeInvestment(z.string().uuid().parse(path[1]),await readBody(req),actor,idempotencyKey(req))});
      throw new DomainError('NOT_FOUND','This investment action is unavailable.',404);
    }
    if(path[0]==='invitations'&&path[1]&&path[2]==='claim'){
      const a=await repo.claim(tokenSchema.parse(path[1]),actor);return json({agreementId:a.id});
    }
    if(path[0]==='pending-invitations'&&path[1]&&path[2]==='claim'){
      const a=await repo.claimPending(z.string().uuid().parse(path[1]),actor);return json({agreementId:a.id});
    }
    if(path[0]==='debts'){
      const debts=debtRepository(demo,runtimeWorkspace);
      if(!path[1])return json({debt:await debts.createDebt(await readBody(req),actor,idempotencyKey(req))},201);
      if(path[2]==='edit'&&path.length===3)return json({debt:await debts.editDebt(z.string().uuid().parse(path[1]),await readBody(req),actor,idempotencyKey(req))});
      if(path[2]==='payments')return json({debt:await debts.payDebt(z.string().uuid().parse(path[1]),await readBody(req),actor,idempotencyKey(req))});
      if(path[2]==='reminder'){const debt=await debts.setDebtReminder(z.string().uuid().parse(path[1]),await readBody(req),actor,idempotencyKey(req));if(!demo)queueDebtReminder(debt.reminder);return json({debt});}
      throw new DomainError('NOT_FOUND','This private debt action is unavailable.',404);
    }
    if(path[0]==='agreements'&&!path[1]){if(actor.needsName)throw new DomainError('NAME_REQUIRED','Add your name before creating an agreement.',422);const input=createSchema.parse(await readBody(req));if(!demo)requireEmailDelivery(input.borrowerContact);const key=idempotencyKey(req),result=await repo.create(input,actor,key);if(!demo)queueAgreementDelivery(result.agreement.id,actor.userId,key);return json({agreement:projectAgreement(result.agreement,actor)},201);}
    if(path[0]==='agreements'&&path[1]){
      const id=z.string().uuid().parse(path[1]);
      if(path[2]==='proof')return proofUpload(req,(await repo.get(id)) as Aggregate,actor);
      const input=commandSchema.parse(await readBody(req));
      if(input.action!==path[2])throw new DomainError('INVALID_ACTION','Reload the page and try again.',400);
      if(!demo){
        if(input.action==='invite-witness'&&input.contact)requireEmailDelivery(input.contact);
        if(input.action==='invite-witnesses')for(const witness of input.witnesses??[])requireEmailDelivery(witness.contact);
        if(input.action==='resend-invitation'){
          const a=await repo.get(id);if(!a||!member(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
          const recipient=a.participants.find(p=>p.id===input.targetId);if(recipient)requireEmailDelivery(recipient.contact);
        }
        if(['send','agree-and-send'].includes(input.action)){
          const a=await repo.get(id);if(!a||!member(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
          const borrower=a.participants.find(p=>p.role==='BORROWER');
          if(borrower)requireEmailDelivery(borrower.contact);
        }
      }
      if(input.proofId){const a=await repo.get(id);if(!a||!member(a,actor))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);await validateProof(input.proofId,a,actor);}
      // Demo verification is visibly simulated; no production route accepts it.
      let grant=sensitiveActions.has(input.action)?await currentGrant(actor):undefined;
      if(demo&&sensitiveActions.has(input.action)){const a=await repo.get(id);if(!a)throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);grant=demonstrationGrant(a,actor,input.action);}
      const key=idempotencyKey(req),result=await repo.command(id,input,actor,key,grant);
      if(!demo)queueAgreementDelivery(id,actor.userId,key);
      const workspace=demo?(await readSession<DemoSession>((await cookies()).get('ahd_demo')?.value))?.workspace:null;
      const invitationUrl=demo?'/demo/invite':'/invite';
      const makeUrl=(token:string)=>invitationUrl+'/'+token+(workspace?'?workspace='+workspace:'');
      const describe=(issued:{token:string;invitationId:string})=>{const invitation=result.agreement.invitations.find(i=>i.id===issued.invitationId),participant=invitation&&result.agreement.participants.find(p=>p.id===invitation.participantId);return {url:makeUrl(issued.token),participantId:participant?.id,name:participant?.name??'Intended recipient',role:participant?.role??'BORROWER'};};
      return json({agreement:projectAgreement(result.agreement,actor),invitation:result.invitation?describe(result.invitation):undefined,invitations:result.invitations?.map(describe)});
    }
    return json({message:'This action is unavailable.'},404);
  }catch(error){return failure(error);}
}
