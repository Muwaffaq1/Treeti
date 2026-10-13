import {Login} from '@/components/auth';
import {signInConfigured} from '@/lib/supabase/server';
import {demoEnabled} from '@/modules/agreements/demo';
// Prebuilt: the destination and any sign-in error are read from the address in the browser.
export default function LoginPage(){return <Login configured={signInConfigured()} demoAvailable={demoEnabled()}/>;}
