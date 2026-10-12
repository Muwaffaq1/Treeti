import {profileName} from '@/lib/profile-name';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
import {readSession} from '@/lib/session';
import {authReturnPath} from '@/lib/auth-return';
import type {Challenge} from '@/app/api/auth/[action]/route';

export async function GET(req:Request) {
  const url=new URL(req.url),origin=new URL(process.env.AHD_APP_URL||url.origin).origin;
  const jar=await cookies(),challenge=readSession<Challenge>(jar.get('ahd_challenge')?.value);
  const redirect=(path:string)=>NextResponse.redirect(new URL(path,origin),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  // Links never authorize agreement actions. PKCE also requires this browser's verifier.
  if(!url.searchParams.get('code')||!challenge||challenge.expiresAt<=Date.now()||challenge.agreementId&&!challenge.invitationToken)return redirect('/login?authError=link');
  try {
    const supabase=await supabaseServer(),{data,error}=await supabase.auth.exchangeCodeForSession(url.searchParams.get('code')!);
    if(error||!data.user)return redirect('/login?authError=link');
    const contacts=[data.user.email_confirmed_at?data.user.email:null,data.user.phone_confirmed_at?`+${data.user.phone?.replace(/^\+/,'')}`:null];
    if(!contacts.includes(challenge.contact)||challenge.userId&&challenge.userId!==data.user.id){await supabase.auth.signOut();return redirect('/login?authError=identity');}
    jar.delete('ahd_challenge');jar.delete('ahd_grant');
    const next=authReturnPath(challenge.returnTo);
    return redirect(!challenge.invitationToken&&!profileName(data.user.user_metadata)?`/welcome?next=${encodeURIComponent(next)}`:next);
  }catch{return redirect('/login?authError=link');}
}
