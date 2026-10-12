import { mkdir, readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { digest, sha256 } from '@/lib/crypto';
import { applyCommand, claimInvitation, claimInvitationById, createAgreement, DomainError, member, sensitiveActions } from './domain';
import type { Actor, Aggregate, Command, Context, Participant } from './types';
import {pendingBorrowerInvitations} from './pending-invitations';
import type { Repository } from './repository';
import {demoPeople} from './demo-people';
import {createDebt,editDebt,recordDebtPayment,type PersonalDebt} from '@/modules/debts/model';
import {makeReminder} from '@/modules/debts/reminders';
import {createInvestment,changeInvestment,type Investment} from '@/modules/investments/model';
export {demoPeople} from './demo-people';
type State = { agreements: Aggregate[]; responses: Record<string, { hash: string; result: { agreement: Aggregate } }>; used: string[]; counter: number; personalDebts?:PersonalDebt[]; debtEdits?:{debtId:string;before:PersonalDebt;after:PersonalDebt}[]; debtResponses?:Record<string,{hash:string;debt:PersonalDebt}>; investments?:Investment[]; investmentResponses?:Record<string,{hash:string;investment:Investment}>; investmentRevisions?:Investment[] };
const guards = globalThis as typeof globalThis & { ahdDemoQueues?: Map<string, Promise<unknown>> };
const queues = guards.ahdDemoQueues ??= new Map();
export const demoEnabled = () => process.env.AHD_ENABLE_DEMO === 'true' || process.env.NODE_ENV === 'development';

export async function findDemoInvitationWorkspace(token: string): Promise<string | null> {
  try {
    const files = await readdir(join(process.cwd(), '.ahd-demo'));
    const tokenHash = sha256(token);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const workspace = file.slice(0, -5);
      if (!/^[a-f0-9-]{36}$/.test(workspace)) continue;
      const state = JSON.parse(await readFile(join(process.cwd(), '.ahd-demo', file), 'utf8')) as State;
      if (state.agreements.some(a => a.invitations.some(i => i.tokenHash === tokenHash))) return workspace;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return null;
}

// Unclaimed demo invitations still need a profile that can claim them. Derive a
// stable local-only identity from the participant's verified destination so a
// person entered during the demo can switch into that role without being added
// to the fixed sample roster.
function participantUserId(p: Participant): string {
  if (p.userId) return p.userId;
  const hex = createHash('sha256').update(`${p.contact}\0${p.name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function participantActor(p: Participant): Actor {
  const known = demoPeople.find(person => person.contacts.includes(p.contact));
  return known ?? { userId: participantUserId(p), name: p.name, contacts: [p.contact], demo: true };
}
export function demonstrationGrant(a: Aggregate, actor: Actor, action: string): NonNullable<Context['stepUp']> {
  return { id: randomUUID(), contact: actor.contacts[0], level: 'DEMO_SIMULATED', agreementId: a.id, versionId: a.currentVersionId, action, expiresAt: new Date(Date.now() + 300000).toISOString() };
}
function seed(): State {
  const now = new Date().toISOString(), actor = demoPeople[0];
  const state: State = { agreements: [], responses: {}, used: [], counter: 4 };
  const make = (principalMinor: string, purpose: string, borrower = demoPeople[1], requiredWitnesses = 2) => createAgreement({ borrowerName: borrower.name, borrowerContact: borrower.contacts[0], terms: { principalMinor, currency: 'NGN', interestMinor: '0', agreementDate: '2026-10-01', dueDate: '2027-04-08', repaymentType: 'SINGLE', purpose, additionalTerms: 'Early repayment is welcome. If circumstances change, we will discuss them together.', requiredWitnesses } }, { actor, now }, `TREETI-2026-00${128 + state.agreements.length}`);
  let active = make('30000000', 'A little support for a new beginning');
  const act = (a: Aggregate, user: Actor, action: string, extra: Record<string,unknown> = {}) => applyCommand(a, { action, expectedVersionId: a.currentVersionId, ...extra }, { actor: user, now, stepUp: demonstrationGrant(a,user,action) });
  let r = act(active, actor, 'send'); active = claimInvitation(r.agreement,r.invitation!.token,{actor: demoPeople[1],now});
  active = act(active, demoPeople[1], 'approve', { affirmed:true,signature:demoPeople[1].name }).agreement;
  active = act(active, actor, 'approve', { affirmed:true,signature:actor.name }).agreement;
  for(const w of demoPeople.slice(2,4)) { r=act(active,actor,'invite-witness',{name:w.name,contact:w.contacts[0]}); active=claimInvitation(r.agreement,r.invitation!.token,{actor:w,now}); active=act(active,w,'attest',{educated:true,affirmed:true,signature:w.name,type:'DIGITAL_ACKNOWLEDGEMENT',presence:'DOCUMENT_REVIEW'}).agreement; }
  active=act(active,actor,'finalize').agreement;
  active=act(active,demoPeople[1],'repayment',{amountMinor:'5000000',date:now.slice(0,10),method:'Bank transfer',reference:'DEMO-50K'}).agreement;
  active=act(active,actor,'confirm-repayment',{targetId:active.repayments[0].id}).agreement;
  state.agreements.push(active);
  let pending=make('15000000','School fees',demoPeople[4],1); r=act(pending,actor,'send'); pending=claimInvitation(r.agreement,r.invitation!.token,{actor:demoPeople[4],now}); state.agreements.push(pending);
  state.agreements.push(make('7500000','Family support',demoPeople[1],1));
  return state;
}
export class DemoRepository implements Repository {
  readonly path: string;
  constructor(readonly workspace: string) {
    if (!/^[a-f0-9-]{36}$/.test(workspace)) throw new Error('Invalid demo workspace');
    this.path=join(process.cwd(),'.ahd-demo',`${workspace}.json`);
  }
  private async read(): Promise<State> { try { return JSON.parse(await readFile(this.path,'utf8')); } catch (error) { if((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return seed(); } }
  async people(): Promise<Actor[]> {
    const state = await this.read();
    const people = [...demoPeople];
    for (const agreement of state.agreements) {
      for (const participant of agreement.participants) {
        const actor = participantActor(participant);
        if (!people.some(person => person.userId === actor.userId)) people.push(actor);
      }
    }
    return people;
  }
  private async transaction<T>(work:(state:State)=>Promise<T>|T):Promise<T> {
    const prior=queues.get(this.workspace)??Promise.resolve();
    const next=prior.catch(()=>{}).then(async()=>{const state=await this.read(); const result=await work(state); await mkdir(join(process.cwd(),'.ahd-demo'),{recursive:true}); const temp=`${this.path}.${randomUUID()}.tmp`; await writeFile(temp,JSON.stringify(state),{mode:0o600}); await rename(temp,this.path); return result; });
    queues.set(this.workspace,next); return next;
  }
  async all() { return this.transaction(state=>state.agreements); }
  async listInvestments(actor:Actor){return this.transaction(state=>(state.investments??[]).filter(record=>record.ownerId===actor.userId));}
  private async investmentWrite(id:string|null,input:unknown,actor:Actor,key:string){return this.transaction(state=>{
    state.investments??=[];state.investmentResponses??={};
    const requestKey=`${actor.userId}:${key}`,hash=digest({id,input}),prior=state.investmentResponses[requestKey];
    if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','This request key was used for different details.',409);return prior.investment;}
    const now=new Date().toISOString();let investment:Investment;
    if(id){const index=state.investments.findIndex(record=>record.id===id&&record.ownerId===actor.userId);if(index<0)throw new DomainError('NOT_FOUND','This investment record is unavailable.',404);investment=changeInvestment(state.investments[index],input,actor.userId,randomUUID(),now);state.investments[index]=investment;}
    else{investment=createInvestment(input,actor.userId,randomUUID(),randomUUID(),now);state.investments.unshift(investment);}
    state.investmentRevisions??=[];state.investmentRevisions.push(structuredClone(investment));
    state.investmentResponses[requestKey]={hash,investment:structuredClone(investment)};return investment;
  });}
  async createInvestment(input:unknown,actor:Actor,key:string){return this.investmentWrite(null,input,actor,key);}
  async changeInvestment(id:string,input:unknown,actor:Actor,key:string){return this.investmentWrite(id,input,actor,key);}
  async listDebts(actor:Actor){return this.transaction(state=>(state.personalDebts??[]).filter(d=>d.ownerId===actor.userId));}
  async setDebtReminder(id:string,input:unknown,actor:Actor,key:string){return this.transaction(state=>{
    state.debtResponses??={};const requestKey=`${actor.userId}:${key}`,hash=digest({action:'reminder',id,input}),prior=state.debtResponses[requestKey];
    if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','This request key was used for different details.',409);return prior.debt;}
    const debt=state.personalDebts?.find(d=>d.id===id&&d.ownerId===actor.userId);if(!debt)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
    const reminder=makeReminder(debt,input,randomUUID(),new Date().toISOString());
    if(reminder?.email)throw new DomainError('EMAIL_UNAVAILABLE','The demonstration does not send email. Save an in-app reminder and add it to your calendar.',422);
    debt.reminder=reminder;state.debtResponses[requestKey]={hash,debt:structuredClone(debt)};return debt;
  });}
  private async debtWrite(id:string|null,input:unknown,actor:Actor,key:string){return this.transaction(state=>{
    state.personalDebts??=[];state.debtResponses??={};const requestKey=`${actor.userId}:${key}`,hash=digest({id,input}),prior=state.debtResponses[requestKey];
    if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','This request key was used for another action. Try again.');return prior.debt;}
    const now=new Date().toISOString();let debt:PersonalDebt;
    if(id){const index=state.personalDebts.findIndex(d=>d.id===id&&d.ownerId===actor.userId);if(index<0)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);debt=recordDebtPayment(state.personalDebts[index],input,actor.userId,randomUUID(),now);state.personalDebts[index]=debt;}
    else{debt=createDebt(input,actor.userId,randomUUID(),now);state.personalDebts.unshift(debt);}
    state.debtResponses[requestKey]={hash,debt};return debt;
  });}
  async createDebt(input:unknown,actor:Actor,key:string){return this.debtWrite(null,input,actor,key);}
  async editDebt(id:string,input:unknown,actor:Actor,key:string){return this.transaction(state=>{
    state.debtResponses??={};const requestKey=`${actor.userId}:${key}`,hash=digest({action:'edit',id,input}),prior=state.debtResponses[requestKey];
    if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','Reload and try this action again.');return prior.debt;}
    const index=state.personalDebts?.findIndex(d=>d.id===id&&d.ownerId===actor.userId)??-1;if(index<0)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
    const before=state.personalDebts![index],debt=editDebt(before,input,actor.userId,new Date().toISOString());state.debtEdits??=[];state.debtEdits.push({debtId:id,before:structuredClone(before),after:structuredClone(debt)});state.personalDebts![index]=debt;
    state.debtResponses[requestKey]={hash,debt:structuredClone(debt)};return debt;
  });}
  async payDebt(id:string,input:unknown,actor:Actor,key:string){return this.debtWrite(id,input,actor,key);}
  async pendingInvitations(actor:Actor){return (await this.all()).flatMap(a=>pendingBorrowerInvitations(a,actor)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async claimPending(id:string,actor:Actor){return this.transaction(state=>{const index=state.agreements.findIndex(a=>a.invitations.some(i=>i.id===id&&a.participants.some(p=>p.id===i.participantId&&p.role==='BORROWER')));if(index<0)throw new DomainError('INVITATION_EXPIRED','This invitation is unavailable. Refresh your agreements or ask for a new invitation.',410);const a=claimInvitationById(state.agreements[index],id,{actor,now:new Date().toISOString()});state.agreements[index]=a;return a;});}
  async list(actor:Actor) { return (await this.all()).filter(a=>member(a,actor)); }
  async get(id:string) { return (await this.all()).find(a=>a.id===id)??null; }
  async create(input:unknown,actor:Actor,key:string) {
    return this.transaction(state=>{ const k=`${actor.userId}:${key}`,hash=digest(input); const prior=state.responses[k]; if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','Reload and try this action again.');return prior.result;}
      const agreement=createAgreement(input,{actor,now:new Date().toISOString()},`TREETI-${new Date().getUTCFullYear()}-${String(++state.counter+128).padStart(5,'0')}`); state.agreements.push(agreement);const result={agreement};state.responses[k]={hash,result};return result; });
  }
  async command(id:string,input:Command,actor:Actor,key:string,stepUp?:Context['stepUp']) {
    return this.transaction(state=>{const k=`${actor.userId}:${key}`,hash=digest({id,input});const prior=state.responses[k];if(prior){if(prior.hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','Reload and try this action again.');return prior.result;}
      const index=state.agreements.findIndex(a=>a.id===id);if(index<0)throw new DomainError('NOT_FOUND','This agreement is unavailable.',404);
      const verification=sensitiveActions.has(input.action)?stepUp:undefined;
      if(verification&&state.used.includes(verification.id))throw new DomainError('SIGNATURE_VERIFICATION_REQUIRED','Verify this action again.',403);
      const result=applyCommand(state.agreements[index],input,{actor,now:new Date().toISOString(),stepUp:verification});if(verification)state.used.push(verification.id);state.agreements[index]=result.agreement;state.responses[k]={hash,result:{agreement:result.agreement}};return result; });
  }
  async findInvitation(token:string) { return (await this.all()).find(a=>a.invitations.some(i=>i.tokenHash===sha256(token)))??null; }
  async claim(token:string,actor:Actor) { return this.transaction(state=>{const index=state.agreements.findIndex(a=>a.invitations.some(i=>i.tokenHash===sha256(token)));if(index<0)throw new DomainError('INVITATION_EXPIRED','This invitation is no longer active. Ask for a new link.',410);const a=claimInvitation(state.agreements[index],token,{actor,now:new Date().toISOString()});state.agreements[index]=a;return a;}); }
}
