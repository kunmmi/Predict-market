-- Notifications table: stores in-app + push notification records per user
create table if not exists notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null check (type in ('settlement_win','settlement_loss','match_reminder','market_live')),
  title       text        not null,
  body        text        not null,
  market_id   uuid        references markets(id) on delete set null,
  data        jsonb       not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, created_at desc);
create index if not exists notifications_market_id_idx on notifications(market_id);
create index if not exists notifications_unread_idx on notifications(user_id) where read_at is null;

alter table notifications enable row level security;

create policy "users read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users update own notifications"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Push subscriptions: stores browser push endpoint/keys per user device
create table if not exists push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  endpoint    text        not null,
  p256dh      text        not null,
  auth_key    text        not null,
  created_at  timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
