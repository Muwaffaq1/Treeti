import {afterEach,describe,expect,it,vi} from 'vitest';
import {stagingRedirect} from '../../src/lib/staging-origin';
import {checkOrigin} from '../../src/lib/http';

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
