import {Resend} from 'resend';
import type {Database} from '@/lib/database';
import {pushToUser} from '@/modules/notifications/push';
import type {TrustedChange} from './model';

const longDate=(iso:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(iso));

/** The one email treeti sends besides sign-in codes (ADR 022): an owner must not miss a request to see their records. */
export function accessRequestEmail(change:TrustedChange,base:string){
  const c=change.contact;
  return {
    subject:`${c.name} asked to see your debts on treeti`,
    text:`${c.name}, one of your trusted contacts on treeti, has asked to see your debts and loan agreements.\n\nIf you do nothing, they’ll be able to see them from ${longDate(c.opensAt!)}.\n\nIf you don’t want them to see your records yet, refuse the request before then:\n${base}/trusted-contacts\n\nYou can stop sharing or remove a trusted contact at any time.`,
  };
}

/** Tells the other side what changed. Delivery is best effort and never undoes the change. */
export async function sendTrustedAlerts(db:Database,change:TrustedChange){
  const c=change.contact;
  const push=(userId:string|null,body:string,url:string)=>userId?pushToUser(db,userId,{title:'treeti',body,url,tag:`trusted-${c.id}`}).catch(()=>{}):Promise.resolve();
  if(change.event==='ACCEPTED')await push(c.ownerId,`${c.name} accepted your trusted contact invitation.`,'/trusted-contacts');
  if(change.event==='SHARED')await push(c.contactUserId,`${c.ownerName} shared their debts with you.`,`/trusted-contacts/${c.id}`);
  if(change.event==='REFUSED'||change.event==='STOPPED')await push(c.contactUserId,`${c.ownerName} isn’t sharing their debts with you right now.`,'/trusted-contacts');
  if(change.event!=='REQUESTED')return {emailed:false};
  await push(c.ownerId,`${c.name} asked to see your debts.`,'/trusted-contacts');
  if(!process.env.RESEND_API_KEY||!process.env.AHD_EMAIL_FROM||!process.env.AHD_APP_URL)return {emailed:false};
  try{
    const message=accessRequestEmail(change,new URL(process.env.AHD_APP_URL).origin);
    const {error}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.AHD_EMAIL_FROM,to:c.ownerEmail,...message},{idempotencyKey:`trusted-request-${c.id}-${c.requestedAt}`});
    return {emailed:!error};
  }catch{return {emailed:false};}
}
