-- Private bookkeeping; no agreement participants or external money movement.
create table public.personal_investments (
  id uuid primary key, owner_id uuid not null,
  currency char(3) not null check(currency in ('NGN','USD','GBP','EUR','GHS','KES','SAR','AED','CAD','AUD')),
  revision integer not null check(revision>=0), created_at timestamptz not null,
  data jsonb not null, unique(id,owner_id)
);
create index personal_investment_owner on public.personal_investments(owner_id,created_at desc);
create table public.personal_investment_revisions (
  investment_id uuid not null, owner_id uuid not null, revision integer not null,
  recorded_at timestamptz not null default now(), data jsonb not null,
  primary key(investment_id,revision),
  foreign key(investment_id,owner_id) references public.personal_investments(id,owner_id)
);
alter table public.personal_investments enable row level security;
alter table public.personal_investment_revisions enable row level security;
revoke all on public.personal_investments,public.personal_investment_revisions from anon,authenticated;
grant select on public.personal_investments,public.personal_investment_revisions to authenticated;
grant all on public.personal_investments,public.personal_investment_revisions to service_role;
create policy owner_read on public.personal_investments for select to authenticated using(owner_id=auth.uid());
create policy owner_read on public.personal_investment_revisions for select to authenticated using(owner_id=auth.uid());
create trigger prevent_investment_delete before delete on public.personal_investments for each row execute function public.prevent_evidence_change();
create trigger immutable_investment_revision before update or delete on public.personal_investment_revisions for each row execute function public.prevent_evidence_change();

create function public.check_private_investment() returns trigger language plpgsql set search_path=public as $$
declare item jsonb; ids text[]:='{}';
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at then raise exception 'Investment identity is immutable'; end if;
    if new.revision<>old.revision+1 then raise exception 'Investment revision changed'; end if;
    if new.currency<>old.currency and jsonb_array_length(old.data->'contributions')>1 then raise exception 'Currency cannot change after additional contributions'; end if;
  elsif new.revision<>0 then raise exception 'Invalid initial investment revision'; end if;
  if (new.data->>'id') is distinct from new.id::text or (new.data->>'ownerId') is distinct from new.owner_id::text or (new.data->>'currency') is distinct from new.currency::text or (new.data->>'revision')::integer is distinct from new.revision or (new.data->>'createdAt')::timestamptz is distinct from new.created_at then raise exception 'Investment metadata mismatch'; end if;
  if coalesce(length(new.data->>'name'),0) not between 2 and 120 or coalesce(length(new.data->>'note'),0)>2000 or jsonb_typeof(new.data->'archived') is distinct from 'boolean' or jsonb_typeof(new.data->'contributions') is distinct from 'array' or jsonb_array_length(new.data->'contributions') not between 1 and 1000 then raise exception 'Invalid investment record'; end if;
  for item in select value from jsonb_array_elements(new.data->'contributions') loop
    if coalesce(item->>'amountMinor','') !~ '^[1-9][0-9]{0,13}$' or (item->>'amountMinor')::bigint>99999999999999 or coalesce(item->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (item->>'date')::date>(now() at time zone 'Africa/Lagos')::date or coalesce(length(item->>'note'),0)>2000 or coalesce(item->>'id','')='' or (item->>'id')=any(ids) then raise exception 'Invalid investment contribution'; end if;
    perform (item->>'id')::uuid;
    ids:=array_append(ids,item->>'id');
  end loop;
  return new;
end $$;
create trigger check_private_investment before insert or update on public.personal_investments for each row execute function public.check_private_investment();
create function public.preserve_investment_revision() returns trigger language plpgsql set search_path=public as $$
begin
  insert into personal_investment_revisions(investment_id,owner_id,revision,data) values(new.id,new.owner_id,new.revision,new.data);
  return new;
end $$;
create trigger preserve_investment_revision after insert or update on public.personal_investments for each row execute function public.preserve_investment_revision();
