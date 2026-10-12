import {beforeEach,describe,it,expect,vi} from 'vitest';
const store=vi.hoisted(()=>({files:new Map<string,Uint8Array>(),rows:[] as {kind:string;storage_path:string;sha256:string;data:{presentationVersion?:string};repayment_id:string|null}[]}));
vi.mock('@/lib/database',()=>({database:()=>({query:async(sql:string,params:unknown[])=>{
  if(sql.startsWith('insert into artifacts')){store.rows.push({kind:String(params[3]),storage_path:String(params[4]),sha256:String(params[5]),repayment_id:params[6] as string|null,data:JSON.parse(String(params[7]))});return [];}
  if(sql.includes('presentationVersion')&&params.length===1)return [...store.rows].filter(r=>r.kind==='AGREEMENT').sort((a,b)=>Number(b.data.presentationVersion==='2')-Number(a.data.presentationVersion==='2'));
  return store.rows.filter(r=>r.kind===params[1]&&r.repayment_id===params[2]&&(params[3]===null||r.data.presentationVersion===params[3]));
}})}));
vi.mock('@/lib/supabase/server',()=>({supabaseAdmin:()=>({storage:{from:()=>({
  download:async(path:string)=>({data:store.files.has(path)?{arrayBuffer:async()=>store.files.get(path)!}:null,error:store.files.has(path)?null:new Error('Missing')}),
  upload:async(path:string,bytes:Uint8Array,options:{upsert:boolean})=>{if(options.upsert||store.files.has(path))return {error:new Error('Already exists')};store.files.set(path,bytes);return {error:null};},
})}})}));
import {active,act,people} from '../helpers';
import {sha256} from '@/lib/crypto';
import {ensureArtifact} from '@/modules/documents/service';
import {verificationResult} from '@/modules/documents/verification';
beforeEach(()=>{store.files.clear();store.rows=[];});
describe('agreement PDF presentation revisions',()=>{
  it('appends a redesigned presentation for older agreements, preserves originals, and reuses it after repayments',async()=>{
    const a=active(),old=Buffer.from('%PDF-original-frozen-record');store.files.set('original.pdf',old);
    store.rows.push({kind:'AGREEMENT',storage_path:'original.pdf',sha256:sha256(old),data:{},repayment_id:null});
    const frozen=structuredClone(a.manifest),bytes=await ensureArtifact(a,'pdf');
    expect(bytes.subarray(0,4).toString()).toBe('%PDF');expect(bytes).not.toEqual(old);expect(a.manifest).toEqual(frozen);
    expect(store.files.get('original.pdf')).toEqual(old);expect(store.rows).toHaveLength(2);expect(store.rows[1].storage_path).toContain('agreement-presentation-v2.pdf');expect(store.rows[1].data.presentationVersion).toBe('2');
    const later=act(a,people[1],'repayment',{amountMinor:'100',date:'2026-10-08',method:'Cash'}).agreement;
    expect(await ensureArtifact(later,'pdf')).toEqual(bytes);expect(store.rows).toHaveLength(2);
    store.files.set('original.pdf',Buffer.from('An unreadable legacy object'));
    expect((await verificationResult(a)).documentStatus).toBe('MATCHED');
    store.files.set(store.rows[1].storage_path,Buffer.from('Altered current presentation'));
    expect((await verificationResult(a)).documentStatus).toBe('MISMATCH');
    await expect(ensureArtifact(a,'pdf')).rejects.toThrow('could not be verified');
  });
  it('continues using the original saved settlement document',async()=>{
    const bytes=Buffer.from('%PDF-saved-settlement');store.files.set('settlement.pdf',bytes);
    store.rows.push({kind:'SETTLEMENT',storage_path:'settlement.pdf',sha256:sha256(bytes),data:{},repayment_id:null});
    expect(await ensureArtifact(active(),'settlement')).toEqual(bytes);expect(store.rows).toHaveLength(1);
  });
});
