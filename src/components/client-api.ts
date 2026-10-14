import {requestEvent,track} from '@/lib/analytics';
export class ApiError extends Error{constructor(message:string,public code:string,public status:number){super(message);}}
/** Where a page opened on an old treeti address should go; null when it is already on the current one. */
export function currentAddress(home:unknown,at:{origin:string;pathname:string;search:string}):string|null{
  if(typeof home!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(home)||home===at.origin)return null;
  return home+at.pathname+at.search;
}
export async function api<T>(url:string,body?:unknown,key?:string):Promise<T>{const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});let data;try{data=await response.json();}catch{throw new ApiError('treeti is busy right now. Wait a moment and try again.','UNAVAILABLE',response.status);}if(!response.ok){const home=response.status===403&&data.code==='ORIGIN_REJECTED'&&typeof window!=='undefined'?currentAddress(data.home,window.location):null;if(home)window.location.replace(home);throw new ApiError(data.message||'Unable to save. Check your connection and try again.',data.code,response.status);}if(body!==undefined){const counted=requestEvent(url);if(counted)track(counted.event,counted.properties);}return data;}
export const apiBase=(demo:boolean)=>demo?'/api/demo':'/api';
export const appBase=(demo:boolean)=>demo?'/demo':'';
