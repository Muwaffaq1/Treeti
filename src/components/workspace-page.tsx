import {redirect,notFound} from 'next/navigation';
import {getRuntime} from '@/lib/runtime';
import {DomainError,member,projectAgreement} from '@/modules/agreements/domain';
import {Shell,Account,DemoStart,Guide} from './shell';
import {DebtTracker} from './debts';
import {debtRepository} from '@/modules/debts/repository';
import {investmentRepository} from '@/modules/investments/repository';
import {InvestmentTracker} from './investments';
import {Activity,Dashboard} from './dashboard';
import {CreateAgreement} from './create-agreement';
import {AgreementDetail} from './agreement-detail';
import {InvitationPage} from './auth';
import {Verification} from './verification';
import {Notifications} from './notifications';
import {notices,recordedNotices} from '@/modules/notifications/feed';
import {database} from '@/lib/database';
import {FeedbackPage} from './feedback';
import {isOwner,listDemoFeedback,listFeedback} from '@/modules/feedback/feedback';
import {demoNumbers,operatorNumbers} from '@/modules/feedback/numbers';
import {demoPeople} from '@/modules/agreements/demo-people';
export async function WorkspacePage({demo,path=[]}:{demo:boolean;path?:string[]}){
  let runtime;try{runtime=await getRuntime(demo);}catch(e){if(e instanceof DomainError&&e.code==='DEMO_DISABLED')notFound();if(e instanceof DomainError&&[401,503].includes(e.status)){if(demo)return <DemoStart/>;redirect(`/login?next=${encodeURIComponent(path.length?`/${path.join('/')}`:'/app')}`);}throw e;}
  const {actor,repo,people,workspace}=runtime;
  if(actor.needsName&&!demo)redirect(`/welcome?next=${encodeURIComponent(path.length?`/${path.join('/')}`:'/app')}`);
  let content:React.ReactNode;
  if(!path.length||path[0]==='app')content=<Dashboard invitations={await repo.pendingInvitations(actor)} agreements={(await repo.list(actor)).map(a=>projectAgreement(a,actor))} actor={actor} demo={demo}/>;
  else if(path[0]==='agreements'&&!path[1])content=<Dashboard invitations={await repo.pendingInvitations(actor)} agreements={(await repo.list(actor)).map(a=>projectAgreement(a,actor))} actor={actor} demo={demo} listing/>;
  else if(path[0]==='agreements'&&path[1]==='new')content=<CreateAgreement actor={actor} demo={demo}/>;
  else if(path[0]==='debts')content=<DebtTracker key={actor.userId} initial={await debtRepository(demo,workspace).listDebts(actor)} demo={demo} emailAvailable={false}/>;
  else if(path[0]==='investments'&&path.length===1)content=<InvestmentTracker key={actor.userId} initial={await investmentRepository(demo,workspace).listInvestments(actor)} demo={demo}/>;
  else if(path[0]==='agreements'&&/^[a-f0-9-]{36}$/.test(path[1]||'')){const a=await repo.get(path[1]);if(!a||!member(a,actor))notFound();const safe=projectAgreement(a,actor);if(path[2]==='edit'){if(member(a,actor)?.role!=='LENDER'||a.finalizedAt)notFound();content=<CreateAgreement actor={actor} demo={demo} existing={safe}/>;}else {content=<AgreementDetail initial={safe} actor={actor} demo={demo}/>;}}
  else if(path[0]==='activity')content=<Activity agreements={(await repo.list(actor)).map(a=>projectAgreement(a,actor))} demo={demo}/>;
  else if(path[0]==='notifications'&&path.length===1)content=<Notifications notices={demo?notices((await repo.list(actor)).map(a=>projectAgreement(a,actor)),await repo.pendingInvitations(actor),actor):await recordedNotices(database(),actor.userId)} userId={actor.userId} demo={demo}/>;
  else if(path[0]==='feedback'&&path.length===1){const reader=demo?actor.userId===demoPeople[0].userId:isOwner(actor);content=<FeedbackPage demo={demo} received={!reader?null:demo?listDemoFeedback(workspace!):await listFeedback(database())} numbers={!reader?null:demo?demoNumbers(await repo.list(actor),people?.length??0):await operatorNumbers(database())}/>;}
  else if(path[0]==='account')content=<Account actor={actor} demo={demo}/>;
  else if(path[0]==='guide')content=<Guide/>;
  else if(path[0]==='invite'&&path[1])content=<InvitationPage token={path[1]} demo={demo} authenticated actorName={actor.name}/>;
  else if(path[0]==='verify'&&path[1])content=<Verification publicId={path[1]} demo={demo}/>;
  else notFound();
  return <Shell actor={actor} demo={demo} people={people}>{content}</Shell>;
}
