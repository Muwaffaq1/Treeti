import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/database';
import { digest, sha256 } from '@/lib/crypto';
import { encryptDelivery } from '@/lib/session';
import { applyCommand, claimInvitation, claimInvitationById, createAgreement, DomainError, sensitiveActions } from './domain';
import type { Actor, Aggregate, Command, Context } from './types';

import {pendingBorrowerInvitations,type PendingBorrowerInvitation} from './pending-invitations';

const relations = {
  participants: 'agreement_participants', versions: 'agreement_versions', approvals: 'participant_approvals', attestations: 'witness_attestations',
  events: 'agreement_events', invitations: 'invitations', repayments: 'repayments', repaymentConfirmations: 'repayment_confirmations',
  adjustments: 'debt_adjustments', adjustmentConfirmations: 'adjustment_confirmations', settlements: 'settlement_confirmations', outbox: 'outbox_events',
} as const;
type Relation = keyof typeof relations;
type Row = Record<string, unknown>;
export interface Repository {
  list(actor: Actor): Promise<Aggregate[]>;
  pendingInvitations(actor: Actor): Promise<PendingBorrowerInvitation[]>;
  claimPending(id: string, actor: Actor): Promise<Aggregate>;
  get(id: string): Promise<Aggregate | null>;
  create(input: unknown, actor: Actor, key: string): Promise<{ agreement: Aggregate }>;
  command(id: string, input: Command, actor: Actor, key: string, stepUp?: Context['stepUp']): Promise<{ agreement: Aggregate; invitation?: { token: string; invitationId: string }; invitations?: { token: string; invitationId: string }[] }>;
  claim(token: string, actor: Actor): Promise<Aggregate>;
  findInvitation(token: string): Promise<Aggregate | null>;
}
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
export class PostgresRepository implements Repository {
  constructor(public db: Database) {}
  async list(actor: Actor) {
    const ids = await this.db.query<{ id: string }>('select distinct agreement_id as id from agreement_participants where user_id = $1', [actor.userId]);
    return (await Promise.all(ids.map(i => this.get(i.id)))).filter(a => !!a) as Aggregate[];
  }
  async pendingInvitations(actor: Actor) {
    const contacts=actor.contacts.map(c=>c.trim().toLowerCase());
    const rows=await this.db.query<{agreement_id:string}>("select distinct agreement_id from invitations where status='PENDING' and expires_at>now() and lower(btrim(data->>'destination'))=any($1::text[])",[contacts]);
    const agreements=await Promise.all(rows.map(r=>this.get(r.agreement_id)));
    return agreements.flatMap(a=>a?pendingBorrowerInvitations(a,actor):[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async claimPending(id: string, actor: Actor) {
    return this.db.transaction(async db=>{
      const [row]=await db.query<{agreement_id:string}>('select agreement_id from invitations where id=$1',[id]);
      const before=row?await this.load(db,row.agreement_id,true):null;
      if(!before||!before.invitations.some(i=>i.id===id&&before.participants.some(p=>p.id===i.participantId&&p.role==='BORROWER')))throw new DomainError('INVITATION_EXPIRED','This invitation is unavailable. Refresh your agreements or ask for a new invitation.',410);
      const result=claimInvitationById(before,id,{actor,now:await this.now(db)});await this.persist(db,result,before);return result;
    });
  }
  async get(id: string) { return this.db.transaction(db => this.load(db, id, true)); }
  async load(db: Database, id: string, lock = false): Promise<Aggregate | null> {
    const [row] = await db.query<Row>(`select * from agreements where id = $1${lock ? ' for update' : ''}`, [id]);
    if (!row) return null;
    const a: Aggregate = { id: String(row.id), publicId: String(row.public_id), createdBy: String(row.created_by), status: row.status as Aggregate['status'], currentVersionId: String(row.current_version_id), balanceMinor: String(row.remaining_balance_minor), createdAt: iso(row.created_at), finalizedAt: row.finalized_at ? iso(row.finalized_at) : null, settledAt: row.settled_at ? iso(row.settled_at) : null, participants: [], versions: [], approvals: [], attestations: [], events: [], invitations: [], repayments: [], repaymentConfirmations: [], adjustments: [], adjustmentConfirmations: [], settlements: [], outbox: [], manifest: null };
    // Under the parent row lock, all child reads form one authoritative snapshot.
    for (const [field, table] of Object.entries(relations)) {
      const rows = await db.query<{ data: unknown }>(`select data from ${table} where agreement_id = $1 order by ${field === 'versions' ? 'version_number' : field === 'events' ? 'sequence_number' : "data->>'createdAt', id"}`, [id]);
      (a[field as Relation] as unknown[]) = rows.map(r => r.data);
    }
    const [manifest] = await db.query<{ data: Aggregate['manifest'] }>('select data from evidence_manifests where agreement_id = $1', [id]); a.manifest = manifest?.data ?? null;
    return a;
  }
  async now(db: Database): Promise<string> { return iso((await db.query<{ now: unknown }>('select now() as now'))[0].now); }
  async insert(db: Database, table: string, columns: Row) {
    const entries = Object.entries(columns);
    await db.query(`insert into ${table} (${entries.map(([k]) => k).join(',')}) values (${entries.map((_, i) => `$${i + 1}`).join(',')})`, entries.map(([k, v]) => k === 'data' || k === 'encrypted_delivery' ? JSON.stringify(v) : v));
  }
  async persist(db: Database, a: Aggregate, before?: Aggregate) {
    if (!before) await db.query('insert into agreements (id,public_id,created_by,status,original_principal_minor,remaining_balance_minor,created_at,currency) values ($1,$2,$3,$4,$5,$5,$6,$7)', [a.id, a.publicId, a.createdBy, a.status, a.versions[0].terms.principalMinor, a.createdAt,a.versions[0].terms.currency]);
    for (const [field, table] of Object.entries(relations) as [Relation, string][]) {
      const old = new Map((before?.[field] ?? []).map(r => [r.id, r]));
      for (const item of a[field]) {
        const r = item as unknown as Row, previous = old.get(String(r.id));
        if (previous) {
          if (digest(previous) !== digest(r)) {
            if (field === 'participants') await db.query('update agreement_participants set user_id=$1, version_ids=$2, data=$3 where id=$4', [r.userId, r.versionIds, JSON.stringify(r), r.id]);
            else if (field === 'invitations') await db.query('update invitations set status=$1,data=$2 where id=$3', [r.status, JSON.stringify(r), r.id]);
            else if (field === 'repayments') await db.query('update repayments set status=$1,data=$2 where id=$3', [r.status, JSON.stringify(r), r.id]);
            else throw new Error(`Attempted to alter immutable ${field}`);
          }
          continue;
        }
        const cols: Row = { id: r.id, agreement_id: a.id, data: r };
        if (field === 'participants') Object.assign(cols, { user_id: r.userId, role: r.role, version_ids: r.versionIds });
        if (field === 'versions') { const terms = r.terms as Row; Object.assign(cols, { version_number: r.number, principal_minor: terms.principalMinor, interest_minor: '0', agreement_date: terms.agreementDate, due_date: terms.dueDate, content_hash: r.hash }); }
        if (['approvals', 'attestations', 'invitations'].includes(field)) Object.assign(cols, { participant_id: r.participantId, version_id: r.versionId });
        if (field === 'approvals') cols.action = r.action;
        if (field === 'attestations') cols.attestation_type = r.type;
        if (field === 'events') Object.assign(cols, { sequence_number: r.sequence, event_hash: r.hash, previous_hash: r.previousHash });
        if (field === 'invitations') Object.assign(cols, { token_hash: r.tokenHash, expires_at: r.expiresAt, status: r.status });
        if (field === 'repayments') Object.assign(cols, { participant_id: r.participantId, amount_minor: r.amountMinor, payment_date: r.date, external_reference: r.reference || null, status: r.status });
        if (field === 'repaymentConfirmations') Object.assign(cols, { participant_id: r.participantId, repayment_id: r.repaymentId, action: r.action });
        if (field === 'adjustments') Object.assign(cols, { participant_id: r.participantId, amount_minor: r.amountMinor });
        if (field === 'adjustmentConfirmations') Object.assign(cols, { participant_id: r.participantId, adjustment_id: r.adjustmentId });
        if (field === 'settlements') cols.participant_id = r.participantId;
        if (field === 'outbox') cols.event_type = r.eventType;
        await this.insert(db, table, cols);
      }
    }
    if (a.manifest && !before?.manifest) await this.insert(db, 'evidence_manifests', { id: randomUUID(), agreement_id: a.id, manifest_hash: a.manifest.hash, data: a.manifest });
    await db.query('update agreements set current_version_id=$1,status=$2,remaining_balance_minor=$3,finalized_at=$4,settled_at=$5,currency=$7 where id=$6', [a.currentVersionId, a.status, a.balanceMinor, a.finalizedAt, a.settledAt, a.id,a.versions.find(v=>v.id===a.currentVersionId)!.terms.currency]);
  }
  async idempotent<T>(db: Database, actor: Actor, key: string, operation: string, input: unknown, work: () => Promise<T>): Promise<T> {
    // Serializes identical requests across workers, including first insert.
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [`${actor.userId}:${key}`]);
    const requestHash = digest(input);
    const [prior] = await db.query<{ request_hash: string; operation: string; response: T }>('select * from idempotency_keys where actor_id=$1 and key=$2', [actor.userId, key]);
    if (prior) {
      if (prior.request_hash !== requestHash || prior.operation !== operation) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request key was used for a different action. Reload and try again.');
      return prior.response;
    }
    const response = await work();
    // Never persist a raw invitation token in an idempotency response.
    const safe = structuredClone(response) as T & { invitation?: unknown; invitations?: unknown }; delete safe.invitation; delete safe.invitations;
    await db.query('insert into idempotency_keys (actor_id,key,operation,request_hash,response) values ($1,$2,$3,$4,$5)', [actor.userId, key, operation, requestHash, JSON.stringify(safe)]);
    return response;
  }
  async create(input: unknown, actor: Actor, key: string) {
    return this.db.transaction(db => this.idempotent(db, actor, key, 'create', input, async () => {
      const now = await this.now(db), [n] = await db.query<{ n: string }>("select nextval('agreement_number_seq')::text as n");
      const agreement = createAgreement(input, { actor, now }, `TREETI-${now.slice(0,4)}-${n.n.padStart(5,'0')}`); await this.persist(db, agreement); return { agreement };
    }));
  }
  async command(id: string, input: Command, actor: Actor, key: string, stepUp?: Context['stepUp']) {
    return this.db.transaction(db => this.idempotent(db, actor, key, id, input, async () => {
      const before = await this.load(db, id, true); if (!before) throw new DomainError('NOT_FOUND', 'This agreement is unavailable.', 404);
      const verification=sensitiveActions.has(input.action)?stepUp:undefined;
      const result = applyCommand(before, input, { actor, now: await this.now(db), stepUp:verification });
      if (verification) await db.query('insert into consumed_verifications (id,actor_id,agreement_id) values ($1,$2,$3)', [verification.id, actor.userId, id]);
      await this.persist(db, result.agreement, before);
      const issued = result.invitation ? [result.invitation] : (result.invitations ?? []);
      for (const invitation of issued) {
        const delivery = result.agreement.outbox.find(o => o.payload.invitationId === invitation.invitationId)!;
        await db.query('update outbox_events set encrypted_delivery=$1 where id=$2', [JSON.stringify(encryptDelivery({ token: invitation.token })), delivery.id]);
      }
      return result;
    }));
  }
  async findInvitation(token: string) {
    const [r] = await this.db.query<{ agreement_id: string }>('select agreement_id from invitations where token_hash=$1', [sha256(token)]); return r ? this.get(r.agreement_id) : null;
  }
  async claim(token: string, actor: Actor) {
    return this.db.transaction(async db => {
      const [r] = await db.query<{ agreement_id: string }>('select agreement_id from invitations where token_hash=$1', [sha256(token)]);
      if (!r) throw new DomainError('INVITATION_EXPIRED', 'This invitation is no longer active. Ask the inviter for a new link.', 410);
      const before = (await this.load(db, r.agreement_id, true))!;
      const result = claimInvitation(before, token, { actor, now: await this.now(db) }); await this.persist(db, result, before); return result;
    });
  }
}
