import {describe,expect,it} from 'vitest';
import {analyticsEnabled,cleanPath,cleanUrl,requestEvent,sanitize} from '@/lib/analytics';
import {analytics} from '../../scripts/analytics-config.mjs';
import {securityHeaders} from '../../scripts/security-headers.mjs';

const id='0c2f7a3e-1b4d-4c5e-8f9a-123456789abc',token='w'.repeat(43),origin='https://usetreeti.xyz';
describe('usage statistics',()=>{
  it('never carry a record, invitation or verification address',()=>{
    expect(cleanPath(`/agreements/${id}`)).toBe('/agreements/:id');
    expect(cleanPath(`/agreements/${id}/edit?reason=Late#top`)).toBe('/agreements/:id/edit');
    expect(cleanPath(`/invite/${token}?next=%2Fapp`)).toBe('/invite/:token');
    expect(cleanPath('/verify/TREETI-2026-00133')).toBe('/verify/:record');
    expect(cleanPath(`/api/agreements/${id}/documents/${id}`)).toBe('/api/agreements/:id/documents/:id');
    for(const path of ['/','/login','/app','/agreements/new','/debts','/feedback'])expect(cleanPath(path)).toBe(path);
    expect(cleanUrl(`${origin}/agreements/${id}?x=1`,origin)).toBe(`${origin}/agreements/:id`);
    expect(cleanUrl('https://chat.whatsapp.example/thread/abc?phone=2348012345678',origin)).toBe('https://chat.whatsapp.example');
  });
  it('clean every outgoing field, including the library’s own, and drop page titles',()=>{
    const sent=sanitize({$current_url:`${origin}/invite/${token}?next=%2Fagreements%2F${id}`,$pathname:`/agreements/${id}`,$prev_pageview_pathname:`/verify/TREETI-2026-00133`,$referrer:`${origin}/agreements/${id}`,$referring_domain:'usetreeti.xyz',title:'Ahmad Ibrahim · treeti',structure:'CUSTOM',witnesses:2},origin);
    expect(sent).toEqual({$current_url:`${origin}/invite/:token`,$pathname:'/agreements/:id',$prev_pageview_pathname:'/verify/:record',$referrer:`${origin}/agreements/:id`,$referring_domain:'usetreeti.xyz',structure:'CUSTOM',witnesses:2});
    expect(JSON.stringify(sent)).not.toMatch(new RegExp(`${id}|${token}|TREETI-2026|Ahmad`));
  });
  it('name an action from the request address alone',()=>{
    expect(requestEvent('/api/auth/send')).toEqual({event:'sign_in_code_requested'});
    expect(requestEvent('/api/auth/verify')).toEqual({event:'signed_in'});
    expect(requestEvent('/api/agreements')).toEqual({event:'agreement_drafted'});
    expect(requestEvent(`/api/agreements/${id}/agree-and-send`)).toEqual({event:'agreement_action',properties:{action:'agree-and-send'}});
    expect(requestEvent(`/api/agreements/${id}/repayment`)).toEqual({event:'agreement_action',properties:{action:'repayment'}});
    expect(requestEvent(`/api/invitations/${token}/claim`)).toEqual({event:'invitation_opened'});
    expect(requestEvent(`/api/pending-invitations/${id}/claim`)).toEqual({event:'invitation_opened'});
    expect(requestEvent('/api/debts')).toEqual({event:'debt_recorded'});
    expect(requestEvent(`/api/debts/${id}/payments`)).toEqual({event:'debt_payment_recorded'});
    expect(requestEvent('/api/feedback')).toEqual({event:'feedback_sent'});
    expect(requestEvent('/api/push/subscribe')).toEqual({event:'notifications_enabled'});
    for(const quiet of ['/api/demo/agreements','/api/demo/feedback','/api/auth/sign-out','/api/push/unsubscribe',`/api/agreements/${id}/proof`.replace('proof','proof/x')])expect(requestEvent(quiet),quiet).toBeNull();
    expect(JSON.stringify(requestEvent(`/api/agreements/${id}/approve`))).not.toContain(id);
  });
  it('send nothing unless configured, and only from the live site for people who have not opted out',()=>{
    const configured=!!analytics.key&&!!analytics.host,live={hostname:'usetreeti.xyz'};
    expect(analyticsEnabled(live,{})).toBe(configured);
    for(const [at,browser] of [[{hostname:'localhost'},{}],[{hostname:'staging.usetreeti.xyz'},{}],[live,{webdriver:true}],[live,{doNotTrack:'1'}],[live,{globalPrivacyControl:true}]] as const)expect(analyticsEnabled(at,browser)).toBe(false);
  });
  it('open the content security policy only to the configured PostHog region',()=>{
    const policy=securityHeaders().find(h=>h.key==='Content-Security-Policy')!.value,connect=policy.match(/connect-src ([^;]*)/)![1];
    if(analytics.key){expect(analytics.host).toMatch(/^https:\/\/(eu|us)\.i\.posthog\.com$/);expect(connect).toBe(`'self' https://*.supabase.co ${analytics.host}`);}
    else expect(connect).toBe("'self' https://*.supabase.co");
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");expect(policy).not.toMatch(/script-src[^;]*posthog/);
  });
});
