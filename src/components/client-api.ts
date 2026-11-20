import {requestEvent,track} from '@/lib/analytics';
export class ApiError extends Error{constructor(message:string,public code:string,public status:number){super(message);}}
/** Where a page opened on an old treeti address should go; null when it is already on the current one. */
export function currentAddress(home:unknown,at:{origin:string;pathname:string;search:string}):string|null{
  if(typeof home!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(home)||home===at.origin)return null;
  return home+at.pathname+at.search;
}
/**
 * Cloudflare sometimes cuts a request off on a freshly started Worker (free-plan CPU limit) and answers with
 * its own error page instead of treeti's JSON. A second try usually lands on a warm Worker, so requests that
 * are safe to repeat are retried twice before the person sees an error: reads, and writes that carry an
 * Idempotency-Key (the server records those once). Sign-in codes and other unkeyed writes are never repeated.
 */
const cutOff=(status:number)=>status===502||status===503||status===504||(status>=520&&status<=527);
export async function api<T>(url:string,body?:unknown,key?:string):Promise<T>{
  const method=body===undefined?'GET':'POST',canRetry=method==='GET'||!!key;
  let response!:Response,data;
  for(let attempt=0;;attempt++){
    if(attempt)await new Promise(r=>setTimeout(r,attempt===1?400:1200));
    try{response=await fetch(url,{method,headers:body===undefined?undefined:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}
    catch(e){if(canRetry&&attempt<2)continue;throw e;}
    try{data=await response.json();break;}
    catch{if(canRetry&&attempt<2&&cutOff(response.status))continue;throw new ApiError('treeti is busy right now. Wait a moment and try again.','UNAVAILABLE',response.status);}
  }
  if(!response.ok){const home=response.status===403&&data.code==='ORIGIN_REJECTED'&&typeof window!=='undefined'?currentAddress(data.home,window.location):null;if(home)window.location.replace(home);throw new ApiError(data.message||'Unable to save. Check your connection and try again.',data.code,response.status);}if(body!==undefined){const counted=requestEvent(url);if(counted)track(counted.event,counted.properties);}return data;}
export const apiBase=(demo:boolean)=>demo?'/api/demo':'/api';
export const appBase=(demo:boolean)=>demo?'/demo':'';
