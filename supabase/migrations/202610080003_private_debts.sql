-- Personal bookkeeping is owner-only, independent of participant agreements.
create table public.personal_debts (
  id uuid primary key, owner_id uuid not null, person text not null,
  currency char(3) not null check(currency in ('NGN','USD','GBP','EUR','GHS','KES','SAR','AED','CAD','AUD')),
  principal_minor bigint not null check(principal_minor > 0 and principal_minor <= 99999999999999),
  debt_date date not null, note text not null default '', created_at timestamptz not null default now(),
  data jsonb not null, unique(id,owner_id)
);
create index personal_debt_owner on public.personal_debts(owner_id,created_at);
create table public.personal_debt_payments (
  id uuid primary key, debt_id uuid not null, owner_id uuid not null,
  amount_minor bigint not null check(amount_minor > 0 and amount_minor <= 99999999999999),
  payment_date date not null, created_at timestamptz not null default now(), data jsonb not null,
  foreign key(debt_id,owner_id) references public.personal_debts(id,owner_id)
);
create index personal_payment_debt on public.personal_debt_payments(debt_id);
alter table public.personal_debts enable row level security;
alter table public.personal_debt_payments enable row level security;
revoke all on public.personal_debts,public.personal_debt_payments from anon,authenticated;
grant select on public.personal_debts,public.personal_debt_payments to authenticated;
create policy owner_read on public.personal_debts for select to authenticated using(owner_id=auth.uid());
create policy owner_read on public.personal_debt_payments for select to authenticated using(owner_id=auth.uid());
grant all on public.personal_debts,public.personal_debt_payments to service_role;

-- Serialize payments even outside the application transaction and prevent overpayment.
create function public.check_personal_debt_payment() returns trigger language plpgsql set search_path=public as $$
declare debt personal_debts; paid bigint;
begin
  select * into debt from personal_debts where id=new.debt_id and owner_id=new.owner_id for update;
  if not found then raise exception 'Private debt is unavailable'; end if;
  select coalesce(sum(amount_minor),0) into paid from personal_debt_payments where debt_id=new.debt_id;
  if paid+new.amount_minor>debt.principal_minor then raise exception 'Payment exceeds remaining balance'; end if;
  if new.payment_date<debt.debt_date then raise exception 'Payment predates debt'; end if;
  return new;
end $$;
create trigger check_private_payment before insert on public.personal_debt_payments for each row execute function public.check_personal_debt_payment();
create trigger immutable_private_debt before update or delete on public.personal_debts for each row execute function public.prevent_evidence_change();
create trigger immutable_private_payment before update or delete on public.personal_debt_payments for each row execute function public.prevent_evidence_change();
