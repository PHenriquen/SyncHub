-- SyncHub - PostgreSQL schema draft (target for migration from JSON DB)

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

create table if not exists user_core_state (
  user_id text primary key references users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

-- Optional normalized tables for analytics/search (phase 2)
create table if not exists messages (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  source text not null,
  channel text not null,
  sender text not null,
  sender_role text,
  message_text text not null,
  module_id text,
  priority_score integer not null,
  priority_level text not null,
  created_at timestamptz not null,
  inserted_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  status text not null,
  source text not null,
  module_id text,
  priority_level text not null,
  due_date timestamptz,
  source_message_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_messages_user_created on messages(user_id, created_at desc);
create index if not exists idx_tasks_user_status on tasks(user_id, status);
