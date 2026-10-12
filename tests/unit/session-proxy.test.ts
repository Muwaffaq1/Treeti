import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
// The installed 16.4 runtime retains the older helper export name.
import {unstable_doesMiddlewareMatch as doesProxyMatch} from 'next/experimental/testing/server';
import {config,proxy} from '@/proxy';

const refresh=vi.hoisted(()=>({getClaims:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:unknown,_key:unknown,options:{cookies:{setAll:(values:unknown[])=>void}})=>({auth:{getClaims:async()=>{options.cookies.setAll([{name:'synthetic-session',value:'refreshed',options:{path:'/',httpOnly:true}}]);return refresh.getClaims();}}})}));
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://synthetic.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','synthetic-public-key');refresh.getClaims.mockResolvedValue({data:{claims:{sub:'synthetic-user'}},error:null});});
afterEach(()=>vi.unstubAllEnvs());

describe('entry-page session refresh',()=>{
  it.each(['/','/login'])('refreshes %s without dropping response cookies or privacy headers',async path=>{
    expect(doesProxyMatch({config,nextConfig:{},url:path})).toBe(true);
    const request=new NextRequest(`https://synthetic.example${path}`),response=await proxy(request);
    expect(request.cookies.get('synthetic-session')?.value).toBe('refreshed');
    expect(response.cookies.get('synthetic-session')?.value).toBe('refreshed');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it.each(['/_next/static/synthetic.js','/icons/ahd-192.png','/sw.js'])('does not run session refresh for asset %s',path=>{
    expect(doesProxyMatch({config,nextConfig:{},url:path})).toBe(false);
  });
});
