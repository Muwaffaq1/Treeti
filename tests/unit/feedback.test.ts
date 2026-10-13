import {afterEach,describe,expect,it,vi} from 'vitest';
import {feedbackSchema,isOwner,ownerEmails} from '@/modules/feedback/feedback';
import {shouldAskForFeedback} from '@/components/feedback';

afterEach(()=>vi.unstubAllEnvs());
const day=86400000,now=1_800_000_000_000;
const ready={prompt:null,visits:5,installPrompt:String(now-day),installed:false,automated:false,now};

describe('feedback',()=>{
  it('accepts a rating, a message or both, and nothing else',()=>{
    expect(feedbackSchema.parse({rating:4})).toMatchObject({rating:4,message:''});
    expect(feedbackSchema.parse({message:'  Helpful.  ',page:'/agreements/new'})).toMatchObject({message:'Helpful.',page:'/agreements/new'});
    for(const bad of [{},{message:'   '},{rating:0},{rating:6},{rating:2.5},{message:'x'.repeat(2001)},{rating:3,page:'https://untrusted.example'},{rating:3,page:'x'.repeat(201)}])expect(feedbackSchema.safeParse(bad).success,JSON.stringify(bad).slice(0,60)).toBe(false);
  });
  it('lets only the configured operator read it',()=>{
    const person=(contact:string,demo=false)=>({contacts:[contact],demo});
    expect(ownerEmails()).toEqual([]);expect(isOwner(person('owner@example.test'))).toBe(false);
    vi.stubEnv('AHD_OWNER_EMAILS',' Owner@Example.test , second@example.test,not-an-email');
    expect(ownerEmails()).toEqual(['owner@example.test','second@example.test']);
    expect(isOwner(person('OWNER@example.test'))).toBe(true);expect(isOwner(person('second@example.test'))).toBe(true);
    expect(isOwner(person('someone@example.test'))).toBe(false);expect(isOwner(person('owner@example.test.untrusted.example'))).toBe(false);
    expect(isOwner(person('owner@example.test',true))).toBe(false);
  });
  it('invites feedback only after someone has looked around and answered the install prompt',()=>{
    expect(shouldAskForFeedback(ready)).toBe(true);
    expect(shouldAskForFeedback({...ready,visits:4})).toBe(false);
    expect(shouldAskForFeedback({...ready,installPrompt:null})).toBe(false);
    expect(shouldAskForFeedback({...ready,installPrompt:null,installed:true})).toBe(true);
    expect(shouldAskForFeedback({...ready,automated:true})).toBe(false);
    expect(shouldAskForFeedback({...ready,automated:true,visits:0,installPrompt:null,prompt:'show'})).toBe(true);
  });
  it('then leaves people alone: 30 days after "Not now", 90 days after sending',()=>{
    expect(shouldAskForFeedback({...ready,prompt:`later:${now-29*day}`})).toBe(false);
    expect(shouldAskForFeedback({...ready,prompt:`later:${now-31*day}`})).toBe(true);
    expect(shouldAskForFeedback({...ready,prompt:`sent:${now-89*day}`})).toBe(false);
    expect(shouldAskForFeedback({...ready,prompt:`sent:${now-91*day}`})).toBe(true);
    expect(shouldAskForFeedback({...ready,prompt:'nonsense'})).toBe(true);
  });
});
