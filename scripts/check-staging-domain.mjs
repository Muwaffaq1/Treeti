import assert from 'node:assert/strict';
import {Agent,request as httpsRequest} from 'node:https';

const production=process.argv.includes('--production');
const current=production?'https://usetreeti.xyz':'https://staging.usetreeti.xyz';
const aliases=production?['https://staging.usetreeti.xyz','https://ahd-staging.yusufmuwaffaq17.workers.dev']:['https://ahd-staging.yusufmuwaffaq17.workers.dev'];
const legacy='https://ahd-staging.yusufmuwaffaq17.workers.dev';
let publicDnsAgent;
async function request(base,path,options={}){
  if(publicDnsAgent&&base===current){
    return new Promise((resolve,reject)=>{
      const req=httpsRequest(base+path,{agent:publicDnsAgent,method:options.method??'GET',headers:options.headers??{}},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
        res.on('end',()=>{const headers=new Headers();for(const [key,value] of Object.entries(res.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});
      });
      req.setTimeout(20000,()=>req.destroy(new Error('HTTPS probe timed out.')));req.on('error',reject);req.end(options.body);
    });
  }
  return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
}
function privateResponse(response){assert.match(response.headers.get('cache-control')??'',/private.*no-store/);}
async function check(){
  if(process.argv.includes('--public-dns')){
    const response=await fetch(`https://cloudflare-dns.com/dns-query?name=${new URL(current).hostname}&type=A`,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    const answer=await response.json(),ip=answer.Answer?.find(record=>record.type===1)?.data;
    assert.match(ip??'',/^\d{1,3}(\.\d{1,3}){3}$/,'Public DNS must resolve the exact staging hostname.');
    // Only DNS resolution changes: HTTPS still verifies the staging hostname
    // against the certificate. This never bypasses a TLS/security error.
    publicDnsAgent=new Agent({lookup:(_host,options,callback)=>options.all?callback(null,[{address:ip,family:4}]):callback(null,ip,4)});
    console.log('Using public DNS for this probe only; local/browser DNS is a separate check.');
  }
  for(const path of ['/login','/guide']){
    const response=await request(current,path);assert.equal(response.status,200,path);
    assert.ok(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    const html=await response.text();assert.match(html,/treeti/);privateResponse(response);
    if(path==='/login'){assert.match(html,/>Email address<\/label>/);assert.doesNotMatch(html,/>Full name<\/label>/);}
    if(path==='/guide'){assert.match(html,/Keep an investment record/);assert.match(html,/Money owed to you|money owed to you/);assert.doesNotMatch(html,/before public launch|Try every role in one browser|testing-guide/);}
  }
  // Home and sign-in are static files, so an old address serves the page and the page moves itself.
  for(const alias of aliases){const response=await request(alias,'/login?next=%2Fagreements%2Fexample');assert.equal(response.status,200);assert.match(await response.text(),/https:\/\/usetreeti\.xyz/);}
  for(const alias of aliases)for(const path of ['/invite/domain-probe?next=%2Fagreements%2Fexample','/verify/TREETI-2026-00000']){
    const response=await request(alias,path);assert.equal(response.status,307,path);
    assert.equal(response.headers.get('location'),current+path);privateResponse(response);
    await response.arrayBuffer();
  }
  const manifest=await request(current,'/manifest.webmanifest');assert.equal(manifest.status,200);
  const data=await manifest.json();assert.equal(data.short_name,'treeti');
  for(const path of ['/favicon.ico',...data.icons.map(icon=>icon.src)]){
    const response=await request(current,path);assert.equal(response.status,200,path);await response.arrayBuffer();
  }
  const privateApi=await request(current,'/api/debts');assert.equal(privateApi.status,401);privateResponse(privateApi);await privateApi.arrayBuffer();
  const investmentApi=await request(current,'/api/investments');assert.equal(investmentApi.status,401);privateResponse(investmentApi);await investmentApi.arrayBuffer();
  const investmentsPage=await request(current,'/investments');privateResponse(investmentsPage);assert.ok([200,307].includes(investmentsPage.status));
  if(investmentsPage.status===307)assert.match(investmentsPage.headers.get('location')??'',/\/login\?next=%2Finvestments/);
  else{const html=await investmentsPage.text();assert.match(html,/NEXT_REDIRECT|http-equiv="refresh"/);assert.match(html,/\/login\?next=%2Finvestments/);}
  for(const origin of [...aliases,'https://external.example']){
    const response=await request(current,'/api/auth/send',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'});
    assert.equal(response.status,403);assert.equal((await response.json()).code,'ORIGIN_REJECTED');privateResponse(response);
  }
  const currentRequest=await request(current,'/api/auth/send',{method:'POST',headers:{'Content-Type':'application/json',Origin:current},body:'{}'});
  assert.equal(currentRequest.status,422);assert.equal((await currentRequest.json()).code,'CONTACT_REQUIRED');privateResponse(currentRequest);
  const oldMutation=await request(legacy,'/api/auth/send',{method:'POST',headers:{'Content-Type':'application/json',Origin:legacy},body:'{}'});
  assert.equal(oldMutation.status,403);assert.equal(oldMutation.headers.get('location'),null);await oldMutation.arrayBuffer();
  const welcome=await request(current,'/welcome');privateResponse(welcome);assert.ok([200,307].includes(welcome.status));
  if(welcome.status===307){assert.match(welcome.headers.get('location')??'',/\/login\?next=/);await welcome.arrayBuffer();}else{const html=await welcome.text();assert.match(html,/NEXT_REDIRECT|http-equiv="refresh"/);assert.match(html,/\/login\?next=/);}
  const profile=await request(current,'/api/auth/profile',{method:'POST',headers:{'Content-Type':'application/json',Origin:current},body:JSON.stringify({name:'Synthetic profile probe'})});assert.equal(profile.status,401);privateResponse(profile);await profile.arrayBuffer();
  const callback=await request(current,'/auth/callback');assert.equal(callback.status,307);
  assert.equal(new URL(callback.headers.get('location')).origin,current);privateResponse(callback);await callback.arrayBuffer();
  const job=await request(current,'/api/inngest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(job.status,401);await job.arrayBuffer();
  console.log(`PASS ${production?'production':'staging'} HTTPS, branding, old-link redirects, strict origins, private responses and unsigned job rejection.`);
  console.log('No code requested, email sent or financial records changed.');
}
void check().catch(error=>{console.error('Staging domain check failed:',error instanceof assert.AssertionError?error.message:'Check DNS, TLS and connectivity.');process.exitCode=1;}).finally(()=>publicDnsAgent?.destroy());
