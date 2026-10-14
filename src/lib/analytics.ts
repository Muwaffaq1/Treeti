/**
 * Anonymous usage statistics. What leaves the browser is a short event name, the kind of
 * screen (never a record's address), and a few fixed labels such as the repayment structure.
 * Never names, contacts, amounts, written text or record identifiers; no cookies or storage;
 * no screen recording. Off unless a project key is configured, and only on the live site.
 */
import {analytics} from '../../scripts/analytics-config.mjs';

type Value=string|number|boolean|null;
export type Properties=Record<string,Value>;
const LIVE_HOST='usetreeti.xyz';

/** A screen's address with anything that identifies a record or person removed. */
export function cleanPath(pathname:string){
  return (pathname.split(/[?#]/)[0]||'/')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,'/:id')
    .replace(/^\/invite\/[^/]+/,'/invite/:token')
    .replace(/^\/verify\/[^/]+/,'/verify/:record')
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g,'/:id');
}
/** Our own addresses keep only the cleaned path; other sites keep only their origin. */
export function cleanUrl(value:string,origin:string){
  try{const url=new URL(value,origin);return url.origin===origin?origin+cleanPath(url.pathname):url.origin;}catch{return '';}
}
/** Applied to every outgoing event as a last line of defence, including the library's own fields. */
export function sanitize(properties:Record<string,unknown>,origin:string){
  const out:Record<string,unknown>={};
  for(const [key,value] of Object.entries(properties)){
    if(key==='title'||key==='$title')continue;
    if(typeof value==='string'&&/^https?:\/\//.test(value))out[key]=cleanUrl(value,origin);
    else if(typeof value==='string'&&/(pathname|path)$/.test(key))out[key]=cleanPath(value);
    else out[key]=value;
  }
  return out;
}
/** The event for a successful request to our own API, from its address alone (the body is never read). */
export function requestEvent(url:string):{event:string;properties?:Properties}|null{
  const path=cleanPath(url);
  if(path.startsWith('/api/demo'))return null;
  if(path==='/api/auth/send')return {event:'sign_in_code_requested'};
  if(path==='/api/auth/verify')return {event:'signed_in'};
  if(path==='/api/auth/profile')return {event:'profile_completed'};
  if(path==='/api/agreements')return {event:'agreement_drafted'};
  const action=path.match(/^\/api\/agreements\/:id\/([a-z-]+)$/)?.[1];
  if(action)return {event:'agreement_action',properties:{action}};
  if(/^\/api\/(pending-)?invitations\/:(id|token)\/claim$/.test(path)||/^\/api\/(pending-)?invitations\/[^/]+\/claim$/.test(path))return {event:'invitation_opened'};
  if(path==='/api/debts')return {event:'debt_recorded'};
  if(/^\/api\/debts\/:id\/payments$/.test(path))return {event:'debt_payment_recorded'};
  if(path==='/api/investments')return {event:'investment_recorded'};
  if(path==='/api/feedback')return {event:'feedback_sent'};
  if(path==='/api/push/subscribe')return {event:'notifications_enabled'};
  return null;
}
export function analyticsEnabled(at:{hostname:string},browser:{webdriver?:boolean;doNotTrack?:string|null;globalPrivacyControl?:boolean}){
  return !!analytics.key&&!!analytics.host&&at.hostname===LIVE_HOST&&!browser.webdriver&&browser.doNotTrack!=='1'&&!browser.globalPrivacyControl;
}

type Client={capture:(event:string,properties?:Record<string,unknown>)=>void};
let client:Promise<Client|null>|undefined;
function load():Promise<Client|null>{
  if(typeof window==='undefined')return Promise.resolve(null);
  return client??=(async()=>{
    if(!analyticsEnabled(window.location,navigator as Navigator&{globalPrivacyControl?:boolean}))return null;
    try{
      const {default:posthog}=await import('posthog-js'),origin=window.location.origin;
      posthog.init(analytics.key,{
        api_host:analytics.host,cookieless_mode:'always',person_profiles:'never',
        autocapture:false,capture_pageview:false,capture_pageleave:true,rageclick:false,
        disable_session_recording:true,disable_surveys:true,disable_conversations:true,disable_web_experiments:true,advanced_disable_flags:true,
        disable_external_dependency_loading:true,capture_performance:false,capture_exceptions:false,capture_dead_clicks:false,capture_heatmaps:false,
        mask_all_text:true,mask_all_element_attributes:true,
        before_send:event=>{if(event)event.properties=sanitize(event.properties,origin);return event;},
      });
      return posthog;
    }catch{return null;}
  })();
}
/** Counts something that happened. Never throws and never delays the page. */
export function track(event:string,properties?:Properties){void load().then(c=>c?.capture(event,properties)).catch(()=>{});}
export function trackScreen(pathname:string){void load().then(c=>c?.capture('$pageview',{$current_url:window.location.origin+cleanPath(pathname)})).catch(()=>{});}
