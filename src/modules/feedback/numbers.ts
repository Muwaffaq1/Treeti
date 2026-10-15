import type {Database} from '@/lib/database';
import type {Aggregate} from '@/modules/agreements/types';

/** treeti went public on this day (Lagos time); "since launch" counts from here. */
export const LAUNCH_DAY='2026-10-14';
export type OperatorNumbers={
  agreements:{total:number;sinceLaunch:number;today:number;byStatus:Record<string,number>};
  people:{total:number;sinceLaunch:number;creators:number;repeatCreators:number};
  recordedMinor:string;
  days:{day:string;signups:number;agreements:number}[];
};
const STATUS_LABELS:Record<string,string>={AWAITING_BORROWER:'Waiting for the borrower',CHANGES_REQUESTED:'Changes requested',AWAITING_APPROVAL:'Waiting for approval',AWAITING_WITNESSES:'Waiting for witnesses',ACTIVE:'Active',SETTLEMENT_PENDING:'Settling',SETTLED:'Settled',DECLINED:'Declined',CANCELLED:'Cancelled',DRAFT:'Draft'};
export const statusLabel=(status:string)=>STATUS_LABELS[status]??status;
/** Agreements that became binding; their original amounts make the "recorded" total. */
const RECORDED=['ACTIVE','SETTLEMENT_PENDING','SETTLED'];

/** The operator's overview, in one read-only query. Counts only: no names, contacts or terms. */
export async function operatorNumbers(db:Database,now=new Date()):Promise<OperatorNumbers>{
  const [row]=await db.query<{status:Record<string,number>|null;total:number;since:number;today:number;recorded:string;creators:number;repeat:number;people:number;people_since:number;days:{day:string;signups:number;agreements:number}[]}>(`
    with a as (select status,created_by,original_principal_minor m,(created_at at time zone 'Africa/Lagos')::date d from agreements),
    u as (select (created_at at time zone 'Africa/Lagos')::date d from auth.users),
    today as (select ($1::timestamptz at time zone 'Africa/Lagos')::date t),
    days as (select generate_series((select t from today)-6,(select t from today),interval '1 day')::date d)
    select
      (select jsonb_object_agg(status,n) from (select status,count(*)::int n from a group by status) s) status,
      (select count(*)::int from a) total,
      (select count(*)::int from a where d>=$2::date) since,
      (select count(*)::int from a where d=(select t from today)) today,
      (select coalesce(sum(m) filter (where status=any($3)),0)::text from a) recorded,
      (select count(distinct created_by)::int from a) creators,
      (select count(*)::int from (select created_by from a group by created_by having count(*)>1) r) repeat,
      (select count(*)::int from u) people,
      (select count(*)::int from u where d>=$2::date) people_since,
      (select jsonb_agg(jsonb_build_object('day',to_char(days.d,'YYYY-MM-DD'),'signups',(select count(*) from u where u.d=days.d),'agreements',(select count(*) from a where a.d=days.d)) order by days.d desc) from days) days`,
    [now.toISOString(),LAUNCH_DAY,RECORDED]);
  return {agreements:{total:row.total,sinceLaunch:row.since,today:row.today,byStatus:row.status??{}},people:{total:row.people,sinceLaunch:row.people_since,creators:row.creators,repeatCreators:row.repeat},recordedMinor:row.recorded,days:(row.days??[]).map(d=>({day:d.day,signups:Number(d.signups),agreements:Number(d.agreements)}))};
}

/** The same overview for the demonstration, from the sample agreements the operator can see. */
export function demoNumbers(agreements:Aggregate[],people:number,now=new Date()):OperatorNumbers{
  const byStatus:Record<string,number>={},creators=new Map<string,number>(),day=(iso:string)=>new Date(iso).toISOString().slice(0,10),today=day(now.toISOString());
  for(const a of agreements){byStatus[a.status]=(byStatus[a.status]??0)+1;creators.set(a.createdBy,(creators.get(a.createdBy)??0)+1);}
  const days=Array.from({length:7},(_,i)=>{const d=day(new Date(now.getTime()-i*86400000).toISOString());return {day:d,signups:0,agreements:agreements.filter(a=>day(a.createdAt)===d).length};});
  const recorded=agreements.filter(a=>RECORDED.includes(a.status)).reduce((sum,a)=>sum+BigInt(a.versions[0]?.terms.principalMinor??"0"),BigInt(0));
  return {agreements:{total:agreements.length,sinceLaunch:agreements.filter(a=>day(a.createdAt)>=LAUNCH_DAY).length,today:agreements.filter(a=>day(a.createdAt)===today).length,byStatus},people:{total:people,sinceLaunch:people,creators:creators.size,repeatCreators:[...creators.values()].filter(n=>n>1).length},recordedMinor:recorded.toString(),days};
}
