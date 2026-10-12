import {redirect} from 'next/navigation';
import {getRuntime} from '@/lib/runtime';
import {authReturnPath} from '@/lib/auth-return';
import {CompleteProfile} from '@/components/auth';
import {DomainError} from '@/lib/domain-error';
export const dynamic='force-dynamic';
export default async function Welcome({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const next=authReturnPath((await searchParams).next);
  let actor;try{actor=(await getRuntime(false)).actor;}catch(e){if(e instanceof DomainError&&e.status===401)redirect(`/login?next=${encodeURIComponent(next)}`);throw e;}
  if(!actor.needsName)redirect(next);
  return <main className="public-invitation"><CompleteProfile next={next}/></main>;
}
