import {Login} from '@/components/auth';
import {signInConfigured} from '@/lib/supabase/server';
import {demoEnabled} from '@/modules/agreements/demo';
import {redirectSignedInUser} from '@/lib/signed-in-redirect';
export const dynamic='force-dynamic';
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string;authError?:string}>}){const {next,authError}=await searchParams;await redirectSignedInUser(next);return <Login configured={signInConfigured()} demoAvailable={demoEnabled()} next={next} authError={authError}/>;}
