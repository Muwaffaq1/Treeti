import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {queueAgreementDelivery,queueDebtReminder} from '@/modules/notifications/wakeups';
const mocks=vi.hoisted(()=>({tasks:[] as (()=>Promise<void>)[],send:vi.fn(),rejectAfter:false}));
vi.mock('next/server',()=>({after:(task:()=>Promise<void>)=>{if(mocks.rejectAfter)throw new Error('Host callback unavailable');mocks.tasks.push(task);}}));
vi.mock('@/modules/notifications/client',()=>({inngest:{send:mocks.send}}));
beforeEach(()=>{vi.stubEnv('INNGEST_EVENT_KEY','synthetic-event-key');mocks.tasks.length=0;mocks.rejectAfter=false;vi.clearAllMocks();mocks.send.mockResolvedValue({ids:['synthetic']});});
afterEach(()=>vi.unstubAllEnvs());

describe('post-commit job wakeups',()=>{
  it('waits until after the response and sends only an opaque agreement scope',async()=>{
    queueAgreementDelivery('agreement-id','actor-id','request-key');
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.tasks).toHaveLength(1);
    await mocks.tasks[0]();
    expect(mocks.send).toHaveBeenCalledWith({id:expect.stringMatching(/^outbox-[a-f0-9]{64}$/),name:'ahd/jobs/deliver-outbox',data:{agreementId:'agreement-id'}});
    expect(JSON.stringify(mocks.send.mock.calls)).not.toContain('actor-id');
  });
  it('deduplicates request replays while distinguishing different actors and actions',async()=>{
    queueAgreementDelivery('a','actor','one');queueAgreementDelivery('a','actor','one');queueAgreementDelivery('a','other','one');queueAgreementDelivery('a','actor','two');
    await Promise.all(mocks.tasks.map(task=>task()));
    const ids=mocks.send.mock.calls.map(([event])=>event.id);
    expect(ids[0]).toBe(ids[1]);expect(new Set(ids).size).toBe(3);
  });
  it('uses the saved reminder ID and timestamp without disclosing debt details',async()=>{
    queueDebtReminder({id:'reminder-id',email:true,remindAt:'2026-10-10T08:00:00.000Z',timeZone:'Africa/Lagos'});
    await mocks.tasks[0]();
    expect(mocks.send).toHaveBeenCalledWith({id:'personal-reminder-reminder-id',name:'ahd/jobs/personal-debt-reminders',data:{reminderId:'reminder-id'},ts:Date.parse('2026-10-10T08:00:00.000Z')});
  });
  it('does not enqueue cancelled, in-app-only, sent or terminally failed reminders',()=>{
    const reminder={id:'r',email:true,remindAt:'2026-10-10T08:00:00.000Z',timeZone:'Africa/Lagos'};
    for(const value of [null,undefined,{...reminder,email:false},{...reminder,emailSentAt:'2026-10-10T08:00:01.000Z'},{...reminder,emailFailed:true}])queueDebtReminder(value);
    expect(mocks.tasks).toHaveLength(0);
  });
  it('does not affect committed state when event submission fails',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    mocks.send.mockRejectedValue(new Error('provider response with sensitive detail'));
    queueAgreementDelivery('a','actor','key');await expect(mocks.tasks[0]()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('treeti background wakeup failed',{type:'JOB_EVENT_SEND_FAILED',job:'ahd/jobs/deliver-outbox'});log.mockRestore();
  });
  it('leaves unconfigured installations without background side effects',()=>{
    vi.stubEnv('INNGEST_EVENT_KEY','');queueAgreementDelivery('a','actor','key');
    expect(mocks.tasks).toHaveLength(0);
  });
  it('preserves a successful API action even if the host rejects callback registration',()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});mocks.rejectAfter=true;
    expect(()=>queueAgreementDelivery('a','actor','key')).not.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();expect(log).toHaveBeenCalledOnce();log.mockRestore();
  });
});
