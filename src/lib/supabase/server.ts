import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { sharedRateLimitConfigured } from '../rate-limit';
export const authConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Hosted sign-in must not offer a form whose verification is blocked by setup.
export const signInConfigured = () => authConfigured() && (process.env.NODE_ENV !== 'production' || sharedRateLimitConfigured());
export async function supabaseServer() {
  if (!authConfigured()) throw new Error('Supabase Auth is not configured.');
  const jar=await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll(){return jar.getAll();},setAll(values){try{for(const {name,value,options} of values)jar.set(name,value,options);}catch{/* Server components cannot refresh cookies; proxy handles refresh. */}}}});
}
export function supabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Private storage is not configured.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
