import type {Actor,Aggregate} from '@/modules/agreements/types';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';

import type {Database} from '@/lib/database';

export type Notice={id:string;type:string;by:string;agreementId:string|null;publicId:string;createdAt:string;text?:string};
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

/**
 * The same list for a signed-in person, read from the notifications the outbox already recorded.
 * One indexed query: loading every agreement in full on each page was too heavy for the Worker.
 */
export async function recordedNotices(db:Database,userId:string,limit=40):Promise<Notice[]>{
  const rows=await db.query<{id:string;type:string|null;by:string|null;agreement_id:string;public_id:string;created_at:Date|string;message:string}>(`
    select n.id,e.data->>'type' as type,p.data->>'name' as by,n.agreement_id,a.public_id,n.created_at,n.message
    from notifications n
    join agreements a on a.id=n.agreement_id
    join agreement_participants me on me.agreement_id=n.agreement_id and me.user_id=n.user_id
    left join agreement_events e on e.id=n.event_id
    left join agreement_participants p on p.agreement_id=n.agreement_id and p.id::text=e.data->>'actorId'
    where n.user_id=$1 and (e.id is null or e.data->>'actorId' is distinct from me.id::text)
    order by n.created_at desc,n.id limit $2`,[userId,limit]);
  return rows.map(r=>({id:r.id,type:r.type??'',by:r.by??'',agreementId:r.agreement_id,publicId:r.public_id,createdAt:new Date(r.created_at).toISOString(),text:r.message}));
}
