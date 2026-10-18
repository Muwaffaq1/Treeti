-- People an owner trusts to see their debts if the owner can no longer manage them (ADR 022).
-- Server-only: browsers never read or write these tables directly.
create table public.trusted_contacts (
  id uuid primary key, owner_id uuid not null, contact_user_id uuid,
  email text not null check(email ~ '^[^@\s]+@[^@\s]+$' and length(email)<=254 and email=lower(email)),
  token_hash text not null unique check(length(token_hash)=64),
  status text not null check(status in ('INVITED','ACCEPTED','REMOVED')),
  revision integer not null check(revision>=0),
  created_at timestamptz not null, data jsonb not null,
  check((status='ACCEPTED')=(contact_user_id is not null) or status='REMOVED'),
  check(contact_user_id is distinct from owner_id)
);
create index trusted_contact_owner on public.trusted_contacts(owner_id,created_at);
create index trusted_contact_user on public.trusted_contacts(contact_user_id) where status='ACCEPTED';
create unique index trusted_contact_once on public.trusted_contacts(owner_id,email) where status<>'REMOVED';

create table public.trusted_contact_events (
  id uuid primary key, trusted_contact_id uuid not null references public.trusted_contacts(id),
  actor_id uuid not null,
  type text not null check(type in ('INVITED','LINK_RENEWED','ACCEPTED','REQUESTED','REFUSED','SHARED','STOPPED','REMOVED','LEFT')),
  created_at timestamptz not null default now()
);
create index trusted_contact_event_contact on public.trusted_contact_events(trusted_contact_id,created_at);

alter table public.trusted_contacts enable row level security;
alter table public.trusted_contact_events enable row level security;
revoke all on public.trusted_contacts,public.trusted_contact_events from anon,authenticated;
grant all on public.trusted_contacts,public.trusted_contact_events to service_role;
create trigger prevent_trusted_contact_delete before delete on public.trusted_contacts for each row execute function public.prevent_evidence_change();
create trigger immutable_trusted_contact_event before update or delete on public.trusted_contact_events for each row execute function public.prevent_evidence_change();

create function public.check_trusted_contact() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.owner_id<>old.owner_id or new.email<>old.email or new.created_at<>old.created_at then raise exception 'Trusted contact identity is immutable'; end if;
    if new.revision<>old.revision+1 then raise exception 'Trusted contact revision changed'; end if;
    if old.status='REMOVED' then raise exception 'A removed trusted contact cannot change'; end if;
    if old.contact_user_id is not null and new.contact_user_id is distinct from old.contact_user_id then raise exception 'Trusted contact identity is immutable'; end if;
  else
    if new.revision<>0 or new.status<>'INVITED' then raise exception 'Invalid new trusted contact'; end if;
    perform pg_advisory_xact_lock(hashtext('trusted:'||new.owner_id::text));
    if (select count(*) from trusted_contacts where owner_id=new.owner_id and status<>'REMOVED')>=2 then raise exception 'Trusted contact limit reached'; end if;
  end if;
  if (new.data->>'id') is distinct from new.id::text or (new.data->>'ownerId') is distinct from new.owner_id::text or (new.data->>'email') is distinct from new.email or (new.data->>'tokenHash') is distinct from new.token_hash or (new.data->>'status') is distinct from new.status or (new.data->>'contactUserId') is distinct from new.contact_user_id::text or (new.data->>'revision')::integer is distinct from new.revision or (new.data->>'createdAt')::timestamptz is distinct from new.created_at then raise exception 'Trusted contact metadata mismatch'; end if;
  if coalesce(length(new.data->>'name'),0) not between 2 and 120 or coalesce(length(new.data->>'ownerName'),0) not between 1 and 120 or coalesce(new.data->>'ownerEmail','') !~ '@' then raise exception 'Invalid trusted contact'; end if;
  return new;
end $$;
create trigger check_trusted_contact before insert or update on public.trusted_contacts for each row execute function public.check_trusted_contact();
