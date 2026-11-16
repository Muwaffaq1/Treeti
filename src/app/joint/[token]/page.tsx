import {WorkspacePage} from '@/components/workspace-page';
import {JointInvitation} from '@/components/investment-agreement';
import {getRuntime} from '@/lib/runtime';
import {investmentAgreementRepository} from '@/modules/investment-agreements/repository';
import {invitationSummary} from '@/modules/investment-agreements/api';
export const dynamic='force-dynamic';
/** An investment agreement invitation. Signed out: say who sent it and which contact to sign in with. */
export default async function JointInvitationPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  let signedIn=false;try{await getRuntime(false);signedIn=true;}catch{}
  if(signedIn)return <WorkspacePage demo={false} path={['joint',token]}/>;
  let summary=null;try{summary=await invitationSummary(investmentAgreementRepository(false),token);}catch{}
  return <main className="public-invitation"><JointInvitation token={token} summary={summary} authenticated={false} demo={false}/></main>;
}
