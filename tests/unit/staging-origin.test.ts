import {afterEach,describe,expect,it,vi} from 'vitest';
import {stagingRedirect} from '../../src/lib/staging-origin';
import {checkOrigin,failure} from '../../src/lib/http';
import {currentAddress} from '../../src/components/client-api';

const old='https://ahd-staging.yusufmuwaffaq17.workers.dev';
const current='https://staging.usetreeti.xyz';
afterEach(()=>vi.unstubAllEnvs());
function configure(){vi.stubEnv('AHD_RUNTIME','cloudflare');vi.stubEnv('AHD_APP_URL',current);vi.stubEnv('NODE_ENV','production');}
describe('staging domain migration',()=>{
  it('preserves invitation paths and query strings inside the exact new origin',()=>{
    configure();
    for(const method of ['GET','HEAD']){
      expect(stagingRedirect({url:`${old}/invite/example?next=%2Fagreements%2Fexample`,method})?.href).toBe(`${current}/invite/example?next=%2Fagreements%2Fexample`);
      expect(stagingRedirect({url:`${old}//external.example/path?next=https://external.example`,method})?.origin).toBe(current);
    }
  });
  it('never redirects mutations, the new origin, unrelated hosts or local development',()=>{
    configure();
    for(const method of ['POST','PATCH','DELETE'])expect(stagingRedirect({url:`${old}/api/auth/send`,method})).toBeNull();
    for(const origin of [current,'https://other.example'])expect(stagingRedirect({url:`${origin}/login`,method:'GET'})).toBeNull();
    vi.stubEnv('AHD_RUNTIME','local');expect(stagingRedirect({url:`${old}/login`,method:'GET'})).toBeNull();
    vi.stubEnv('AHD_RUNTIME','cloudflare');vi.stubEnv('AHD_APP_URL',old);expect(stagingRedirect({url:`${old}/login`,method:'GET'})).toBeNull();
  });
  it('accepts only the new exact mutation origin after the cutover',()=>{
    configure();
    expect(()=>checkOrigin(new Request(`${current}/api/auth/send`,{method:'POST',headers:{origin:current}}))).not.toThrow();
    for(const origin of [old,'https://external.example','https://staging.usetreeti.xyz.external.example'])expect(()=>checkOrigin(new Request(`${current}/api/auth/send`,{method:'POST',headers:{origin}}))).toThrow();
  });
});


describe('existing-project production promotion',()=>{
  it('keeps old invitation links usable at the root domain without forwarding writes or sessions',()=>{
    configure();vi.stubEnv('AHD_APP_URL','https://usetreeti.xyz');
    for(const origin of [old,current]){
      expect(stagingRedirect({url:`${origin}/invite/existing?next=%2Fagreements%2Fexisting`,method:'GET'})?.href).toBe('https://usetreeti.xyz/invite/existing?next=%2Fagreements%2Fexisting');
      expect(stagingRedirect({url:`${origin}/api/auth/send`,method:'POST'})).toBeNull();
      expect(()=>checkOrigin(new Request('https://usetreeti.xyz/api/auth/send',{method:'POST',headers:{origin}}))).toThrow();
    }
    for(const origin of ['https://usetreeti.xyz','https://usetreeti.xyz.external.example','https://untrusted.example'])expect(stagingRedirect({url:`${origin}/login`,method:'GET'})).toBeNull();
    expect(()=>checkOrigin(new Request('https://usetreeti.xyz/api/auth/send',{method:'POST',headers:{origin:'https://usetreeti.xyz'}}))).not.toThrow();
  });
});

describe('a page left open on an old address',()=>{
  it('is told the current address by name and where to move to',async()=>{
    configure();vi.stubEnv('AHD_APP_URL','https://usetreeti.xyz');
    let error:unknown;try{checkOrigin(new Request('https://usetreeti.xyz/api/auth/send',{method:'POST',headers:{origin:current}}));}catch(e){error=e;}
    const response=failure(error);expect(response.status).toBe(403);
    expect(await response.json()).toEqual({code:'ORIGIN_REJECTED',message:'Open treeti at usetreeti.xyz and try again.',home:'https://usetreeti.xyz'});
  });
  it('moves to the same page on the current address, and nowhere else',()=>{
    const at={origin:current,pathname:'/login',search:'?next=%2Fagreements%2Fexample'};
    expect(currentAddress('https://usetreeti.xyz',at)).toBe('https://usetreeti.xyz/login?next=%2Fagreements%2Fexample');
    expect(currentAddress('https://usetreeti.xyz',{...at,origin:'https://usetreeti.xyz'})).toBeNull();
    for(const home of [undefined,'','http://usetreeti.xyz','https://usetreeti.xyz/elsewhere','javascript:alert(1)','https://user@untrusted.example'])expect(currentAddress(home,at)).toBeNull();
  });
});
