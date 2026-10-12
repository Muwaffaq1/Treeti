import type {Actor,Aggregate} from './types';
export type PendingBorrowerInvitation={id:string;publicId:string;lenderName:string;createdAt:string};
// A minimal inbox projection: no terms, contacts, tokens, or evidence before review.
export function pendingBorrowerInvitations(a:Aggregate,actor:Actor,now=new Date().toISOString()):PendingBorrowerInvitation[]{
  if(['DRAFT','CANCELLED','DECLINED'].includes(a.status)||a.participants.some(p=>p.userId===actor.userId))return [];
  const contacts=actor.contacts.map(c=>c.trim().toLowerCase());
  return a.invitations.filter(i=>i.status==='PENDING'&&i.expiresAt>now&&i.versionId===a.currentVersionId&&contacts.includes(i.destination.trim().toLowerCase())&&a.participants.some(p=>p.id===i.participantId&&p.role==='BORROWER'&&!p.userId)).map(i=>({id:i.id,publicId:a.publicId,lenderName:a.participants.find(p=>p.role==='LENDER')?.name??'Your lender',createdAt:i.createdAt}));
}
