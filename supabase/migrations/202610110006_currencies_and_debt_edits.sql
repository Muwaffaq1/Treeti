-- Existing agreement snapshots and payment evidence remain append-only.
alter table public.agreements drop constraint agreements_currency_check;
alter table public.agreements add constraint agreements_currency_check
  check(currency in ('NGN','USD','GBP','EUR','GHS','KES','SAR','AED','CAD','AUD'));

create table public.personal_debt_revisions (
  debt_id uuid not null, owner_id uuid not null, revision integer not null check(revision>=0),
  recorded_at timestamptz not null default now(), data jsonb not null,
  primary key(debt_id,revision),
  foreign key(debt_id,owner_id) references public.personal_debts(id,owner_id)
);
alter table public.personal_debt_revisions enable row level security;
revoke all on public.personal_debt_revisions from anon,authenticated;
grant select on public.personal_debt_revisions to authenticated;
grant all on public.personal_debt_revisions to service_role;
create policy owner_read on public.personal_debt_revisions for select to authenticated using(owner_id=auth.uid());
create trigger immutable_private_revision before update or delete on public.personal_debt_revisions for each row execute function public.prevent_evidence_change();
insert into public.personal_debt_revisions(debt_id,owner_id,revision,recorded_at,data)
  select id,owner_id,0,created_at,data from public.personal_debts;

-- Keep deletes prohibited; edits serialize on the same row as new payments.
drop trigger immutable_private_debt on public.personal_debts;
create trigger prevent_private_debt_delete before delete on public.personal_debts for each row execute function public.prevent_evidence_change();
create function public.check_private_debt_edit() returns trigger language plpgsql set search_path=public as $$
declare paid bigint; first_payment date; plan jsonb; item jsonb; previous_date date; sum_minor bigint:=0; n integer:=0; first_date date; month_start date; expected_date date;
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at then raise exception 'Private debt identity is immutable'; end if;
    if coalesce((new.data->>'revision')::integer,0)<>coalesce((old.data->>'revision')::integer,0)+1 then raise exception 'Private debt revision changed'; end if;
    select coalesce(sum(amount_minor),0),min(payment_date) into paid,first_payment from personal_debt_payments where debt_id=old.id;
    if new.principal_minor<paid then raise exception 'Original amount is below recorded payments'; end if;
    if first_payment is not null and new.currency<>old.currency then raise exception 'Currency cannot change after recorded payments'; end if;
    if first_payment is not null and new.debt_date>first_payment then raise exception 'Debt date is after recorded payment'; end if;
  end if;
  if (new.data->>'id') is distinct from new.id::text or (new.data->>'ownerId') is distinct from new.owner_id::text or (new.data->>'currency') is distinct from new.currency::text or (new.data->>'amountMinor')::bigint is distinct from new.principal_minor or (new.data->>'date')::date is distinct from new.debt_date or (new.data->>'person') is distinct from new.person or coalesce(new.data->>'note','') is distinct from new.note or (new.data->>'createdAt')::timestamptz is distinct from new.created_at then raise exception 'Private debt metadata mismatch'; end if;
  if new.data ? 'dueDate' and (new.data->>'dueDate')::date<new.debt_date then raise exception 'Repayment date predates debt'; end if;
  plan:=new.data->'installments';
  if plan is not null then
    if new.data ? 'dueDate' or coalesce(plan->>'frequency','') not in ('WEEKLY','MONTHLY','CUSTOM') or jsonb_array_length(plan->'payments') not between 2 and 60 then raise exception 'Invalid installment plan'; end if;
    for item in select value from jsonb_array_elements(plan->'payments') loop
      if coalesce(item->>'amountMinor','') !~ '^[1-9][0-9]{0,13}$' or coalesce(item->>'dueDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid installment values'; end if;
      if (item->>'amountMinor')::bigint<=0 or (item->>'dueDate')::date<new.debt_date or (previous_date is not null and (item->>'dueDate')::date<=previous_date) then raise exception 'Invalid installment payment'; end if;
      if n=0 then first_date:=(item->>'dueDate')::date; end if;
      if plan->>'frequency'='WEEKLY' then expected_date:=first_date+n*7;
      elsif plan->>'frequency'='MONTHLY' then
        month_start:=(date_trunc('month',first_date)+make_interval(months=>n))::date;
        expected_date:=month_start+(least(extract(day from first_date)::integer,extract(day from (month_start+interval '1 month - 1 day'))::integer)-1);
      else expected_date:=(item->>'dueDate')::date; end if;
      if (item->>'dueDate')::date<>expected_date then raise exception 'Installment dates do not match frequency'; end if;
      sum_minor:=sum_minor+(item->>'amountMinor')::bigint; previous_date:=(item->>'dueDate')::date; n:=n+1;
    end loop;
    if n<2 or sum_minor<>new.principal_minor then raise exception 'Installments must sum to original amount'; end if;
  end if;
  return new;
end $$;
create trigger check_private_debt_edit before insert or update on public.personal_debts for each row execute function public.check_private_debt_edit();
create function public.preserve_private_debt_revision() returns trigger language plpgsql set search_path=public as $$
begin
  insert into personal_debt_revisions(debt_id,owner_id,revision,data) values(new.id,new.owner_id,coalesce((new.data->>'revision')::integer,0),new.data);
  return new;
end $$;
create trigger preserve_private_debt_revision after insert or update on public.personal_debts for each row execute function public.preserve_private_debt_revision();

create function public.protect_finalized_currency() returns trigger language plpgsql set search_path=public as $$
begin
  if old.finalized_at is not null and new.currency<>old.currency then raise exception 'Finalized agreement currency is immutable'; end if;
  return new;
end $$;
create trigger protect_finalized_currency before update on public.agreements for each row execute function public.protect_finalized_currency();
