import {WorkspacePage} from '@/components/workspace-page';
import {TrustedInvitation} from '@/components/trusted-contacts';
import {getRuntime} from '@/lib/runtime';
import {maskContact} from '@/lib/contact';
import {trustedRepository} from '@/modules/trusted/repository';
export const dynamic='force-dynamic';
export default async function TrustedInvitationPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  let signedIn=false;try{await getRuntime(false);signedIn=true;}catch{}
  if(signedIn)return <WorkspacePage demo={false} path={['trusted',token]}/>;
  // Signed out: say who sent it and which email to use, then send them through sign-in and back here.
  let invited=null;try{if(/^[A-Za-z0-9_-]{43}$/.test(token))invited=await trustedRepository(false).byToken(token);}catch{}
  const active=invited?.status==='INVITED';
  return <main className="public-invitation"><TrustedInvitation token={token} ownerName={active?invited!.ownerName:null} maskedEmail={active?maskContact(invited!.email):null} authenticated={false} demo={false}/></main>;
}
