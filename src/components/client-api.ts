export class ApiError extends Error{constructor(message:string,public code:string,public status:number){super(message);}}
export async function api<T>(url:string,body?:unknown,key?:string):Promise<T>{const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const data=await response.json();if(!response.ok)throw new ApiError(data.message||'Unable to save. Check your connection and try again.',data.code,response.status);return data;}
export const apiBase=(demo:boolean)=>demo?'/api/demo':'/api';
export const appBase=(demo:boolean)=>demo?'/demo':'';
