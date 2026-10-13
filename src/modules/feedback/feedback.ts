import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database} from '@/lib/database';
import type {Actor} from '@/modules/agreements/types';
import {profileName} from '@/lib/profile-name';

export const feedbackSchema=z.object({
  rating:z.number().int().min(1).max(5).nullish(),
  message:z.string().trim().max(2000,'Keep your message under 2,000 characters.').default(''),
  page:z.string().max(200).regex(/^\/[^\s]*$/).nullish(),
}).refine(v=>v.rating!=null||v.message.length>0,{message:'Choose a rating or write a message.',path:['message']});
export type Feedback={id:string;rating:number|null;message:string;page:string|null;createdAt:string;from:string;contact:string};

/** The operator's own sign-in addresses, from AHD_OWNER_EMAILS (comma separated). Only they can read feedback. */
export const ownerEmails=()=>(process.env.AHD_OWNER_EMAILS??'').split(',').map(e=>e.trim().toLowerCase()).filter(e=>e.includes('@'));
export const isOwner=(actor:Pick<Actor,'contacts'|'demo'>)=>!actor.demo&&actor.contacts.some(c=>ownerEmails().includes(c.trim().toLowerCase()));

export async function saveFeedback(db:Database,userId:string,input:unknown){
  const {rating,message,page}=feedbackSchema.parse(input),id=randomUUID();
  await db.query('insert into feedback (id,user_id,rating,message,page) values ($1,$2,$3,$4,$5)',[id,userId,rating??null,message,page??null]);
  return id;
}
export async function listFeedback(db:Database,limit=100):Promise<Feedback[]>{
  const rows=await db.query<{id:string;rating:number|null;message:string;page:string|null;created_at:string|Date;email:string|null;meta:{full_name?:unknown}|null}>(
    'select f.id,f.rating,f.message,f.page,f.created_at,u.email,u.raw_user_meta_data as meta from feedback f left join auth.users u on u.id=f.user_id order by f.created_at desc,f.id limit $1',[limit]);
  return rows.map(r=>({id:r.id,rating:r.rating,message:r.message,page:r.page,createdAt:new Date(r.created_at).toISOString(),from:profileName(r.meta)??'',contact:r.email??''}));
}
/** Accounts to alert when feedback arrives. */
export async function ownerUserIds(db:Database):Promise<string[]>{
  const emails=ownerEmails();if(!emails.length)return [];
  return (await db.query<{id:string}>('select id from auth.users where lower(email)=any($1) and email_confirmed_at is not null',[emails])).map(r=>r.id);
}

// The demonstration keeps feedback in memory, per workspace, so the screens can be tried without a database.
// Kept on globalThis because the page and the API are bundled separately and must share it.
const demoFeedback=((globalThis as {treetiDemoFeedback?:Map<string,Feedback[]>}).treetiDemoFeedback??=new Map<string,Feedback[]>());
export function saveDemoFeedback(workspace:string,actor:Pick<Actor,'name'|'contacts'>,input:unknown){
  const {rating,message,page}=feedbackSchema.parse(input),list=demoFeedback.get(workspace)??[];
  list.unshift({id:randomUUID(),rating:rating??null,message,page:page??null,createdAt:new Date().toISOString(),from:actor.name,contact:actor.contacts[0]??''});
  demoFeedback.set(workspace,list.slice(0,50));
  if(demoFeedback.size>500)demoFeedback.delete(demoFeedback.keys().next().value!);
}
export const listDemoFeedback=(workspace:string)=>demoFeedback.get(workspace)??[];
