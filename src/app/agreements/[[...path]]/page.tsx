import {WorkspacePage} from '@/components/workspace-page';
export const dynamic='force-dynamic';
export default async function AgreementsPage({params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;return <WorkspacePage demo={false} path={['agreements',...path]}/>;}
