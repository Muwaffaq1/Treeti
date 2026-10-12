-- Owner-only personal reminders are preferences, not consent evidence.
create table public.personal_debt_reminders (
  debt_id uuid primary key, owner_id uuid not null, id uuid not null unique,
  remind_at timestamptz not null, time_zone text not null,
  email_contact text, email_sent_at timestamptz,
  status text not null default 'SCHEDULED' check(status in ('SCHEDULED','PROCESSING','SENT','CANCELLED','FAILED')),
  attempts integer not null default 0, lease_until timestamptz,
  foreign key(debt_id,owner_id) references public.personal_debts(id,owner_id)
);
create index personal_reminder_due on public.personal_debt_reminders(remind_at) where status in ('SCHEDULED','PROCESSING');
alter table public.personal_debt_reminders enable row level security;
revoke all on public.personal_debt_reminders from anon,authenticated;
grant select on public.personal_debt_reminders to authenticated;
grant all on public.personal_debt_reminders to service_role;
create policy owner_read on public.personal_debt_reminders for select to authenticated using(owner_id=auth.uid());
