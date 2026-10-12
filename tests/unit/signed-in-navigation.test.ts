import {beforeEach, describe, expect, it, vi} from 'vitest';
import {redirectSignedInUser} from '@/lib/signed-in-redirect';

const auth=vi.hoisted(()=>({configured:true, getUser:vi.fn(), redirect:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({authConfigured:()=>auth.configured,supabaseServer:async()=>({auth:{getUser:auth.getUser}})}));
vi.mock('next/navigation',()=>({redirect:auth.redirect}));
beforeEach(()=>{vi.clearAllMocks();auth.configured=true;auth.getUser.mockResolvedValue({data:{user:{id:'verified-user',user_metadata:{full_name:'Verified Person'}}},error:null});});

describe('signed-in entry navigation',()=>{
  it('asks for a name once after identity verification and preserves the intended destination',async()=>{auth.getUser.mockResolvedValue({data:{user:{id:'new-user',user_metadata:{}}},error:null});await redirectSignedInUser('/agreements/new');expect(auth.redirect).toHaveBeenCalledWith('/welcome?next=%2Fagreements%2Fnew');});
  it('returns verified users to their dashboard',async()=>{await redirectSignedInUser();expect(auth.redirect).toHaveBeenCalledWith('/app');});
  it('preserves a valid invitation after sign-in',async()=>{const path=`/invite/${'w'.repeat(43)}`;await redirectSignedInUser(path);expect(auth.redirect).toHaveBeenCalledWith(path);});
  it('does not redirect users based on an unverified session',async()=>{auth.getUser.mockResolvedValue({data:{user:null},error:null});await redirectSignedInUser();expect(auth.redirect).not.toHaveBeenCalled();});
  it('does not treat an Auth error as a signed-in identity',async()=>{auth.getUser.mockResolvedValue({data:{user:{id:'stale-user'}},error:{message:'Expired'}});await redirectSignedInUser();expect(auth.redirect).not.toHaveBeenCalled();});
  it('keeps unconfigured local previews available',async()=>{auth.configured=false;await redirectSignedInUser();expect(auth.getUser).not.toHaveBeenCalled();expect(auth.redirect).not.toHaveBeenCalled();});
  it.each(['https://untrusted.example','//untrusted.example','/login','/\\untrusted.example'])('rejects unsafe or looping destination %s',async path=>{await redirectSignedInUser(path);expect(auth.redirect).toHaveBeenCalledWith('/app');});
});
