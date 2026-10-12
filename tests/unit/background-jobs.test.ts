import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
type Job={options:{id:string};triggers:({event?:string;cron?:string})[];handler:(context:{event:{data:unknown};step:{run:(id:string,work:()=>Promise<unknown>)=>Promise<unknown>}})=>Promise<unknown>};
const mocks=vi.hoisted(()=>({reminders:vi.fn()}));
vi.mock('@/modules/notifications/client',()=>({inngest:{createFunction:(options:Job['options'],triggers:Job['triggers'],handler:Job['handler'])=>({options,triggers,handler})}}));
vi.mock('@/modules/debts/reminder-worker',()=>({processPersonalDebtReminders:mocks.reminders}));
vi.mock('@/modules/documents/service',()=>({ensureArtifact:vi.fn(),verifyIntegrity:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.resetModules();vi.stubEnv('AHD_JOB_SCHEDULES','false');mocks.reminders.mockResolvedValue({configured:true,considered:0,sent:0,retryable:0});});
afterEach(()=>vi.unstubAllEnvs());
const jobs=async()=>(await import('@/modules/notifications/worker')).functions as unknown as Job[];
const execute=(job:Job,data:unknown)=>job.handler({event:{data},step:{run:async(_,work)=>work()}});

describe('registered background delivery jobs',()=>{
  it('keeps three stable functions and no recurring sweeps in staging',async()=>{
    const functions=await jobs();expect(functions.map(f=>f.options.id)).toEqual(['personal-debt-reminders','deliver-outbox','gentle-date-reminders']);
    for(const fn of functions)expect(fn.triggers).toEqual([{event:`ahd/jobs/${fn.options.id}`}]);
  });
  it('retains both event wakeups and recovery schedules in production',async()=>{
    vi.stubEnv('AHD_JOB_SCHEDULES','true');
    for(const fn of await jobs()){expect(fn.triggers).toContainEqual({event:`ahd/jobs/${fn.options.id}`});expect(fn.triggers.some(t=>!!t.cron)).toBe(true);}
  });
  it('reloads only the scheduled reminder and surfaces retryable delivery failures to Inngest',async()=>{
    const fn=(await jobs())[0],reminderId=crypto.randomUUID();
    mocks.reminders.mockResolvedValueOnce({configured:true,considered:1,sent:0,retryable:1});
    await expect(execute(fn,{reminderId})).rejects.toThrow('REMINDER_RETRY_REQUIRED');
    expect(mocks.reminders).toHaveBeenCalledWith(reminderId);
    await expect(execute(fn,{reminderId})).resolves.toMatchObject({retryable:0});
  });
  it('rejects malformed resource scopes before reaching the database and permits manual recovery',async()=>{
    const fn=(await jobs())[0];await expect(execute(fn,{reminderId:'untrusted-scope'})).rejects.toThrow();expect(mocks.reminders).not.toHaveBeenCalled();
    await execute(fn,{});expect(mocks.reminders).toHaveBeenCalledWith(undefined);
  });
});
