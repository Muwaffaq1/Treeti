import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,approved,now,people} from '../helpers';
import {claimInvitation} from '@/modules/agreements/domain';
import {readSession,signSession} from '@/lib/session';
import {authReturnPath} from '@/lib/auth-return';
import {witnessInvitation} from '@/lib/invitation-access';
import {confirmationEmail} from '@/lib/contact-delivery';
import type {Aggregate} from '@/modules/agreements/types';
import {POST,type Challenge} from '@/app/api/auth/[action]/route';
import {GET} from '@/app/auth/callback/route';

const mocks=vi.hoisted(()=>({jar:new Map<string,string>(),send:vi.fn(),verify:vi.fn(),exchange:vi.fn(),signOut:vi.fn(),update:vi.fn(),getUser:vi.fn(),find:vi.fn(),claim:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>mocks.jar.has(key)?{value:mocks.jar.get(key)}:undefined,set:(key:string,value:string)=>mocks.jar.set(key,value),delete:(key:string)=>mocks.jar.delete(key)})}));
vi.mock('@/lib/supabase/server',()=>({authConfigured:()=>true,supabaseServer:async()=>({auth:{signInWithOtp:mocks.send,verifyOtp:mocks.verify,exchangeCodeForSession:mocks.exchange,signOut:mocks.signOut,updateUser:mocks.update,getUser:mocks.getUser}})}));
vi.mock('@/lib/database',()=>({database:()=>({})}));
vi.mock('@/lib/rate-limit',()=>({rateLimit:async()=>{}}));
vi.mock('@/modules/agreements/repository',()=>({PostgresRepository:class {findInvitation=mocks.find;claim=mocks.claim;}}));

const origin='https://staging.example.test';
let agreement:Aggregate,token:string;
const user={id:people[2].userId,email:people[2].contacts[0],email_confirmed_at:now,user_metadata:{full_name:people[2].name}};
const post=(action:string,body:unknown)=>POST(new Request(`${origin}/api/auth/${action}`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({action})});
const challenge=():Challenge=>({contact:user.email,name:people[2].name,userId:null,agreementId:agreement.id,versionId:agreement.currentVersionId,action:'attest',invitationToken:token,expiresAt:Date.now()+600000,returnTo:`/invite/${token}`});
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(now));vi.stubEnv('AHD_APP_URL',origin);vi.stubEnv('AHD_SESSION_SECRET','synthetic-auth-tests-secret-at-least-32-characters');
  vi.clearAllMocks();mocks.jar.clear();
  const result=act(approved(),people[0],'invite-witness',{name:people[2].name,contact:user.email});agreement=result.agreement;token=result.invitation!.token;
  mocks.find.mockImplementation(async()=>agreement);mocks.claim.mockImplementation(async(t,actor)=>claimInvitation(agreement,t,{actor,now}));
  mocks.send.mockResolvedValue({error:null});mocks.verify.mockResolvedValue({data:{user},error:null});mocks.exchange.mockResolvedValue({data:{user},error:null});mocks.update.mockResolvedValue({error:null});mocks.getUser.mockResolvedValue({data:{user},error:null});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});

