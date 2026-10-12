import {profileName} from './profile-name';
import {redirect} from 'next/navigation';
import {authConfigured, supabaseServer} from './supabase/server';
import {authReturnPath} from './auth-return';

// Revalidate with Auth; a cookie alone must never select a private destination.
export async function redirectSignedInUser(destination?: string) {
  if (!authConfigured()) return;
  const {data: {user}, error} = await (await supabaseServer()).auth.getUser();
  if (!error && user) redirect(profileName(user.user_metadata)?authReturnPath(destination):`/welcome?next=${encodeURIComponent(authReturnPath(destination))}`);
}
