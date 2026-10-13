-- What signed-in people tell the operator about treeti. Holds no agreement content.
create table public.feedback (
  id uuid primary key, user_id uuid not null,
  rating smallint check(rating between 1 and 5),
  message text not null default '' check(length(message)<=2000),
  page text check(length(page)<=200),
  created_at timestamptz not null default now(),
  check(rating is not null or length(message)>0)
);
create index feedback_recent on public.feedback(created_at desc);
create index feedback_user on public.feedback(user_id,created_at desc);
-- Server-only: browsers never read or write this table directly.
alter table public.feedback enable row level security;
revoke all on public.feedback from anon,authenticated;
grant all on public.feedback to service_role;
