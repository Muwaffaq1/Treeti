import {afterEach,describe,expect,it,vi} from 'vitest';
import {entryRedirect,entryRedirectScript} from '@/lib/entry-redirect';
import {authReturnPath} from '@/lib/auth-return';

const session='theme=dark; sb-uuryyzuuzfgqtznszrls-auth-token.0=base64-abc';
function open(url:string,cookie='',lastMove?:number){
  const at=new URL(url),replace=vi.fn(),store=new Map<string,string>(lastMove===undefined?[]:[['treeti:entry-redirect',String(lastMove)]]),root={dataset:{} as Record<string,string>};
  vi.stubGlobal('location',{hostname:at.hostname,pathname:at.pathname,search:at.search,replace});
  vi.stubGlobal('document',{cookie,documentElement:root});
  vi.stubGlobal('sessionStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>void store.set(k,v)});
  entryRedirect();
  return {to:replace.mock.calls[0]?.[0] as string|undefined,hidden:root.dataset.leaving==='1'};
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('ready-made home and sign-in pages',()=>{
  it('leave visitors without a session where they are',()=>{
    for(const cookie of ['','theme=dark','ahd_demo=abc; not-sb-x-auth-token-like=1'])expect(open('https://usetreeti.xyz/',cookie)).toEqual({to:undefined,hidden:false});
  });
  it('move a signed-in person to the dashboard without showing the page first',()=>{
    expect(open('https://usetreeti.xyz/',session)).toEqual({to:'/app',hidden:true});
    expect(open('https://usetreeti.xyz/login',session).to).toBe('/app');
  });
  it('never act on any other page',()=>{
    for(const path of ['/guide','/app','/login/extra','/agreements/new'])expect(open(`https://usetreeti.xyz${path}`,session)).toEqual({to:undefined,hidden:false});
    expect(open('https://staging.usetreeti.xyz/guide').to).toBeUndefined();
  });
  it('keep the intended destination from sign-in, with the same allow-list as the server',()=>{
    const invite=`/invite/${'w'.repeat(43)}`;
    for(const next of ['/agreements/new','/debts','/account',invite,'https://untrusted.example','//untrusted.example','/login','/\\untrusted.example','/agreements/x?y=1','/invite/short',''])
      expect(open(`https://usetreeti.xyz/login?next=${encodeURIComponent(next)}`,session).to,next).toBe(authReturnPath(next));
    expect(open(`https://usetreeti.xyz/?next=${encodeURIComponent('/debts')}`,session).to).toBe('/app');
  });
  it('do not bounce when the private page has just sent an expired session back',()=>{
    vi.useFakeTimers();vi.setSystemTime(1_000_000);
    expect(open('https://usetreeti.xyz/login?next=%2Fapp',session,1_000_000-5_000).to).toBeUndefined();
    expect(open('https://usetreeti.xyz/login?next=%2Fapp',session,1_000_000-20_000).to).toBe('/app');
  });
  it('show the page again if the move does not happen',()=>{
    vi.useFakeTimers();const root={dataset:{} as Record<string,string>};
    vi.stubGlobal('location',{hostname:'usetreeti.xyz',pathname:'/',search:'',replace:vi.fn()});vi.stubGlobal('document',{cookie:session,documentElement:root});vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:()=>{}});
    entryRedirect();expect(root.dataset.leaving).toBe('1');vi.advanceTimersByTime(4000);expect(root.dataset.leaving).toBeUndefined();
  });
  it('move a page opened on an earlier address to the current one, signed in or not',()=>{
    for(const host of ['staging.usetreeti.xyz','ahd-staging.yusufmuwaffaq17.workers.dev'])for(const cookie of ['',session])
      expect(open(`https://${host}/login?next=%2Fagreements%2Fexample`,cookie).to).toBe('https://usetreeti.xyz/login?next=%2Fagreements%2Fexample');
    expect(open('https://usetreeti.xyz.untrusted.example/').to).toBeUndefined();
  });
  it('stay put when storage is blocked, and embed as a self-running script',()=>{
    vi.stubGlobal('location',{hostname:'usetreeti.xyz',pathname:'/',search:'',replace:vi.fn()});vi.stubGlobal('document',{cookie:session,documentElement:{dataset:{}}});vi.stubGlobal('sessionStorage',{getItem(){throw new Error('blocked');},setItem(){}});
    expect(()=>entryRedirect()).not.toThrow();expect(location.replace).not.toHaveBeenCalled();
    expect(entryRedirectScript.startsWith('(function entryRedirect(')||entryRedirectScript.startsWith('(function(')).toBe(true);expect(entryRedirectScript.endsWith(')();')).toBe(true);
  });
});
