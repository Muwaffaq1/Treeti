import {z} from 'zod';
import {database} from '@/lib/database';
import {DomainError} from '@/lib/domain-error';
import {json,readBody} from '@/lib/http';
import {rateLimit} from '@/lib/rate-limit';
import type {Actor} from '@/modules/agreements/types';
import {documentResponse} from '@/modules/documents/service';
import {DemoRepository} from '@/modules/agreements/demo';
import {PostgresRepository} from '@/modules/agreements/repository';
import {access,closeAccess,contactView,ownerView,removeContact,renewLink,requestAccess,shareNow,type TrustedChange,type TrustedContact} from './model';
import {sendTrustedAlerts} from './alerts';
import {trustedRepository,type TrustedAction,type TrustedRepository} from './repository';

const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const actions:Record<string,TrustedAction>={renew:renewLink,request:requestAccess,close:closeAccess,share:shareNow,remove:removeContact};
export const trustedInvitationUrl=(token:string,demo:boolean)=>`${demo?'/demo':''}/trusted/${token}`;

/** Loads a contact for the person they trust, only while that person's records are open to them. */
export async function openContact(repo:TrustedRepository,id:string,actor:Actor){
  const contact=await repo.byId(id);
  if(!contact||contact.status!=='ACCEPTED'||contact.contactUserId!==actor.userId)throw new DomainError('NOT_FOUND','This trusted contact is unavailable.',404);
  if(access(contact,await repo.now())!=='OPEN')throw new DomainError('ACCESS_NOT_OPEN','These records aren’t shared with you yet.',403);
  return contact;
}
export async function lists(repo:TrustedRepository,actor:Actor){
  const now=await repo.now(),{owned,trustedBy}=await repo.list(actor);
  return {owned:owned.map(c=>ownerView(c,now)),trustedBy:trustedBy.map(c=>contactView(c,now))};
}
async function alert(demo:boolean,change:TrustedChange){if(!demo)await sendTrustedAlerts(database(),change);}

export async function trustedGet(path:string[],actor:Actor,demo:boolean,workspace?:string){
  const repo=trustedRepository(demo,workspace);
  if(path.length===1)return json(await lists(repo,actor));
  const id=z.uuid().parse(path[1]);
  if(path[2]==='records'&&path.length===3){const contact=await openContact(repo,id,actor);return json({records:await repo.records(contact)});}
  if(path[2]==='agreements'&&path[4]==='pdf'&&path.length===5){
    const contact=await openContact(repo,id,actor),agreementId=z.uuid().parse(path[3]);
    if(!(await repo.records(contact)).agreements.some(a=>a.id===agreementId))throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
    await rateLimit(`pdf:${actor.userId}`,40,demo);
    const agreement=await (demo?new DemoRepository(workspace!):new PostgresRepository(database())).get(agreementId);
    if(!agreement)throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
    // The PDF is the owner's own copy; access was checked above.
    return documentResponse(agreement,{userId:contact.ownerId,name:contact.ownerName,contacts:[contact.ownerEmail],demo},'pdf');
  }
  throw new DomainError('NOT_FOUND','This page is unavailable.',404);
}

export async function trustedPost(req:Request,path:string[],actor:Actor,demo:boolean,workspace?:string){
  const repo=trustedRepository(demo,workspace);
  if(path.length===1){
    if(actor.needsName)throw new DomainError('NAME_REQUIRED','Add your name before adding a trusted contact.',422);
    await rateLimit(`trusted-invite:${actor.userId}`,10,demo);
    const change=await repo.invite(await readBody(req),actor);
    return json({...await lists(repo,actor),invitation:{url:trustedInvitationUrl(change.token!,demo),name:change.contact.name}},201);
  }
  if(path[1]==='accept'&&path.length===3){
    const change=await repo.accept(tokenSchema.parse(path[2]),actor);await alert(demo,change);
    return json({id:change.contact.id});
  }
  const id=z.uuid().parse(path[1]),action=actions[path[2]];
  if(!action||path.length!==3)throw new DomainError('NOT_FOUND','This action is unavailable.',404);
  // A request emails the owner, so keep repeated requests rare.
  if(path[2]==='request')await rateLimit(`trusted-request:${actor.userId}`,3,demo);
  const change=await repo.change(id,actor,action);await alert(demo,change);
  return json({...await lists(repo,actor),invitation:change.token?{url:trustedInvitationUrl(change.token,demo),name:change.contact.name}:undefined});
}
export type TrustedLists=Awaited<ReturnType<typeof lists>>;
export type {TrustedContact};
