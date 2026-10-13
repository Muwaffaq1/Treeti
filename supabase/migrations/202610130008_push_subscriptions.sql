-- Devices a person has asked treeti to notify. Holds no agreement content.
create table public.push_subscriptions (
  id uuid primary key, user_id uuid not null,
  endpoint text not null unique check(endpoint ~ '^https://' and length(endpoint)<=1000),
  p256dh text not null check(length(p256dh) between 80 and 100),
  auth text not null check(length(auth) between 16 and 30),
  created_at timestamptz not null default now(), last_sent_at timestamptz
);
create index push_subscription_user on public.push_subscriptions(user_id,created_at desc);
-- Server-only: browsers never read or write this table directly.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant all on public.push_subscriptions to service_role;
