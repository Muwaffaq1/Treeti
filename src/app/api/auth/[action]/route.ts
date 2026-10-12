import {profileName} from '@/lib/profile-name';
import { maskContact } from '@/lib/contact';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { supabaseServer, authConfigured } from '@/lib/supabase/server';
import { checkOrigin, failure, json, readBody } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { readSession, signSession } from '@/lib/session';
import { contactSchema } from '@/modules/agreements/schema';
import { DomainError } from '@/modules/agreements/domain';
import {database} from '@/lib/database';
import {PostgresRepository} from '@/modules/agreements/repository';
import {witnessInvitation} from '@/lib/invitation-access';
import {authReturnPath} from '@/lib/auth-return';
import {requireEmailDelivery} from '@/lib/contact-delivery';
import type {Actor} from '@/modules/agreements/types';
export type Challenge={contact:string;name:string;userId:string|null;agreementId:string|null;versionId:string|null;action:string|null;expiresAt:number;invitationToken?:string;returnTo?:string};
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}){
  try{
    checkOrigin(req);const {action}=await params;const body=await readBody(req),jar=await cookies();
    if(!authConfigured())throw new DomainError('SETUP_REQUIRED','Sign-in will be available after Supabase is connected. You can explore the demonstration meanwhile.',503);
    const supabase=await supabaseServer();
    if(action==='sign-out'){await supabase.auth.signOut();jar.delete('ahd_grant');jar.delete('ahd_challenge');return json({ok:true});}
    if(action==='profile'){
      const {name}=z.object({name:z.string().trim().min(2).max(120).refine(v=>!v.includes('@'),'Enter your name, not an email address.')}).parse(body);
      const {data:{user},error}=await supabase.auth.getUser();
      if(error||!user||!user.email_confirmed_at)throw new DomainError('AUTH_REQUIRED','Verify your email to continue.',401);
      const {error:updateError}=await supabase.auth.updateUser({data:{full_name:name}});
      if(updateError)throw new DomainError('PROFILE_SAVE_FAILED','Your name could not be saved. Try again.',400);
      return json({ok:true});
    }
    if(action==='send'){
      const input=z.object({contact:contactSchema.optional(),name:z.string().trim().min(2).max(120).optional(),agreementId:z.string().uuid().optional(),versionId:z.string().uuid().optional(),action:z.string().optional(),invitationToken:z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),next:z.string().max(300).optional()}).parse(body);
      let challenge:Challenge;
      if(input.invitationToken){
        const repo=new PostgresRepository(database()),{agreement,invitation,participant}=witnessInvitation(await repo.findInvitation(input.invitationToken),input.invitationToken);
        challenge={contact:invitation.destination,name:input.name||participant.name,userId:participant.userId,agreementId:agreement.id,versionId:invitation.versionId,action:'attest',expiresAt:Date.now()+600000,invitationToken:input.invitationToken,returnTo:`/invite/${input.invitationToken}`};
      }else if(input.agreementId){
        throw new DomainError('INVALID_ACTION','Your signed-in session already verifies routine agreement actions.',422);
      }else{
        if(!input.contact)throw new DomainError('CONTACT_REQUIRED','Enter your email address.',422);
        challenge={contact:input.contact,name:input.name||'',userId:null,agreementId:null,versionId:null,action:null,expiresAt:Date.now()+600000,returnTo:authReturnPath(input.next)};
      }
      requireEmailDelivery(challenge.contact);
      await rateLimit(`otp-send-contact:${challenge.contact}`,5);
      await rateLimit(`otp-send-ip:${req.headers.get('x-forwarded-for')||'local'}`,15);
      const contact=challenge.contact;
      const callback=new URL('/auth/callback',process.env.AHD_APP_URL||req.url).toString();
      const {error}=await supabase.auth.signInWithOtp(contact.includes('@')?{email:contact,options:{shouldCreateUser:!challenge.userId,emailRedirectTo:callback,data:undefined}}:{phone:contact,options:{shouldCreateUser:!challenge.userId}});
      if(error)throw new DomainError('OTP_SEND_FAILED','The code could not be sent. Check the contact and try again.',400);
      // The verified session authorizes access; codes never approve agreement actions.
      jar.set('ahd_challenge',signSession(challenge),{...cookieOptions,sameSite:!challenge.agreementId||challenge.invitationToken?'lax':'strict',maxAge:600});
      return json({ok:true,contact:maskContact(contact)});
    }
    if(action==='verify'){
      const {code}=z.object({code:z.string().regex(/^\d{6,8}$/,'Enter the code from your message.')}).parse(body);
      const c=readSession<Challenge>(jar.get('ahd_challenge')?.value);
      if(!c||c.expiresAt<Date.now())throw new DomainError('OTP_EXPIRED','This code has expired. Select Resend code to get a new one.',410);
      requireEmailDelivery(c.contact);
      const invitationRepo=c.invitationToken?new PostgresRepository(database()):null;
      if(invitationRepo&&c.invitationToken){const {invitation}=witnessInvitation(await invitationRepo.findInvitation(c.invitationToken),c.invitationToken);if(invitation.versionId!==c.versionId)throw new DomainError('AGREEMENT_VERSION_STALE','Ask for a new invitation to the current terms.',409);}
      await rateLimit(`otp-verify:${c.contact}`,10);
      const {data,error}=await supabase.auth.verifyOtp(c.contact.includes('@')?{email:c.contact,token:code,type:'email'}:{phone:c.contact,token:code,type:'sms'});
      if(error||!data.user)throw new DomainError('OTP_INVALID','This code could not be verified. Check it or request a new code.',400);
      if(c.userId&&c.userId!==data.user.id)throw new DomainError('IDENTITY_CHANGED','The verified identity changed. Sign in again.',403);
      const contacts=[data.user.email_confirmed_at?data.user.email:null,data.user.phone_confirmed_at?`+${data.user.phone?.replace(/^\+/,'')}`:null].filter(Boolean) as string[];
      if(!contacts.some(contact=>contact.toLowerCase()===c.contact.toLowerCase())){await supabase.auth.signOut();throw new DomainError('IDENTITY_CHANGED','The verified contact did not match the sign-in request.',403);}
      let claimedId:string|undefined;
      if(invitationRepo&&c.invitationToken){
        const actor:Actor={userId:data.user.id,name:profileName(data.user.user_metadata)||c.name,contacts,demo:false};
        const claimed=await invitationRepo.claim(c.invitationToken,actor);
        witnessInvitation(claimed,c.invitationToken);
        if(claimed.currentVersionId!==c.versionId)throw new DomainError('AGREEMENT_VERSION_STALE','Ask for a new invitation to the current terms.',409);
        claimedId=claimed.id;
      }
      let savedName=profileName(data.user.user_metadata);
      if(!savedName && c.name){const {error:updateError}=await supabase.auth.updateUser({data:{full_name:c.name}});if(updateError)throw new DomainError('PROFILE_SAVE_FAILED','Your email was verified, but your name could not be saved. Try again.',400);savedName=c.name;}
      jar.delete('ahd_grant');jar.delete('ahd_challenge');return json({ok:true,needsName:!savedName,...(claimedId?{agreementId:claimedId}:{})});
    }
    return json({message:'This action is unavailable.'},404);
  }catch(error){return failure(error);}
}