describe('witness invitation verification',()=>{
  it('rejects a server-selected phone destination even when the caller supplies an email',async()=>{
    agreement.invitations.at(-1)!.destination='+2348012345678';
    const response=await post('send',{invitationToken:token,name:'Witness One',contact:user.email});
    expect(response.status).toBe(422);expect(await response.json()).toMatchObject({code:'PHONE_DELIVERY_UNAVAILABLE'});
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.jar.has('ahd_challenge')).toBe(false);
  });
  it('blocks direct phone sign-in and verification of an older phone challenge',async()=>{
    expect((await post('send',{contact:'+2348012345678',name:'Test person'})).status).toBe(422);
    const c=challenge();c.contact='+2348012345678';delete c.invitationToken;mocks.jar.set('ahd_challenge',signSession(c));
    expect((await post('verify',{code:'123456'})).status).toBe(422);
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.jar.has('ahd_grant')).toBe(false);
  });
  it('selects a confirmed email for step-up and rejects phone-only identities',()=>{
    expect(confirmationEmail(['+2348012345678',user.email])).toBe(user.email);
    expect(()=>confirmationEmail(['+2348012345678'])).toThrow('A verified email address is needed');
  });
  it('uses the invited contact and binds only an attest grant, ignoring caller destination/action',async()=>{
    expect((await post('send',{invitationToken:token,name:'Witness One',contact:'attacker@example.test',action:'approve'})).status).toBe(200);
    expect(mocks.send.mock.calls[0][0].email).toBe(user.email);
    expect(mocks.send.mock.calls[0][0].options.emailRedirectTo).toBe(`${origin}/auth/callback`);
    expect(readSession<Challenge>(mocks.jar.get('ahd_challenge'))).toMatchObject({action:'attest',agreementId:agreement.id,versionId:agreement.currentVersionId,contact:user.email});
    expect(mocks.jar.has('ahd_grant')).toBe(false);
  });
  it('claims after verified identity without another action code or automatic attestation',async()=>{
    mocks.jar.set('ahd_challenge',signSession(challenge()));
    const result=await post('verify',{code:'123456'});
    expect(await result.json()).toMatchObject({ok:true,agreementId:agreement.id});
    expect(mocks.claim).toHaveBeenCalledWith(token,expect.objectContaining({userId:user.id,contacts:[user.email]}));
    expect(mocks.jar.has('ahd_grant')).toBe(false);
    expect(agreement.attestations).toHaveLength(0);
  });
  it('rejects a verified identity that does not own the invited contact',async()=>{
    mocks.jar.set('ahd_challenge',signSession(challenge()));mocks.verify.mockResolvedValue({data:{user:{...user,email:'other@example.test'}},error:null});
    expect((await post('verify',{code:'123456'})).status).toBe(403);expect(mocks.jar.has('ahd_grant')).toBe(false);
  });
  it('rejects expired, revoked, superseded and already-responded invitations',()=>{
    for(const mutate of [(a:Aggregate)=>{a.invitations.at(-1)!.expiresAt=now;},(a:Aggregate)=>{a.invitations.at(-1)!.status='REVOKED';},(a:Aggregate)=>{a.currentVersionId='another-version';},(a:Aggregate)=>{a.attestations.push({participantId:a.invitations.at(-1)!.participantId,versionId:a.currentVersionId} as Aggregate['attestations'][number]);}]){
      const copy=structuredClone(agreement);mutate(copy);expect(()=>witnessInvitation(copy,token,now)).toThrow();
    }
  });
  it('does not offer witness verification to a borrower invitation',async()=>{
    const result=act(approved(),people[0],'invite-witness',{name:people[3].name,contact:people[3].contacts[0]});
    agreement=result.agreement;agreement.participants.find(p=>p.id===agreement.invitations.at(-1)!.participantId)!.role='BORROWER';token=result.invitation!.token;
    expect((await post('send',{invitationToken:token,name:'Another person'})).status).toBe(409);expect(mocks.send).not.toHaveBeenCalled();
  });
  it('rejects a version changed between send and verification before accepting the code',async()=>{
    mocks.jar.set('ahd_challenge',signSession(challenge()));agreement.currentVersionId='superseded';
    expect((await post('verify',{code:'123456'})).status).toBe(410);expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.jar.has('ahd_grant')).toBe(false);
  });
});

