import type {Actor,Aggregate} from '@/modules/agreements/types';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';

export type Notice={id:string;type:string;by:string;agreementId:string|null;publicId:string;createdAt:string};
// Bookkeeping events that need nobody's attention.
const quiet=new Set(['AGREEMENT_CREATED','INVITATION_RESENT','INVITATION_CLAIMED','WITNESS_INVITED']);

/** What other people did on the agreements this person belongs to, newest first. Never includes their own actions. */
export function notices(agreements:Aggregate[],pending:PendingBorrowerInvitation[],actor:Actor,limit=40):Notice[]{
  const fromAgreements=agreements.flatMap(a=>{
    const me=a.participants.find(p=>p.userId===actor.userId);if(!me)return [];
    return a.events.filter(e=>e.actorId!==me.id&&!quiet.has(e.type)).map(e=>({id:e.id,type:e.type,by:a.participants.find(p=>p.id===e.actorId)?.name??'',agreementId:a.id,publicId:a.publicId,createdAt:e.createdAt}));
  });
  const invited=pending.map(i=>({id:i.id,type:'INVITED_TO_REVIEW',by:i.lenderName,agreementId:null,publicId:i.publicId,createdAt:i.createdAt}));
  return [...fromAgreements,...invited].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit);
}
