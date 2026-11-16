-- Investment agreements: two to five partners sign the same version of a joint investment (owner, Nov 2026).
-- Profit by agreed shares, loss by money put in, no fixed return. Server-only: browsers never read these tables.
create table public.investment_agreements (
  id uuid primary key,
  public_id text not null unique check(public_id ~ '^INV-[0-9A-F]{8}$'),
  created_by uuid not null,
  status text not null check(status in ('AWAITING_SIGNATURES','CHANGES_REQUESTED','AWAITING_WITNESSES','ACTIVE','DECLINED','CANCELLED')),
  revision integer not null check(revision>=0),
  created_at timestamptz not null,
  create_key text not null unique check(length(create_key)=64),
  data jsonb not null
);
create index investment_agreement_creator on public.investment_agreements(created_by,created_at desc);

-- Who is in each agreement, and the hash of any invitation link not opened yet.
create table public.investment_agreement_people (
  agreement_id uuid not null references public.investment_agreements(id),
  person_id uuid not null,
  user_id uuid,
  token_hash text check(token_hash is null or length(token_hash)=64),
  primary key(agreement_id,person_id)
);
create index investment_agreement_person_user on public.investment_agreement_people(user_id) where user_id is not null;
create unique index investment_agreement_person_token on public.investment_agreement_people(token_hash) where token_hash is not null;

-- Append-only audit trail; the full hash chain lives in data.events and is checked by the app.
create table public.investment_agreement_events (
  id uuid primary key,
  agreement_id uuid not null references public.investment_agreements(id),
  sequence integer not null check(sequence>0),
  actor_id uuid not null,
  type text not null check(type in ('CREATED','SIGNED','JOINED','CHANGE_REQUESTED','REVISED','DECLINED','CANCELLED','WITNESSED','FINALIZED','LINK_RENEWED')),
  hash text not null check(length(hash)=64),
  created_at timestamptz not null,
  unique(agreement_id,sequence)
);

alter table public.investment_agreements enable row level security;
alter table public.investment_agreement_people enable row level security;
alter table public.investment_agreement_events enable row level security;
revoke all on public.investment_agreements,public.investment_agreement_people,public.investment_agreement_events from anon,authenticated;
grant all on public.investment_agreements,public.investment_agreement_people,public.investment_agreement_events to service_role;
create trigger prevent_investment_agreement_delete before delete on public.investment_agreements for each row execute function public.prevent_evidence_change();
create trigger immutable_investment_agreement_event before update or delete on public.investment_agreement_events for each row execute function public.prevent_evidence_change();

create function public.check_investment_agreement() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.public_id<>old.public_id or new.created_by<>old.created_by or new.created_at<>old.created_at or new.create_key<>old.create_key then raise exception 'Investment agreement identity is immutable'; end if;
    if new.revision<>old.revision+1 then raise exception 'Investment agreement revision changed'; end if;
    if old.status in ('ACTIVE','DECLINED','CANCELLED') then raise exception 'A closed investment agreement cannot change'; end if;
    -- Signed versions and signatures are evidence: later revisions may add to them, never rewrite them.
    if (new.data->'versions')->0 is distinct from (old.data->'versions')->0
      or jsonb_array_length(new.data->'versions')<jsonb_array_length(old.data->'versions')
      or jsonb_array_length(new.data->'signatures')<jsonb_array_length(old.data->'signatures')
      or jsonb_array_length(new.data->'events')<=jsonb_array_length(old.data->'events') then raise exception 'Investment agreement evidence changed'; end if;
  elsif new.revision<>0 or new.status<>'AWAITING_SIGNATURES' then raise exception 'Invalid new investment agreement'; end if;
  if (new.data->>'id') is distinct from new.id::text or (new.data->>'publicId') is distinct from new.public_id or (new.data->>'createdBy') is distinct from new.created_by::text
    or (new.data->>'status') is distinct from new.status or (new.data->>'revision')::integer is distinct from new.revision or (new.data->>'createKey') is distinct from new.create_key then raise exception 'Investment agreement data mismatch'; end if;
  if jsonb_array_length(new.data->'partners') not between 2 and 5 or jsonb_array_length(coalesce(new.data->'witnesses','[]'::jsonb))>2 then raise exception 'Invalid investment agreement people'; end if;
  return new;
end $$;
create trigger check_investment_agreement before insert or update on public.investment_agreements for each row execute function public.check_investment_agreement();
