import {WorkspacePage} from '@/components/workspace-page';
export const dynamic='force-dynamic';
export default async function InvestmentsPage({params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;return <WorkspacePage demo={false} path={['investments',...path]}/>;}
