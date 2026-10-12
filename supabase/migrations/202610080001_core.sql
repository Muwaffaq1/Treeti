-- Authoritative relational model. JSON data preserves versioned evidence fields;
-- typed columns enforce relationships, uniqueness and financial invariants.
create table public.agreements (
  id uuid primary key, public_id text not null unique, created_by uuid not null,
  status text not null check (status in ('DRAFT','AWAITING_BORROWER','CHANGES_REQUESTED','AWAITING_APPROVAL','AWAITING_WITNESSES','ACTIVE','SETTLEMENT_PENDING','SETTLED','DECLINED','CANCELLED')),
  current_version_id uuid, original_principal_minor bigint not null check (original_principal_minor > 0),
  remaining_balance_minor bigint not null check (remaining_balance_minor >= 0), currency char(3) not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now(), finalized_at timestamptz, settled_at timestamptz,
  check (status <> 'SETTLED' or (remaining_balance_minor = 0 and settled_at is not null))
);
create sequence public.agreement_number_seq;
create table public.agreement_participants (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), user_id uuid,
  role text not null check (role in ('LENDER','BORROWER','WITNESS')), version_ids uuid[] not null default '{}', data jsonb not null,
  unique (id, agreement_id), unique (agreement_id, user_id)
);
create unique index one_lender_per_agreement on public.agreement_participants(agreement_id) where role = 'LENDER';
create unique index one_borrower_per_agreement on public.agreement_participants(agreement_id) where role = 'BORROWER';
create index participant_user on public.agreement_participants(user_id, agreement_id);
create table public.agreement_versions (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), version_number integer not null,
  principal_minor bigint not null check (principal_minor > 0), interest_minor bigint not null default 0 check (interest_minor = 0),
  agreement_date date not null, due_date date not null, content_hash text not null check (length(content_hash) = 64), data jsonb not null,
  unique (agreement_id, version_number), unique (id, agreement_id), check (due_date >= agreement_date)
);
alter table public.agreements add constraint current_version_belongs_to_agreement foreign key (current_version_id, id) references public.agreement_versions(id, agreement_id) deferrable initially deferred;
create table public.participant_approvals (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  version_id uuid not null, action text not null check (action in ('ACCEPTED','DECLINED','REQUESTED_CHANGE')), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id),
  foreign key (version_id, agreement_id) references public.agreement_versions(id, agreement_id)
);
create unique index one_acceptance_per_version on public.participant_approvals(participant_id, version_id) where action = 'ACCEPTED';
create table public.witness_attestations (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  version_id uuid not null, attestation_type text not null check (attestation_type in ('FORMATION','EXISTING_DEBT_ACKNOWLEDGEMENT','REVIEW_ONLY')), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id),
  foreign key (version_id, agreement_id) references public.agreement_versions(id, agreement_id), unique (participant_id, version_id)
);
create table public.agreement_events (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), sequence_number bigint not null,
  event_hash text not null check (length(event_hash) = 64), previous_hash text, data jsonb not null,
  unique (agreement_id, sequence_number)
);
create table public.invitations (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  version_id uuid not null, token_hash text not null unique check (length(token_hash) = 64), expires_at timestamptz not null,
  status text not null check (status in ('PENDING','CLAIMED','REVOKED','DECLINED')), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id),
  foreign key (version_id, agreement_id) references public.agreement_versions(id, agreement_id)
);
create table public.repayments (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0), payment_date date not null,
  external_reference text, status text not null check (status in ('PROPOSED','CONFIRMED','DISPUTED')), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id), unique (id, agreement_id)
);
create unique index unique_payment_reference on public.repayments(agreement_id, external_reference) where external_reference is not null;
create table public.repayment_confirmations (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), repayment_id uuid not null,
  participant_id uuid not null, action text not null check (action in ('CONFIRMED','DISPUTED')), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id),
  foreign key (repayment_id, agreement_id) references public.repayments(id, agreement_id), unique(repayment_id)
);
create table public.debt_adjustments (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0), data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id), unique (id, agreement_id)
);
create table public.adjustment_confirmations (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), adjustment_id uuid not null,
  participant_id uuid not null, data jsonb not null,
  foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id),
  foreign key (adjustment_id, agreement_id) references public.debt_adjustments(id, agreement_id), unique(adjustment_id)
);
create table public.settlement_confirmations (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), participant_id uuid not null,
  data jsonb not null, foreign key (participant_id, agreement_id) references public.agreement_participants(id, agreement_id), unique(agreement_id, participant_id)
);
create table public.evidence_manifests (id uuid primary key, agreement_id uuid not null unique references public.agreements(id), manifest_hash text not null, data jsonb not null);
create table public.outbox_events (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), event_type text not null, data jsonb not null,
  encrypted_delivery jsonb, status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','PROCESSED','FAILED')),
  processed_at timestamptz, lease_until timestamptz, attempts integer not null default 0, last_error text
);
create index outbox_pending on public.outbox_events(status, lease_until);
create table public.idempotency_keys (
  actor_id uuid not null, key text not null, operation text not null, request_hash text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key(actor_id, key)
);
create table public.consumed_verifications (id uuid primary key, actor_id uuid not null, agreement_id uuid not null references public.agreements(id), consumed_at timestamptz not null default now());
create table public.notifications (
  id uuid primary key, user_id uuid, agreement_id uuid not null references public.agreements(id), event_id uuid not null,
  message text not null, read_at timestamptz, created_at timestamptz not null default now(), unique(user_id, event_id)
);
create table public.artifacts (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), version_id uuid not null,
  kind text not null check (kind in ('AGREEMENT','SETTLEMENT','RECEIPT','PROOF')), storage_path text not null, sha256 text not null,
  repayment_id uuid, created_at timestamptz not null default now(), data jsonb not null default '{}',
  foreign key (version_id, agreement_id) references public.agreement_versions(id, agreement_id)
);
create table public.reminders (
  id uuid primary key, agreement_id uuid not null references public.agreements(id), reminder_type text not null, target_date date not null,
  created_at timestamptz not null default now(), unique(agreement_id, reminder_type, target_date)
);

