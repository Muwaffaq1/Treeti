import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {stagingRedirect} from '@/lib/staging-origin';
export async function proxy(request:NextRequest) {
  const destination=stagingRedirect(request);
  if(destination){const redirect=NextResponse.redirect(destination,307);redirect.headers.set('Cache-Control','private, no-store');return redirect;}
  let response=NextResponse.next({request});
  response.headers.set('Cache-Control','private, no-store');
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return response;
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){for(const {name,value} of values)request.cookies.set(name,value);response=NextResponse.next({request});for(const {name,value,options}of values)response.cookies.set(name,value,options);}}});
  await supabase.auth.getClaims(); response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/','/login','/welcome','/app/:path*','/account/:path*','/activity/:path*','/notifications/:path*','/agreements/:path*','/debts/:path*','/investments/:path*','/launch','/guide','/privacy','/terms','/support','/verify/:path*','/invite/:path*','/api/auth/:path*','/api/agreements/:path*','/api/debts/:path*','/api/investments/:path*','/api/notifications','/api/push/:path*']};
