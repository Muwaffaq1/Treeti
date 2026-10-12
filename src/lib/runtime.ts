import {profileName} from './profile-name';
import { cookies } from 'next/headers';
import { database } from './database';
import { readSession } from './session';
import { supabaseServer, authConfigured } from './supabase/server';
import { DemoRepository, demoEnabled } from '@/modules/agreements/demo';
import { PostgresRepository, type Repository } from '@/modules/agreements/repository';
import { DomainError } from '@/modules/agreements/domain';
import type { Actor, Context } from '@/modules/agreements/types';
export type DemoSession={ workspace:string;userId:string;expiresAt:number };
export async function getRuntime(demo:boolean):Promise<{actor:Actor;repo:Repository;demo:boolean;people?:Actor[];workspace?:string}> {
  if(demo){
    if(!demoEnabled())throw new DomainError('DEMO_DISABLED','The demonstration is unavailable.',404);
    const session=readSession<DemoSession>((await cookies()).get('ahd_demo')?.value);
    if(!session||session.expiresAt<Date.now())throw new DomainError('AUTH_REQUIRED','Open a fresh demonstration to continue.',401);
    const repo=new DemoRepository(session.workspace),people=await repo.people(),actor=people.find(p=>p.userId===session.userId);
    if(!actor)throw new DomainError('AUTH_REQUIRED','Open a fresh demonstration to continue.',401);
    return {actor,repo,demo:true,people,workspace:session.workspace};
  }
  if(!authConfigured()||!process.env.SUPABASE_DB_URL)throw new DomainError('SETUP_REQUIRED','treeti is waiting for its Supabase configuration. You can explore the local demonstration meanwhile.',503);
  const supabase=await supabaseServer(),{data:{user},error}=await supabase.auth.getUser();
  if(error||!user)throw new DomainError('AUTH_REQUIRED','Sign in to see your private agreements.',401);
  const contacts=[user.email_confirmed_at?user.email:null,user.phone_confirmed_at?(user.phone?.startsWith('+')?user.phone:`+${user.phone}`):null].filter(Boolean) as string[];
  if(!contacts.length)throw new DomainError('VERIFICATION_REQUIRED','Verify your email address or phone number to continue.',403);
  const savedName=profileName(user.user_metadata);
  const actor:Actor={userId:user.id,name:savedName||contacts[0],contacts,demo:false,needsName:!savedName};
  return {actor,repo:new PostgresRepository(database()),demo:false};
}
export async function currentGrant(actor:Actor):Promise<Context['stepUp']> {
  const s=readSession<NonNullable<Context['stepUp']>&{userId:string}>((await cookies()).get('ahd_grant')?.value);
  return s?.userId===actor.userId?s:undefined;
}