create function public.prevent_evidence_change() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Evidence is append-only'; end $$;
do $$ declare t text; begin
  foreach t in array array['agreement_versions','participant_approvals','witness_attestations','agreement_events','repayment_confirmations','debt_adjustments','adjustment_confirmations','settlement_confirmations','evidence_manifests','consumed_verifications','artifacts'] loop
    execute format('create trigger immutable_evidence before update or delete on public.%I for each row execute function public.prevent_evidence_change()', t);
  end loop;
end $$;
create function public.protect_payment() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Payment records cannot be deleted'; end if;
  if old.status <> 'PROPOSED' or new.status not in ('CONFIRMED','DISPUTED') or (new.data - 'status') <> (old.data - 'status') or new.amount_minor <> old.amount_minor or new.agreement_id <> old.agreement_id or new.participant_id <> old.participant_id then
    raise exception 'Only a response to a proposed payment may change';
  end if;
  return new;
end $$;
create trigger protect_payment before update or delete on public.repayments for each row execute function public.protect_payment();

-- SECURITY DEFINER helpers avoid self-recursive participant policies.
create function public.ahd_party(a uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from agreement_participants where agreement_id = a and user_id = auth.uid() and role in ('LENDER','BORROWER'))
$$;
create function public.ahd_witness_version(a uuid, v uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from agreement_participants where agreement_id = a and user_id = auth.uid() and role = 'WITNESS' and v = any(version_ids))
$$;
create function public.ahd_own_participant(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from agreement_participants where id = p and user_id = auth.uid())
$$;
revoke all on function public.ahd_party(uuid), public.ahd_witness_version(uuid,uuid), public.ahd_own_participant(uuid) from public;
grant execute on function public.ahd_party(uuid), public.ahd_witness_version(uuid,uuid), public.ahd_own_participant(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['agreements','agreement_participants','agreement_versions','participant_approvals','witness_attestations','agreement_events','invitations','repayments','repayment_confirmations','debt_adjustments','adjustment_confirmations','settlement_confirmations','evidence_manifests','outbox_events','idempotency_keys','consumed_verifications','notifications','artifacts','reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
  foreach t in array array['participant_approvals','agreement_events','repayments','repayment_confirmations','debt_adjustments','adjustment_confirmations','settlement_confirmations','evidence_manifests','artifacts'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy party_read on public.%I for select to authenticated using (public.ahd_party(agreement_id))', t);
  end loop;
end $$;
grant select on public.agreements, public.agreement_versions, public.witness_attestations, public.notifications to authenticated;
create policy party_read on public.agreements for select to authenticated using (public.ahd_party(id));
create policy version_read on public.agreement_versions for select to authenticated using (public.ahd_party(agreement_id));
create policy attestation_read on public.witness_attestations for select to authenticated using (public.ahd_party(agreement_id) or public.ahd_own_participant(participant_id));
create policy notification_read on public.notifications for select to authenticated using (user_id = auth.uid());
-- Participants contain contacts; witnesses use the sanitized application projection.
grant select on public.agreement_participants to authenticated;
create policy participant_read on public.agreement_participants for select to authenticated using (public.ahd_party(agreement_id) or user_id = auth.uid());
-- No authenticated/anon INSERT, UPDATE or DELETE policies. Sensitive commands
-- require the authenticated Next.js service and its restricted DB connection.
grant all on all tables in schema public to service_role;
grant usage, select on public.agreement_number_seq to service_role;
