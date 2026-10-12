import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Inngest} from 'inngest';

// Read-only resource scopes: these UUIDs do not identify any application record.
// This verifies signed Workers execution, not real email delivery.
let phase='configuration';
async function check() {
  for (const key of ['AHD_APP_URL','INNGEST_SIGNING_KEY','INNGEST_EVENT_KEY']) assert.ok(process.env[key], `${key} must be configured.`);
  const app=new URL(process.env.AHD_APP_URL);
  assert.equal(app.protocol,'https:','Use the hosted staging app.');
  assert.ok(['ahd-staging.yusufmuwaffaq17.workers.dev','staging.usetreeti.xyz'].includes(app.hostname),'This probe is restricted to treeti staging.');
  assert.ok(!app.username&&!app.password,'Use a public app URL without credentials.');
  async function api(path,method='GET',body) {
    const response=await fetch(`https://api.inngest.com/v2${path}`,{method,headers:{Authorization:`Bearer ${process.env.INNGEST_SIGNING_KEY}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    if(response.status===404&&method==='GET')return {data:[]};
    assert.ok(response.ok, `Inngest returned HTTP ${response.status}.`);
    return response.json();
  }
  if(process.argv.includes('--sync')) {
    phase='function sync';
    await api('/apps/ahd/syncs','POST',{url:new URL('/api/inngest',app).toString()});
    console.log('Synced treeti staging background functions.');
  }
  const client=new Inngest({id:'ahd',isDev:false});
  const dueAt=Date.now()+20000;
  const events=[
    {id:`staging-probe-${randomUUID()}`,name:'ahd/jobs/deliver-outbox',data:{agreementId:randomUUID()}},
    {id:`staging-probe-${randomUUID()}`,name:'ahd/jobs/personal-debt-reminders',data:{reminderId:randomUUID()},ts:dueAt},
  ];
  phase='event submission';
  const {ids}=await client.send(events);
  assert.equal(ids.length,2);
  const statuses=new Map(),complete=new Set();
  const deadline=Date.now()+120000;
  while(Date.now()<deadline&&complete.size<ids.length) {
    phase='run verification';
    for(let index=0;index<ids.length;index++) {
      if(complete.has(index))continue;
      const response=await api(`/events/${ids[index]}/runs?includeOutput=true`);
      for(const run of response.data??[]) {
        const status=run.status;
        if(statuses.get(run.id)!==status){console.log(events[index].name,status);statuses.set(run.id,status);}
        assert.ok(!['FAILED','CANCELLED'].includes(status),'Hosted job did not complete.');
        if(status==='COMPLETED') {
          let output=run.output;
          if(typeof output==='string')output=JSON.parse(output);
          assert.equal(output.configured,true);
          assert.equal(index===0?output.total:output.considered,0,'The synthetic scope must not touch records.');
          if(index===1)assert.ok(Date.parse(run.startedAt)>=dueAt-1000,'Reminder ran before its scheduled time.');
          console.log('PASS signed hosted job',run.id);
          complete.add(index);
        }
      }
    }
    if(complete.size<ids.length)await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.equal(complete.size,2,'Timed out waiting for hosted jobs.');
  console.log('PASS scoped delivery and future reminder wakeups. No financial records changed; no email sent.');
}
void check().catch(error=>{console.error(`Hosted job check failed during ${phase}:`,error instanceof assert.AssertionError?error.message:'Check connectivity, credentials and job registration.');process.exitCode=1;});
