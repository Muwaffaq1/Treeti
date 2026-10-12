import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {readSession} from '@/lib/session';
import type {DemoSession} from '@/lib/runtime';
import {demoEnabled} from '@/modules/agreements/demo';
export default async function Launch({searchParams}:{searchParams:Promise<{view?:string}>}){
  const session=readSession<DemoSession>((await cookies()).get('ahd_demo')?.value),{view}=await searchParams;
  const demo=demoEnabled()&&session&&session.expiresAt>Date.now();
  const path=view==='debts'?'/debts':view==='new'?'/agreements/new':'';
  redirect(demo?`/demo${path}`:path||'/app');
}
