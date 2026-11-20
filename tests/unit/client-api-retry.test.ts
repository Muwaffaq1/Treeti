import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {api} from '@/components/client-api';

// Cloudflare's own error page: HTML, not treeti's JSON.
const cutOff=()=>new Response('<html>Worker exceeded resource limits</html>',{status:503,headers:{'Content-Type':'text/html'}});
const ok=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

describe('api retries when Cloudflare cuts a request off',()=>{
  beforeEach(()=>{vi.useFakeTimers();});
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

  it('retries a read and returns the second answer',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(cutOff()).mockResolvedValueOnce(ok({fine:true}));vi.stubGlobal('fetch',fetchMock);
    const result=api<{fine:boolean}>('/api/me');await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toEqual({fine:true});expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a keyed write with the same Idempotency-Key, so the server records it once',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(cutOff()).mockResolvedValueOnce(cutOff()).mockResolvedValueOnce(ok({saved:true}));vi.stubGlobal('fetch',fetchMock);
    const result=api('/api/agreements',{a:1},'key-1234567890abcdef');await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual({saved:true});expect(fetchMock).toHaveBeenCalledTimes(3);
    for(const call of fetchMock.mock.calls)expect(call[1].headers['Idempotency-Key']).toBe('key-1234567890abcdef');
  });

  it('never repeats a write without a key, such as sending a sign-in code',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(cutOff());vi.stubGlobal('fetch',fetchMock);
    await expect(api('/api/auth/send',{contact:'a@example.test'})).rejects.toThrow('treeti is busy');expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after three tries and says so',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(cutOff());vi.stubGlobal('fetch',fetchMock);
    const result=api('/api/me');const check=expect(result).rejects.toThrow('treeti is busy');await vi.advanceTimersByTimeAsync(2000);
    await check;expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry treeti’s own error answers',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'NOT_FOUND',message:'This agreement is unavailable.'}),{status:404}));vi.stubGlobal('fetch',fetchMock);
    await expect(api('/api/agreements/x')).rejects.toThrow('This agreement is unavailable.');expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
