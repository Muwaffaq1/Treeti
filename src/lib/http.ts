import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from '@/modules/agreements/domain';
export function json(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
export function failure(error:unknown){
  // `home` lets a page left open on an old address move itself to the current one.
  if(error instanceof DomainError)return json({code:error.code,message:error.message,...(error.code==='ORIGIN_REJECTED'&&process.env.AHD_APP_URL?{home:new URL(process.env.AHD_APP_URL).origin}:{})},error.status);
  if(error instanceof ZodError)return json({code:'VALIDATION_ERROR',message:error.issues[0]?.message||'Check the form and try again.',issues:error.issues},422);
  if((error as {code?:string})?.code==='23505')return json({code:'ALREADY_RECORDED',message:'This action is already recorded or the verification was used. Reload before trying again.'},409);
  console.error('treeti request failed',{type:error instanceof Error?error.name:'unknown'});
  return json({code:'REQUEST_FAILED',message:'Your action was not recorded. Check your connection and try again.'},500);
}
export function checkOrigin(req:Request){
  const origin=req.headers.get('origin'),url=new URL(req.url);
  const expected=process.env.AHD_APP_URL?new URL(process.env.AHD_APP_URL).origin:url.origin;
  const allowed=process.env.NODE_ENV==='production'?[expected]:[expected,'http://localhost:3000','http://127.0.0.1:3000'];
  if(!origin||!allowed.includes(origin))throw new DomainError('ORIGIN_REJECTED',`Open treeti at ${new URL(expected).host} and try again.`,403);
}
export async function readBody(req:Request){const text=await req.text();if(text.length>20000)throw new DomainError('REQUEST_TOO_LARGE','Shorten the note or terms and try again.',413);try{return JSON.parse(text);}catch{throw new DomainError('INVALID_JSON','Check the form and try again.',400);}}
export function idempotencyKey(req:Request){const key=req.headers.get('Idempotency-Key');if(!key||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw new DomainError('REQUEST_KEY_REQUIRED','Reload the page and try again.',400);return key;}