describe('sign-in email callback',()=>{
  it('exchanges PKCE, binds identity and never grants witness confirmation from a link',async()=>{
    mocks.jar.set('ahd_challenge',signSession(challenge()));
    const result=await GET(new Request(`${origin}/auth/callback?code=synthetic-code&next=https://attacker.test`));
    expect(mocks.exchange).toHaveBeenCalledWith('synthetic-code');expect(result.headers.get('location')).toBe(`${origin}/invite/${token}`);expect(result.headers.get('Cache-Control')).toBe('private, no-store');expect(mocks.jar.has('ahd_grant')).toBe(false);expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('rejects financial step-up links and missing challenges before exchanging',async()=>{
    const c=challenge();delete c.invitationToken;mocks.jar.set('ahd_challenge',signSession(c));
    expect((await GET(new Request(`${origin}/auth/callback?code=synthetic-code`))).headers.get('location')).toContain('authError=link');expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.jar.clear();await GET(new Request(`${origin}/auth/callback?code=synthetic-code`));expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('signs out a returned identity that differs from the request',async()=>{
    mocks.jar.set('ahd_challenge',signSession(challenge()));mocks.exchange.mockResolvedValue({data:{user:{...user,email:'other@example.test'}},error:null});
    expect((await GET(new Request(`${origin}/auth/callback?code=synthetic-code`))).headers.get('location')).toContain('authError=identity');expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it('rejects external, backslash, protocol-relative and unknown return destinations',()=>{
    for(const value of ['https://attacker.test','//attacker.test','/\\attacker.test','/agreements/\\attacker.test','/login','/app?next=https://attacker.test'])expect(authReturnPath(value)).toBe('/app');
    expect(authReturnPath(`/invite/${token}`)).toBe(`/invite/${token}`);expect(authReturnPath('/agreements/new')).toBe('/agreements/new');
  });
});


describe('email-only sign-in and one-time name setup',()=>{
 it('sends a uniform email-only challenge without probing account existence or overwriting metadata',async()=>{
  const result=await post('send',{contact:user.email,next:'/agreements/new'});expect(result.status).toBe(200);expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.send.mock.calls[0][0].options.data).toBeUndefined();
  expect(readSession<Challenge>(mocks.jar.get('ahd_challenge'))).toMatchObject({contact:user.email,name:'',returnTo:'/agreements/new'});
 });
 it('preserves the saved name of a returning user even when an older client supplies a different name',async()=>{
  await post('send',{contact:user.email,name:'Different name'});const result=await post('verify',{code:'123456'});expect(await result.json()).toMatchObject({ok:true,needsName:false});expect(mocks.update).not.toHaveBeenCalled();expect(mocks.jar.has('ahd_grant')).toBe(false);
 });
 it('asks for a first-use name only after verifying the email',async()=>{
  await post('send',{contact:user.email});mocks.verify.mockResolvedValue({data:{user:{...user,user_metadata:{}}},error:null});expect(await (await post('verify',{code:'123456'})).json()).toMatchObject({ok:true,needsName:true});expect(mocks.update).not.toHaveBeenCalled();
 });
 it('reuses the invited name for a first-time witness after verification without a profile form',async()=>{
  await post('send',{invitationToken:token});mocks.verify.mockResolvedValue({data:{user:{...user,user_metadata:{}}},error:null});const result=await post('verify',{code:'123456'});expect(await result.json()).toMatchObject({ok:true,needsName:false,agreementId:agreement.id});expect(mocks.update).toHaveBeenCalledWith({data:{full_name:people[2].name}});
 });
 it('saves a name only for the currently verified user and refuses signed-out requests',async()=>{
  expect((await post('profile',{name:'Verified Person'})).status).toBe(200);expect(mocks.update).toHaveBeenCalledWith({data:{full_name:'Verified Person'}});mocks.update.mockClear();mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await post('profile',{name:'Other Person'})).status).toBe(401);expect(mocks.update).not.toHaveBeenCalled();
 });
 it('does not send a second code for routine record actions',async()=>{
  expect((await post('send',{agreementId:agreement.id,versionId:agreement.currentVersionId,action:'settle'})).status).toBe(422);expect(mocks.send).not.toHaveBeenCalled();
 });
});

describe('resending expired verification codes',()=>{
 it('renews the sign-in challenge for the same contact and return path',async()=>{
  const next=`/invite/${token}`;
  expect((await post('send',{contact:user.email,next})).status).toBe(200);
  const original=readSession<Challenge>(mocks.jar.get('ahd_challenge'))!;
  vi.advanceTimersByTime(600001);
  expect((await post('verify',{code:'123456'})).status).toBe(410);expect(mocks.verify).not.toHaveBeenCalled();
  expect((await post('send',{contact:user.email,next})).status).toBe(200);
  const renewed=readSession<Challenge>(mocks.jar.get('ahd_challenge'))!;
  expect(renewed.contact).toBe(original.contact);expect(renewed.returnTo).toBe(next);expect(renewed.expiresAt).toBeGreaterThan(original.expiresAt);expect(mocks.send).toHaveBeenCalledTimes(2);
  expect((await post('verify',{code:'654321'})).status).toBe(200);expect(mocks.jar.has('ahd_challenge')).toBe(false);expect(mocks.claim).not.toHaveBeenCalled();
 });
 it('renews a witness challenge without changing the invited destination or agreement version',async()=>{
  expect((await post('send',{invitationToken:token})).status).toBe(200);
  const original=readSession<Challenge>(mocks.jar.get('ahd_challenge'))!;vi.advanceTimersByTime(600001);
  expect((await post('verify',{code:'123456'})).status).toBe(410);
  expect((await post('send',{invitationToken:token})).status).toBe(200);
  const renewed=readSession<Challenge>(mocks.jar.get('ahd_challenge'))!;
  expect(renewed).toMatchObject({contact:original.contact,agreementId:original.agreementId,versionId:original.versionId,invitationToken:token});expect(renewed.expiresAt).toBeGreaterThan(original.expiresAt);
  expect((await post('verify',{code:'654321'})).status).toBe(200);expect(mocks.claim).toHaveBeenCalledTimes(1);expect(agreement.attestations).toHaveLength(0);
 });
});
