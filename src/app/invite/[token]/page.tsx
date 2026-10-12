import {InvitationPage} from '@/components/auth';
import {getRuntime} from '@/lib/runtime';
export const dynamic='force-dynamic';
export default async function InvitePage({params}:{params:Promise<{token:string}>}){const {token}=await params;let actor;try{actor=(await getRuntime(false)).actor;}catch{}return <main className="public-invitation"><InvitationPage token={token} demo={false} authenticated={!!actor} actorName={actor?.name}/></main>;}
