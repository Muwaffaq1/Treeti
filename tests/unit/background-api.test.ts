import {beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from '@/app/api/[...path]/route';
import {approved,people,input} from '../helpers';
import {DomainError} from '@/modules/agreements/domain';
const mocks=vi.hoisted(()=>({create:vi.fn(),get:vi.fn(),command:vi.fn(),reminder:vi.fn(),queueAgreement:vi.fn(),queueReminder:vi.fn(),grant:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock('@/lib/runtime',async()=>{const {people}=await import('../helpers');return {getRuntime:async()=>({actor:people[0],repo:{create:mocks.create,get:mocks.get,command:mocks.command},workspace:'synthetic-workspace'}),currentGrant:mocks.grant};});
vi.mock('@/lib/rate-limit',()=>({rateLimit:async()=>{}}));
vi.mock('@/modules/debts/repository',()=>({debtRepository:()=>({setDebtReminder:mocks.reminder})}));
vi.mock('@/modules/notifications/wakeups',()=>({queueAgreementDelivery:mocks.queueAgreement,queueDebtReminder:mocks.queueReminder}));
const origin='http://127.0.0.1:3000',key='synthetic_request_key_01';
const post=(path:string[],body:unknown)=>POST(new Request(`${origin}/api/${path.join('/')}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)}),{params:Promise.resolve({path})});
beforeEach(()=>{vi.clearAllMocks();const agreement=approved();mocks.get.mockResolvedValue(agreement);mocks.create.mockResolvedValue({agreement});mocks.command.mockResolvedValue({agreement});mocks.reminder.mockResolvedValue({id:'sample-debt',reminder:{id:'sample-reminder',email:true,remindAt:'2026-10-10T08:00:00Z',timeZone:'Africa/Lagos'}});});

describe('delivery hints follow committed API actions',()=>{
  it('blocks unsupported live borrower contacts before persistence, keeping the demo available',async()=>{
    const body={...input,borrowerContact:'+2348012345678'};
    expect((await post(['agreements'],body)).status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();expect(mocks.queueAgreement).not.toHaveBeenCalled();
    expect((await post(['demo','agreements'],body)).status).toBe(201);expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('blocks both witness APIs before persistence when any destination is a phone',async()=>{
    const a=approved(),base={expectedVersionId:a.currentVersionId};
    expect((await post(['agreements',a.id,'invite-witness'],{...base,action:'invite-witness',name:'Witness One',contact:'+2348012345678'})).status).toBe(422);
    expect((await post(['agreements',a.id,'invite-witnesses'],{...base,action:'invite-witnesses',witnesses:[{name:'Witness One',contact:'one@example.test'},{name:'Witness Two',contact:'+2348012345678'}]})).status).toBe(422);
    expect(mocks.command).not.toHaveBeenCalled();expect(mocks.queueAgreement).not.toHaveBeenCalled();
  });
  it('checks the saved borrower destination before sending an older draft',async()=>{
    const a=approved();a.participants.find(p=>p.role==='BORROWER')!.contact='+2348012345678';mocks.get.mockResolvedValue(a);
    expect((await post(['agreements',a.id,'send'],{action:'send',expectedVersionId:a.currentVersionId})).status).toBe(422);
    expect(mocks.command).not.toHaveBeenCalled();expect(mocks.queueAgreement).not.toHaveBeenCalled();
  });
  it('queues a created agreement only after persistence succeeds',async()=>{
    const response=await post(['agreements'],input);
    expect(response.status).toBe(201);
    expect(mocks.queueAgreement).toHaveBeenCalledWith((await response.json()).agreement.id,people[0].userId,key);
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.queueAgreement.mock.invocationCallOrder[0]);
  });
  it('does not enqueue a failed agreement mutation',async()=>{
    mocks.command.mockRejectedValue(new DomainError('AGREEMENT_VERSION_STALE','Reload the terms.',409));
    const a=approved();expect((await post(['agreements',a.id,'send'],{action:'send',expectedVersionId:a.currentVersionId})).status).toBe(409);
    expect(mocks.queueAgreement).not.toHaveBeenCalled();
  });
  it('queues successful agreement commands and skips the synthetic demo',async()=>{
    const a=approved(),body={action:'send',expectedVersionId:a.currentVersionId};
    expect((await post(['agreements',a.id,'send'],body)).status).toBe(200);
    expect(mocks.queueAgreement).toHaveBeenCalledOnce();mocks.queueAgreement.mockClear();
    expect((await post(['demo','agreements',a.id,'send'],body)).status).toBe(200);
    expect(mocks.queueAgreement).not.toHaveBeenCalled();
  });
  it('schedules the reminder returned by the owner-checked repository, never caller fields',async()=>{
    const id=crypto.randomUUID(),body={remindAt:'2026-10-11T08:00:00Z',timeZone:'Africa/Lagos',email:true};
    expect((await post(['debts',id,'reminder'],body)).status).toBe(200);
    expect(mocks.queueReminder).toHaveBeenCalledWith(expect.objectContaining({id:'sample-reminder',remindAt:'2026-10-10T08:00:00Z'}));
    mocks.queueReminder.mockClear();mocks.reminder.mockRejectedValue(new DomainError('NOT_FOUND','Unavailable.',404));
    expect((await post(['debts',id,'reminder'],body)).status).toBe(404);expect(mocks.queueReminder).not.toHaveBeenCalled();
  });
});

it('accepts live party approval using the revalidated session without requesting or consuming a grant',async()=>{
  const a=approved();mocks.grant.mockResolvedValue({id:'unrelated-grant'});
  expect((await post(['agreements',a.id,'approve'],{action:'approve',expectedVersionId:a.currentVersionId,affirmed:true,signature:people[0].name})).status).toBe(200);
  expect(mocks.grant).not.toHaveBeenCalled();expect(mocks.command).toHaveBeenCalledWith(a.id,expect.objectContaining({action:'approve'}),people[0],key,undefined);
});

it('checks the saved resend destination and queues only a committed invitation',async()=>{
 const a=approved(),recipient=a.participants[1],body={action:'resend-invitation',expectedVersionId:a.currentVersionId,targetId:recipient.id};
 a.participants[1].contact='+2348012345678';mocks.get.mockResolvedValue(a);
 expect((await post(['agreements',a.id,'resend-invitation'],body)).status).toBe(422);expect(mocks.command).not.toHaveBeenCalled();
 a.participants[1].contact=people[1].contacts[0];
 expect((await post(['agreements',a.id,'resend-invitation'],body)).status).toBe(200);expect(mocks.queueAgreement).toHaveBeenCalledOnce();
 expect(mocks.command.mock.invocationCallOrder[0]).toBeLessThan(mocks.queueAgreement.mock.invocationCallOrder[0]);
});
